/**
 * Atlas Feed Ingestor Worker
 *
 * This process routinely polls active `FeedSource` records from the
 * Atlas database, downloads the latest XML, deducts items via their URL,
 * and emits `content.ingested` payload to the queue for orchestration.
 */

import Parser from "rss-parser";
import { db } from "@atlas/db";
import { emitEvent, closeQueue } from "@atlas/queue";
import { EventTypes, ContentIngestedPayload } from "@atlas/domain";

async function processFeeds(): Promise<void> {
  console.log(`[Feed Ingestor] Starting ingestion polling un (${new Date().toISOString()})...`);

  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  // 1. Fetch all active feeds globally
  let activeFeeds = await db.feedSource.findMany({
    where: { isActive: true },
  });

  if (activeFeeds.length === 0) {
    console.log(`[Feed Ingestor] No active feeds found in database. Bootstrapping defaults...`);
    const coreFeeds = [
      { name: 'Netflix TechBlog', url: 'https://netflixtechblog.com/feed' },
      { name: 'CNCF Blog', url: 'https://www.cncf.io/blog/feed/' },
      { name: 'Uber Engineering', url: 'https://www.uber.com/en-US/blog/engineering/rss/' },
      { name: 'Indie Hackers', url: 'https://www.indiehackers.com/feed.xml' },
      { name: 'Lennys Newsletter', url: 'https://www.lennysnewsletter.com/feed' }
    ];
    for (const feed of coreFeeds) {
      await db.feedSource.upsert({ 
        where: { url: feed.url }, 
        create: { name: feed.name, url: feed.url, isActive: true },
        update: { isActive: true } 
      });
    }
    // Re-fetch
    activeFeeds = await db.feedSource.findMany({ where: { isActive: true } });
  }

  for (const source of activeFeeds) {
    console.log(`\\n[Feed Ingestor] Fetching: ${source.name} -> ${source.url}`);

    try {
      const feed = await parser.parseURL(source.url);
      
      // We only process the 5 most recent items per run to prevent queue swamping 
      // when bootstrapping an old legacy RSS feed for the first time.
      const latestItems = feed.items.slice(0, 5);
      let ingestedCount = 0;

      for (const item of latestItems) {
        const title = item.title?.trim() || "No Title";
        const url = item.link?.trim() || "No URL";
        const summary = (item.contentSnippet || item.content || "").trim();

        // Deduplication: Avoid storing items we've already parsed historically
        const existingItem = await db.contentItem.findUnique({
          where: { url },
        });

        if (existingItem) {
          continue;
        }

        // Generate signal record
        const contentItem = await db.contentItem.create({
          data: {
            source: source.id,
            title,
            url,
            summary,
            // Pack the unstructured data into metadata dump mappings
            sourceData: item as any,
          },
        });

        // Event Hook: Trigger Orchestrator matching 03_event_flow limits.
        const payload: ContentIngestedPayload = {
          contentItemId: contentItem.id,
          source: source.name,
          timestamp: new Date().toISOString()
        };
        
        await emitEvent(EventTypes.CONTENT_INGESTED, payload);
        ingestedCount++;
      }

      console.log(`[Feed Ingestor] ✅ Finished ${source.name}: ${ingestedCount} new items ingested.`);

      // Update successful sync metadata
      await db.feedSource.update({
        where: { id: source.id },
        data: { lastFetched: new Date() },
      });

    } catch (err) {
      console.error(`[Feed Ingestor] ❌ Failed resolving feed ${source.url}:`, err);
    }
  }

  console.log(`\\n[Feed Ingestor] Polling cycle complete.`);
}

/**
 * Executes a single ingestion burst then shuts down cleanly (ideal for CRON).
 * Alternately, this could run via a setInterval for standard Node long-polling.
 */
async function startWorker() {
  try {
    await processFeeds();
  } catch (error) {
    console.error(`[Feed Ingestor] Fatal system fault:`, error);
  } finally {
    await closeQueue();
    process.exit(0);
  }
}

// In standard microservice arch, Kubernetes CRON spawns this index.
// Alternatively, for local dev, just running it natively executes one sweep!
startWorker();
