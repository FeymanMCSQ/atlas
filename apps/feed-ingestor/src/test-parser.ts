/**
 * RSS Parser Metadata Extractor
 *
 * Verifies that the Feed Ingestor can correctly fetch
 * an external RSS feed and extract the required metadata
 * into a structured JSON format (title, url, summary).
 */

import Parser from "rss-parser";
import { db } from "@atlas/db";
import { emitEvent, closeQueue } from "@atlas/queue";
import { EventTypes, ContentIngestedPayload } from "@atlas/domain";

export interface ArticleMetadata {
  title: string;
  url: string;
  summary: string;
}

async function extractMetadata(): Promise<void> {
  console.log("Initializing RSS parser...\n");

  const parser = new Parser();
  
  // Using The Verge for a fresh URL test
  const TEST_FEED_URL = "https://www.theverge.com/rss/index.xml";
  
  try {
    const feed = await parser.parseURL(TEST_FEED_URL);
    
    // Store the feed source in the database (idempotent upsert)
    const feedSource = await db.feedSource.upsert({
      where: { url: TEST_FEED_URL },
      update: {
        name: feed.title || "Unknown Feed",
        lastFetched: new Date(),
      },
      create: {
        name: feed.title || "Unknown Feed",
        url: TEST_FEED_URL,
        lastFetched: new Date(),
      },
    });

    console.log(`✅ Saved FeedSource to database: ${feedSource.name} (${feedSource.id})\n`);
    
    // Extract metadata from the first 3 items
    const extractedItems: ArticleMetadata[] = feed.items.slice(0, 3).map((item) => ({
      title: item.title?.trim() || "No Title",
      url: item.link?.trim() || "No URL",
      // Different RSS feeds put summary data in different fields
      summary: (item.contentSnippet || item.content || "").trim(),
    }));

    // Save each extracted item to the database as a ContentItem ONLY if it doesn't already exist
    for (const item of extractedItems) {
      // 1. Check if the ContentItem already exists by its unique URL
      const existingItem = await db.contentItem.findUnique({
        where: { url: item.url },
      });

      // 2. If it exists, skip it (Deduplication Check)
      if (existingItem) {
        console.log(`⏭️  Skipped duplicate: ${item.title.substring(0, 40)}...`);
        continue;
      }

      // 3. Otherwise, store the new item
      const contentItem = await db.contentItem.create({
        data: {
          source: feedSource.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          // Store raw extracted data in JSON block for future-proofing
          sourceData: item as any,
        },
      });

      console.log(`✅ Saved NEW ContentItem: ${contentItem.title.substring(0, 40)}... (${contentItem.id})`);
      
      // 4. Emit the content.ingested event to notify the orchestrator
      const payload: ContentIngestedPayload = {
        contentItemId: contentItem.id,
        source: feedSource.name,
        timestamp: new Date().toISOString()
      };
      
      const job = await emitEvent(EventTypes.CONTENT_INGESTED, payload);
      console.log(`   ➡️ Emitted content.ingested event: Job ${job.id}`);
    }

    console.log("\n✅ Successfully extracted, deduplicated, and stored all metadata!");

  } catch (error) {
    console.error("❌ Failed to parse RSS feed:", error);
    process.exit(1);
  } finally {
    // Ensure Redis cleanly disconnects
    await closeQueue();
  }
}

extractMetadata();
