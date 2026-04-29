import { searchGoogleNews } from "@atlas/integrations/src/serper-client.js";
import { db } from "@atlas/db";
import { EventTypes, ContentIngestedPayload } from "@atlas/domain";
import { emitEvent } from "@atlas/queue";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { runAtomicPulseCheck, reconPulseTopic } from "./pulse-ingestor.js";



import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

// Using Grok 4.1 Fast for autonomous discovery logic
const DISCOVERY_MODEL = 'x-ai/grok-4.1-fast';


const DiscoverySchema = z.object({
  queries: z.array(z.string()).describe("List of 3 highly specific Google News search queries targeting current tech/SaaS trends.")
});

const DISCOVERY_PROMPT = `
You are an expert tech journalist and B2B SaaS macro-analyst.
Your goal is to identify the 3 hottest, most debated, or most innovative topics actively happening in the world of Tech Entrepreneurship, B2B SaaS, and AI Infrastructure today.
Consider recent massive events, controversial architectural debates (e.g. monolith vs microservices, AI wrappers, bootstrapped vs VC funding), or new technology impacts.

Generate EXACTLY 3 highly optimized Google News search queries that will yield high-quality, thought-provoking articles about these trends. 
Make the queries short but specific (e.g., "AI agent automation startups", "Solo founder bootstrapping revenue", "B2B SaaS pricing models 2026").
`;

export async function discoverTrendingNews() {
  console.log(`\n[Discovery Engine] Waking up to find trending topics...`);
  
  try {
    const { object: trends } = await generateObject({
      model: provider(DISCOVERY_MODEL),
      schema: DiscoverySchema,
      prompt: DISCOVERY_PROMPT,
    });

    console.log(`[Discovery Engine] Detected trends: ${trends.queries.join(', ')}`);

    let totalIngested = 0;

    for (const query of trends.queries) {
      console.log(`[Discovery Engine] Searching Google News for: "${query}"`);
      const articles = await searchGoogleNews(query);
      
      for (const article of articles) {
        // Serper Returns: title, link, snippet, date, imageUrl, source
        const url = article.link;
        if (!url) continue;

        // Deduplication
        const existingItem = await db.contentItem.findUnique({ where: { url } });
        if (existingItem) continue;

        const title = article.title || "No Title";
        const summary = article.snippet || "";
        const imageUrl = article.imageUrl || undefined;
        let sourceName = article.source || "Web Search";

        // Prepend [Trend] so the user knows this was autonomously discovered
        const contentItem = await db.contentItem.create({
          data: {
            source: `[Trend] ${sourceName}`,
            title,
            url,
            imageUrl,
            summary,
            mode: 'INFORMATION', // Always map discovered news to information mode
            sourceData: article as any,
          },
        });

        const payload: ContentIngestedPayload = {
          contentItemId: contentItem.id,
          source: `[Trend] ${sourceName}`,
          timestamp: new Date().toISOString()
        };
        
        await emitEvent(EventTypes.CONTENT_INGESTED, payload);
        totalIngested++;
      }
    }

    console.log(`[Discovery Engine] ✅ Ingested ${totalIngested} trending articles autonomously into Information Mode.`);

    // After news discovery, run a hyper-pulse check to see if we missed any "underground" signals
    await performHyperDiscovery();

  } catch (err) {
    console.error(`[Discovery Engine] ❌ Failure in automated discovery:`, err);
  }
}

/**
 * HYPER-DISCOVERY: Triangulate social signals and perform deep recon.
 */
export async function performHyperDiscovery() {
    const topics = await runAtomicPulseCheck();
    
    for (const signal of topics) {
        // High urgency signals get immediate deep recon
        if (signal.urgency >= 7) {
            await reconPulseTopic(signal.topic);
        }
    }
}

