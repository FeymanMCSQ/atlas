/**
 * Atlas Feed Ingestor Worker
 *
 * This process routinely polls active `FeedSource` records from the
 * Atlas database, downloads the latest XML, deducts items via their URL,
 * and emits `content.ingested` payload to the queue for orchestration.
 */

import Parser from "rss-parser";
import https from "https";
import http from "http";
import * as cheerio from "cheerio";
import { db } from "@atlas/db";
import { emitEvent, closeQueue, createEventWorker } from "@atlas/queue";
import { EventTypes, ContentIngestedPayload, AtlasEvent } from "@atlas/domain";

import { performHyperDiscovery } from "./discovery.js";


// ---------------------------------------------------------------------------
// Canonical feed list — this is the SINGLE source of truth.
// If a URL is not in this list, it gets deactivated in the database.
// ---------------------------------------------------------------------------
const CORE_FEEDS = [
  // -----------------------------------------------------------------------
  // Engineering (Tech News & Architecture)
  // -----------------------------------------------------------------------
  { name: 'Netflix TechBlog', url: 'https://netflixtechblog.com/feed', category: 'Engineering' },
  { name: 'CNCF Blog', url: 'https://www.cncf.io/blog/feed/', category: 'Engineering' },
  { name: 'Uber Engineering', url: 'https://www.uber.com/en-US/blog/engineering/rss/', category: 'Engineering' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', category: 'Engineering' },
  { name: 'Google Research AI', url: 'https://research.google/blog/rss/', category: 'Engineering' },
  { name: 'Microsoft Dev Hub', url: 'https://devblogs.microsoft.com/feed/', category: 'Engineering' },
  { name: 'AWS News Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', category: 'Engineering' },
  { name: 'The Pragmatic Engineer', url: 'https://blog.pragmaticengineer.com/rss/', category: 'Engineering' },
  { name: 'CTO Craft', url: 'https://ctocraft.com/feed/', category: 'Engineering' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss', category: 'Engineering' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Engineering' },
  { name: 'DigitalOcean Blog', url: 'https://www.digitalocean.com/blog/rss/', category: 'Engineering' },
  { name: 'PostHog', url: 'https://posthog.com/rss.xml', category: 'Engineering' },
  { name: 'HashiCorp Blog', url: 'https://www.hashicorp.com/blog/feed.xml', category: 'Engineering' },

  // -----------------------------------------------------------------------
  // Founder Mode (Personal Essays & Entrepreneurship)
  // -----------------------------------------------------------------------
  { name: 'Lennys Newsletter', url: 'https://www.lennysnewsletter.com/feed', category: 'Founder Mode' },
  { name: 'Paul Graham Essays', url: 'https://raw.githubusercontent.com/leontloveless/ai-rss-feeds/main/feeds/paul-gram.xml', category: 'Founder Mode' },
  { name: 'Justin Jackson (Transistor)', url: 'https://justinjackson.ca/feed', category: 'Founder Mode' },
  { name: 'Pieter Levels (Nomad List)', url: 'https://levels.io/feed/', category: 'Founder Mode' },
  { name: 'Seth Godin', url: 'https://seths.blog/feed/', category: 'Founder Mode' },
  { name: 'Nathan Barry (ConvertKit)', url: 'https://nathanbarry.com/feed/', category: 'Founder Mode' },
  { name: 'A Smart Bear (Jason Cohen)', url: 'https://blog.asmartbear.com/feed/', category: 'Founder Mode' },
  { name: 'Farnam Street', url: 'https://fs.blog/feed/', category: 'Founder Mode' },
  { name: 'Startups For the Rest of Us', url: 'https://www.startupsfortherestofus.com/feed', category: 'Founder Mode' },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com/feed', category: 'Founder Mode' },
  { name: 'Nate Liason', url: 'https://blog.nateliason.com/feed', category: 'Founder Mode' },

  // -----------------------------------------------------------------------
  // GTM & Marketing (Sales, Growth, Scaling)
  // -----------------------------------------------------------------------
  { name: 'SaaStr', url: 'https://www.saastr.com/feed', category: 'GTM & Marketing' },
  { name: 'Close.com', url: 'https://blog.close.com/rss/', category: 'GTM & Marketing' },
  { name: 'Ahrefs', url: 'https://ahrefs.com/blog/feed/', category: 'GTM & Marketing' },
  { name: 'Demand Curve', url: 'https://www.demandcurve.com/feed', category: 'GTM & Marketing' },
  { name: 'Growth Unhinged', url: 'https://www.growthunhinged.com/feed', category: 'GTM & Marketing' },

  // -----------------------------------------------------------------------
  // Strategy (High-level Business Decision Making)
  // -----------------------------------------------------------------------
  { name: 'Tomasz Tunguz', url: 'https://tomtunguz.com/index.xml', category: 'Strategy' },
  { name: 'YC Blog', url: 'https://blog.ycombinator.com/feed/', category: 'Strategy' },
  { name: 'First Round Review', url: 'https://review.firstround.com/glossary/rss/', category: 'Strategy' },
];


// ---------------------------------------------------------------------------
// Custom XML fetcher — fetches the raw XML ourselves using Node's built-in
// http/https modules. This lets us bypass issues where rss-parser's internal
// fetcher gets blocked by Cloudflare or other WAFs.
// ---------------------------------------------------------------------------
function fetchXML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.94 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
      // @ts-ignore
      rejectUnauthorized: false,
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchXML(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ---------------------------------------------------------------------------
// Scrapes the HTML of an external article to pull its professional thumbnail
// ---------------------------------------------------------------------------
async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const html = await fetchXML(url);
    const $ = cheerio.load(html);
    return $("meta[property='og:image']").attr("content");
  } catch (err) {
    console.warn(`[Feed Ingestor] Could not fetch og:image for ${url}`);
    return undefined;
  }
}

async function processFeeds(): Promise<void> {
  console.log(`[Feed Ingestor] Starting ingestion (${new Date().toISOString()})...`);

  const parser = new Parser({
    customFields: {
      item: [['content:encoded', 'contentEncoded']]
    },
  });

  // ---- Step 1: Sync the canonical feed list to the database ----
  const coreUrls = CORE_FEEDS.map(f => f.url);
  
  console.log(`[Feed Ingestor] Syncing ${CORE_FEEDS.length} system feeds...`);
  for (const feed of (CORE_FEEDS as any[])) {
    await db.feedSource.upsert({ 
      where: { url: feed.url }, 
      create: { 
        name: feed.name, 
        url: feed.url, 
        category: feed.category,
        isActive: true 
      },
      update: { 
        name: feed.name, 
        category: feed.category,
        isActive: true 
      } 
    });
  }


  // Deactivate any feeds NOT in the canonical list (removes legacy duplicates)
  await db.feedSource.updateMany({
    where: { url: { notIn: coreUrls } },
    data: { isActive: false }
  });

  // ---- Step 2: Fetch all active feeds ----
  const activeFeeds = await db.feedSource.findMany({
    where: { isActive: true },
  });

  console.log(`[Feed Ingestor] Processing ${activeFeeds.length} active feeds...\n`);

  for (const source of activeFeeds) {
    console.log(`[Feed Ingestor] Fetching: ${source.name} -> ${source.url}`);

    try {
      // Fetch XML ourselves to bypass WAF/Cloudflare blocks
      const xml = await fetchXML(source.url);
      
      // Parse with rss-parser from the raw string (avoids its internal fetcher)
      let feed;
      try {
        feed = await parser.parseString(xml);
      } catch (parseErr: any) {
        // If rss-parser chokes on bad dates or malformed XML, try a lenient parse
        console.warn(`[Feed Ingestor] ⚠️  Parser error for ${source.name}, attempting lenient parse...`);
        
        // Strip or fix common XML issues before re-parsing
        const cleaned = xml
          .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g, '&amp;') // Fix unescaped &
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');       // Strip control chars
        
        try {
          feed = await parser.parseString(cleaned);
        } catch {
          console.error(`[Feed Ingestor] ❌ ${source.name}: Could not parse XML at all. Skipping.`);
          continue;
        }
      }
      
      const latestItems = feed.items.slice(0, 5);
      let ingestedCount = 0;

      for (const item of latestItems) {
        const title = item.title?.trim() || "No Title";
        const url = item.link?.trim() || "No URL";
        const summary = (item.contentSnippet || item.content || "").trim();

        if (url === "No URL") continue;

        // Deduplication and Backfill
        const existingItem = await db.contentItem.findUnique({ where: { url } });
        if (existingItem) {
          // If we added this before the scraper existed, backfill it!
          if (!existingItem.imageUrl) {
            const imageUrl = await fetchOgImage(url);
            if (imageUrl) {
              await db.contentItem.update({ where: { id: existingItem.id }, data: { imageUrl } });
              console.log(`[Feed Ingestor] 🌠 Backfilled image for existing article: ${title}`);
            }
          }
          continue;
        }

        const imageUrl = await fetchOgImage(url);

        const contentItem = await db.contentItem.create({
          data: {
            source: source.id,
            title,
            url,
            imageUrl,
            summary,
            sourceData: item as any,
          },
        });

        const payload: ContentIngestedPayload = {
          contentItemId: contentItem.id,
          source: source.name,
          timestamp: new Date().toISOString()
        };
        
        await emitEvent(EventTypes.CONTENT_INGESTED, payload);
        ingestedCount++;
      }

      console.log(`[Feed Ingestor] ✅ ${source.name}: ${ingestedCount} new items ingested.`);

      await db.feedSource.update({
        where: { id: source.id },
        data: { lastFetched: new Date() },
      });

    } catch (err: any) {
      console.error(`[Feed Ingestor] ❌ ${source.name}: ${err.message || err}`);
    }
  }

  console.log(`\n[Feed Ingestor] Polling cycle complete. (Discovery is manual-only via dashboard buttons)`);
}

import cron from 'node-cron';
import { executeSurveillancePipeline } from './surveillance.js';
import { runXFactorHunt } from './xfactor-hunter.js';

async function runIngestionCycle() {
  try {
    await processFeeds();
    // Intentionally omitting closeQueue so the connection stays alive 
    // for future cron cycles.
  } catch (error) {
    console.error(`[Feed Ingestor] System fault during cycle:`, error);
  }
}

async function startDaemon() {
  console.log(`[Atlas Daemon] Booting up background workers...`);
  
  // 1. Run an immediate ingestion cycle on startup
  await runIngestionCycle();


  // 2. Schedule standard news feed ingestion (Every 12 hours: 6am & 6pm)
  cron.schedule('0 */12 * * *', async () => {
    console.log(`[Atlas Daemon] ⏰ Triggering 12-hour feed ingestion...`);
    await runIngestionCycle();
  });

  // 3. Schedule the Z-Score Surveillance Engine (Midnight EST)
  cron.schedule('0 0 * * *', async () => {
    console.log(`[Atlas Daemon] ⏰ Triggering Midnight Competitor Surveillance...`);
    try {
      await executeSurveillancePipeline();
    } catch (e) {
      console.error(`[Surveillance Engine] Failed:`, e);
    }
  });

  cron.schedule('0 6 * * *', async () => {
    console.log(`[Atlas Daemon] ⏰ Triggering X-Factor Resonance Hunt...`);
    try {
      await runXFactorHunt();
    } catch (e) {
      console.error(`[X-Factor Hunter] Failed:`, e);
    }
  });

  /**
   * 5. Listen for Manual Resonance Hunt Requests
   */
  createEventWorker(EventTypes.RESONANCE_HUNT_REQUESTED, async (event: AtlasEvent) => {
    console.log(`[Atlas Daemon] 📥 Manual Resonance Hunt Triggered!`);
    try {
      await runXFactorHunt();
    } catch (e) {
      console.error(`[X-Factor Hunter] Manual Hunt Failed:`, e);
    }
  });

  /**
   * 6. Listen for Manual Hyper-Discovery Requests
   */
  createEventWorker(EventTypes.HYPER_DISCOVERY_REQUESTED, async (event: AtlasEvent) => {
    console.log(`[Atlas Daemon] 📥 Manual Hyper-Discovery Triggered! Triangulating viral signals...`);
    try {
      await performHyperDiscovery();
    } catch (e) {
      console.error(`[Discovery Engine] Manual Atomic Pulse Failed:`, e);
    }
  });



  console.log(`[Atlas Daemon] Workers successfully scheduled. System will remain active.`);

}

startDaemon();
