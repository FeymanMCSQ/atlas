import * as cheerio from "cheerio";

// Setup global bypass for UNABLE_TO_VERIFY_LEAF_SIGNATURE
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function fetchOgImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.94 Safari/537.36',
      }
    });

    if (!res.ok) {
      console.error(`HTTP error! status: ${res.status}`);
      return undefined;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Attempt to find the standard og:image
    const ogImage = $("meta[property='og:image']").attr("content");
    
    // Fallback to twitter:image if og:image fails
    const twitterImage = $("meta[name='twitter:image']").attr("content");

    return ogImage || twitterImage;
  } catch (err) {
    console.error(`[Scraper] Exception caught fetching ${url}:`, err);
    return undefined;
  }
}

async function runTest() {
  console.log("========================================");
  console.log("🕵️  Test Script: Headless Image Scraper");
  console.log("========================================");
  
  const testUrl = "https://github.blog";
  
  console.log(`[Target URL] ${testUrl}`);
  console.log(`[Fetching...]`);
  
  const imageUrl = await fetchOgImage(testUrl);
  
  if (imageUrl) {
    console.log(`✅ [Success!] Extracted Image Link: \n 👉 ${imageUrl}`);
  } else {
    console.log(`❌ [Failure] Could not find an image thumbnail for the URL.`);
  }
  
  console.log("========================================\n");
}

runTest();
