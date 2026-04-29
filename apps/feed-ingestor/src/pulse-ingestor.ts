import { searchGoogle } from "@atlas/integrations/src/serper-client.js";
import { db } from "@atlas/db";
import { EventTypes, ContentIngestedPayload } from "@atlas/domain";
import { emitEvent } from "@atlas/queue";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../../../.env") });

const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

const PULSE_MODEL = 'x-ai/grok-4.1-fast';

/**
 * FETCH 1: Hacker News Top Stories
 * Uses the official Firebase API (free)
 */
async function fetchHNTopSignals() {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    const ids = await res.json() as number[];
    const topIds = ids.slice(0, 30); // Top 30 stories
    
    const stories = await Promise.all(topIds.map(async (id) => {
      const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return await storyRes.json();
    }));
    
    return stories.map((s: any) => ({
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score,
      source: "Hacker News"
    }));
  } catch (err) {
    console.error(`[Pulse Reader] HN Fetch failed:`, err);
    return [];
  }
}

/**
 * FETCH 2: Reddit Hot (AI/Machine Learning)
 */
async function fetchRedditHotSignals() {
  try {
    const subreddits = ["r/all", "r/MachineLearning", "r/Singularity"];
    let signals: any[] = [];
    
    for (const sub of subreddits) {
      const res = await fetch(`https://www.reddit.com/${sub}/hot.json?limit=10`, {
        headers: { "User-Agent": "AtlasDiscoveryEngine/1.0" }
      });
      const data = await res.json();
      const posts = data.data?.children || [];
      
      signals = signals.concat(posts.map((p: any) => ({
        title: p.data.title,
        url: `https://reddit.com${p.data.permalink}`,
        score: p.data.ups,
        source: `Reddit (${sub})`
      })));
    }
    return signals;
  } catch (err) {
    console.error(`[Pulse Reader] Reddit Fetch failed:`, err);
    return [];
  }
}

/**
 * FETCH 3: X Trending Proxy (via Serper)
 */
async function fetchXTrendingSignals() {
  try {
    // We use a high-signal search query to find out what's currently being linked on X
    const query = 'site:x.com/ "trending" "AI" OR "SaaS" OR "Claude"';
    const results = await searchGoogle(query, 10, "qdr:d"); // Last 24 hours
    
    return results.map((r: any) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: "X (Proxy)"
    }));
  } catch (err) {
    console.error(`[Pulse Reader] X Proxy Fetch failed:`, err);
    return [];
  }
}

/**
 * INTELLIGENCE: Atomic Pulse Triangulation
 * Uses Grok 4.1 to find the "Hyper-Signals" across sources
 */
export async function runAtomicPulseCheck() {
  console.log(`\n[Atomic Pulse] Heartbeat check starting...`);
  
  const [hn, reddit, x] = await Promise.all([
    fetchHNTopSignals(),
    fetchRedditHotSignals(),
    fetchXTrendingSignals()
  ]);
  
  console.log(`[Atomic Pulse] Collected ${hn.length} HN stories, ${reddit.length} Reddit posts, ${x.length} X signals.`);

  try {
    const { object: pulseSignals } = await generateObject({
      model: provider(PULSE_MODEL),
      schema: z.object({
        highPriorityTopics: z.array(z.object({
          topic: z.string(),
          rationale: z.string(),
          urgency: z.number().describe("1-10")
        }))
      }),
      prompt: `
        You are a Trend Radar Architect. 
        Analyze these raw signals from HN, Reddit, and X:
        
        HN: ${hn.map(s => s.title).join(' | ')}
        Reddit: ${reddit.map(r => r.title).join(' | ')}
        X: ${x.map(x => x.title).join(' | ')}
        
        Identify the top 3 HYPER-VIRAL themes or project codenames (like "Claude Mythos", "GPT-5", etc.) that are currently blowing up across multiple channels.
        Ignore generic noise. Focus on things technical people are Arguing or Speculating about.
      `
    });

    console.log(`[Atomic Pulse] High-priority signals detected:`, pulseSignals.highPriorityTopics.map(t => t.topic).join(', '));

    // For each high-priority topic, trigger a new Discovery scan specifically for that term
    return pulseSignals.highPriorityTopics;
  } catch (err) {
    console.error(`[Atomic Pulse] Intelligence layer failure:`, err);
    return [];
  }
}

/**
 * RECON: Perform a deep hunt for a specific Pulse topic
 */
export async function reconPulseTopic(topic: string) {
    console.log(`\n[Pulse Ingestor] Performing deep recon for: "${topic}"`);
    const results = await searchGoogle(topic, 5, "qdr:d"); // Daily filter for ultra-fresh content
    
    let totalIngested = 0;
    for (const r of results) {
        if (!r.link) continue;
        const exists = await db.contentItem.findUnique({ where: { url: r.link } });
        if (exists) continue;

        const contentItem = await db.contentItem.create({
            data: {
              source: `[Pulse] ${topic}`,
              title: r.title || "No Title",
              url: r.link,
              summary: r.snippet || "",
              mode: 'INFORMATION',
              sourceData: r as any,
            },
        });

        await emitEvent(EventTypes.CONTENT_INGESTED, {
            contentItemId: contentItem.id,
            source: `[Pulse] ${topic}`,
            timestamp: new Date().toISOString()
        });
        totalIngested++;
    }
    console.log(`[Pulse Ingestor] ✅ Ingested ${totalIngested} reconnaissance articles for "${topic}"`);
}
