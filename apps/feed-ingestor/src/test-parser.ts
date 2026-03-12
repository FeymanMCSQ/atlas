/**
 * RSS Parser Setup Test
 *
 * Verifies that the Feed Ingestor can correctly fetch
 * and parse an external RSS feed.
 */

import Parser from "rss-parser";

async function testParser(): Promise<void> {
  console.log("Initializing RSS parser...\n");

  const parser = new Parser();
  
  
  // Using a stable, well-formed RSS feed for testing (Hacker News)
  const TEST_FEED_URL = "https://news.ycombinator.com/rss";
  
  
  try {
    console.log(`Fetching feed: ${TEST_FEED_URL}\n`);
    const feed = await parser.parseURL(TEST_FEED_URL);
    
    console.log(`✅ Successfully parsed feed: ${feed.title}`);
    console.log(`   Description: ${feed.description || "N/A"}`);
    console.log(`   Link: ${feed.link}\n`);
    
    console.log(`Found ${feed.items.length} items. First 3:`);
    
    feed.items.slice(0, 3).forEach((item, index) => {
      console.log(`\n[Item ${index + 1}]`);
      console.log(`  Title: ${item.title}`);
      console.log(`  Link:  ${item.link}`);
      console.log(`  Date:  ${item.pubDate || "N/A"}`);
    });

  } catch (error) {
    console.error("❌ Failed to parse RSS feed:", error);
    process.exit(1);
  }
}

testParser();
