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
import { emitEvent, closeQueue } from "@atlas/queue";
import { EventTypes, ContentIngestedPayload } from "@atlas/domain";
import { discoverTrendingNews } from "./discovery.js";

// ---------------------------------------------------------------------------
// Canonical feed list — this is the SINGLE source of truth.
// If a URL is not in this list, it gets deactivated in the database.
// ---------------------------------------------------------------------------
const CORE_FEEDS = [
  { name: 'Netflix TechBlog', url: 'https://netflixtechblog.com/feed' },
  { name: 'CNCF Blog', url: 'https://www.cncf.io/blog/feed/' },
  { name: 'Uber Engineering', url: 'https://www.uber.com/en-US/blog/engineering/rss/' },
  { name: 'Lennys Newsletter', url: 'https://www.lennysnewsletter.com/feed' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
  { name: 'Google Research AI', url: 'https://research.google/blog/rss/' },
  { name: 'Microsoft Dev Hub', url: 'https://devblogs.microsoft.com/feed/' },
  { name: 'AWS News Blog', url: 'https://aws.amazon.com/blogs/aws/feed/' },
  { name: 'The Pragmatic Engineer', url: 'https://blog.pragmaticengineer.com/rss/' },
  { name: 'First Round Review', url: 'https://review.firstround.com/glossary/rss/' },
  { name: 'YC Blog', url: 'https://blog.ycombinator.com/feed/' },
  { name: 'Paul Graham Essays', url: 'https://raw.githubusercontent.com/leontloveless/ai-rss-feeds/main/feeds/paul-graham.xml' },
  { name: 'Farnam Street', url: 'https://fs.blog/feed/' },
  { name: 'CTO Craft', url: 'https://ctocraft.com/feed/' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'DigitalOcean Blog', url: 'https://www.digitalocean.com/blog/rss/' },
  { name: 'PostHog', url: 'https://posthog.com/rss.xml' },
  { name: 'HashiCorp Blog', url: 'https://www.hashicorp.com/blog/feed.xml' },
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
  for (const feed of CORE_FEEDS) {
    await db.feedSource.upsert({ 
      where: { url: feed.url }, 
      create: { name: feed.name, url: feed.url, isActive: true },
      update: { name: feed.name, isActive: true } 
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

  // ---- Step 3: AI Trend Discovery Engine ----
  await discoverTrendingNews();

  console.log(`\n[Feed Ingestor] Polling cycle complete.`);
}

async function startWorker() {
  try {
    await processFeeds();
  } catch (error) {
    console.error(`[Feed Ingestor] Fatal system fault:`, error);
  } finally {
    await closeQueue(EventTypes.CONTENT_INGESTED);
    process.exit(0);
  }
}

startWorker();
