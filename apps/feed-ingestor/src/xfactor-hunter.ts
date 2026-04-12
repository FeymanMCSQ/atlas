import { db } from '@atlas/db';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { searchGoogle } from "@atlas/integrations/src/serper-client.js";

dotenv.config({ path: resolve(__dirname, '../../../.env') });


const provider = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

// Using Grok 4.1 Fast for edgy viral dork generation
const HUNTER_QUERY_MODEL = 'x-ai/grok-4.1-fast';


// ---------------------------------------------------------------------------
// X-Factor Resonance Hunter
// Runs every 24 hours. Searches Google for high-quality viral LinkedIn/X posts
// from tech founders, scores them with Claude-4.6-Opus for structural X-Factor,
// and feeds qualifying posts into the Resonance Engine.
// ---------------------------------------------------------------------------

/**
 * Dynamic Viral Dork Generator
 * Uses Grok 4.1 Fast to dream up high-signal LinkedIn searches every run.
 */
async function generateHunterQueries(): Promise<string[]> {
  try {
    const { object: data } = await generateObject({
      model: provider(HUNTER_QUERY_MODEL),
      schema: z.object({
        queries: z.array(z.string()).describe("List of 5 unique LinkedIn search dorks targeting structural masters.")
      }),
      prompt: `
        You are an elite, edgy viral growth engineer on X and LinkedIn.
        Your goal is to generate 5 highly specific Google Search "dorks" to find STRUCTURALLY BRILLIANT LinkedIn posts.
        
        Focus on finding posts where the formatting is deliberate (short breaks, numbered lists, contrarian openings).
        Don't just look for "success", look for "frameworks" and "raw insights".
        
        Examples of style:
        - site:linkedin.com/posts/ "the hard truth about" founder
        - site:linkedin.com/posts/ "I spent" "$" months SaaS
        - site:linkedin.com/posts/ "stop doing" productivity
        
        Generate 5 FRESH, non-repetitive queries now. Respond ONLY as JSON.
      `
    });
    return data.queries;
  } catch (err) {
    console.warn(`[X-Factor Hunter] Query generation failed, using fallbacks.`);
    return [
        `site:linkedin.com/posts/ "the hard truth" bootstrapped founder`,
        `site:linkedin.com/posts/ "I used to think" MRR lessons`,
        `site:linkedin.com/posts/ "stop doing" indie hacker productivity`
    ];
  }
}



async function searchLinkedInPosts(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  try {
    const organic = await searchGoogle(query, 15);
    return organic
      .filter((r: any) => r.link && r.link.includes('linkedin.com'))
      .map((r: any) => ({
        url: r.link,
        title: r.title || '',
        snippet: r.snippet || ''
      }));
  } catch (err: any) {
    console.error(`[X-Factor Hunter] Serper through integrations failed: ${err.message}`);
    return [];
  }
}



async function fetchPostContent(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(30000) // Increased to 30s for heavy LinkedIn pages
    });

    if (!res.ok) {
        console.warn(`[X-Factor Hunter] Jina fetch failed for ${url}: HTTP ${res.status}`);
        return '';
    }
    const text = await res.text();
    // Cap at 3000 chars to keep Claude scoring fast
    return text.substring(0, 3000);
  } catch (e: any) {
    console.warn(`[X-Factor Hunter] Jina fetch error for ${url}: ${e.message}`);
    return '';
  }
}


/**
 * Rapid "Vibe Check" Pre-Filter
 * Uses Gemini 3.1 Flash to quickly discard generic posts based on snippets.
 */
async function preFilterPost(title: string, snippet: string): Promise<number> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return 0;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-lite-preview',
        messages: [{
          role: 'user',
          content: `On a scale of 1-10, how likely is this LinkedIn post to have an UNCONVENTIONAL, non-generic structural hook?
          
          Title: ${title}
          Snippet: ${snippet}
          
          Respond with just a single number.`
        }]
      })
    });
    if (!response.ok) return 5; // Default to neutral if API fails
    const data = await response.json();
    const score = parseInt(data.choices?.[0]?.message?.content?.trim() || '0');
    return isNaN(score) ? 0 : score;
  } catch {
    return 0;
  }
}



async function scorePostWithGrok(postText: string, url: string): Promise<{ score: number; hookArchetype: string; whyItHelps: string } | null> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return null;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          {
            role: 'system',
            content: `You are a high-speed viral growth engineer and structural deconstructionist. 
            You excel at identifying "Gold Standard" social media templates that convert.
            
            GOLD STANDARD EXAMPLES (10/10):
            
            Example A (The Contrarian List):
            "3 things everyone gets wrong about [X].
            1. [Surprising point]
            2. [Counter-intuitive point]
            3. [The real truth]
            Stop doing [Common mistake]. Start doing [X]."
            
            Example B (The Growth Loop):
            "I used to think [Popular cliche].
            Then I [Failure/Action].
            Result: [Massive Benefit].
            Here is the 3-step routine I use now:
            - Step 1: ...
            - Step 2: ...
            - Step 3: ...
            [Actionable prompt]."
            
            You output ONLY raw JSON that strictly conforms to the provided schema. No conversational filler.`
          },
          {
            role: 'user',
            content: `Analyze this post for its STRUCTURAL GOLD / REUSABLE PATTERN. 
            
            Focus on the VISUAL RHYTHM (white space) and CADENCE. Is this a template we can reuse for B2B founder content?
            
            Scoring Rubric (10pts total):
            1. Hook Strength (0-3pts): Irresistible contrarian tension or open loop in line 1.
            2. Visual Rhythm (0-3pts): Does it use white space and short sentences to force reading?
            3. Engagement Logic (0-2pts): Specific rhythmic pattern (e.g. List -> Insight -> Ask).
            4. Reach Independence (0-2pts): Works because of the structure, not the author's personality.
            
            Note: Be generous with 7+ scores if the layout is mathematically perfect for B2B LinkedIn.
            
            Post to score:
            """
            ${postText.substring(0, 3000)}
            """`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'xfactor_score',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                hookArchetype: { type: 'string' },
                whyItHelps: { type: 'string' }
              },
              required: ['score', 'hookArchetype', 'whyItHelps'],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[X-Factor Hunter] Grok API error (${response.status}): ${errorText}`);
        return null;
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
        console.error(`[X-Factor Hunter] Grok returned empty response`);
        return null;
    }
    return JSON.parse(raw);
  } catch (e: any) {
    console.error(`[X-Factor Hunter] Grok scoring exception: ${e.message}`);
    return null;
  }
}




async function injectIntoResonanceEngine(postText: string): Promise<{ name: string } | null> {
  try {
    // Call the Resonance API via localhost during development / Railway internal URL in prod
    const baseUrl = process.env.FRONTEND_URL || 'https://atlas-frontend-sigma.vercel.app';

    const req = await fetch(`${baseUrl}/api/resonance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viralPostText: postText })
    });
    const res = await req.json();
    if (res.success) return res.template;
    return null;
  } catch (e: any) {
    console.warn(`[X-Factor Hunter] Resonance injection failed: ${e.message}`);
    return null;
  }
}

export async function runXFactorHunt() {
  console.log(`\n[X-Factor Hunter] 🎯 Starting daily viral post hunt...`);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 1. Dynamically generate edgy search queries via Grok 4.1 Fast
  console.log(`[X-Factor Hunter] 🧠 Consulting Grok-4.1 for fresh viral dorks...`);
  const activeQueries = await generateHunterQueries();

  // Check if already ran today
  const existing = await db.resonanceReport.findUnique({ where: { date: today } });

  if (existing) {
    console.log(`[X-Factor Hunter] Daily report already exists for ${today}. This run will update the existing record.`);
  }



  const candidatePool: { url: string; title: string; snippet: string }[] = [];
  for (const query of activeQueries) {
    console.log(`[X-Factor Hunter] Searching: "${query.substring(0, 60)}..."`);
    const results = await searchLinkedInPosts(query);
    candidatePool.push(...results);
  }


  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = candidatePool.filter(p => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  console.log(`[X-Factor Hunter] Found ${unique.length} unique posts to evaluate.`);

  const reportItems: any[] = [];
  let injectedCount = 0;

  for (const candidate of unique.slice(0, 40)) { // Increase candidate pool to 40
    console.log(`[X-Factor Hunter] Sifting: ${candidate.title.substring(0, 40)}...`);

    // Step 1: Rapid Pre-Filter (Snippet only)
    const vibeScore = await preFilterPost(candidate.title, candidate.snippet);
    if (vibeScore < 6) {
      console.log(`[X-Factor Hunter] 💨 Skipping low-vibe candidate (${vibeScore}/10)`);
      continue;
    }

    console.log(`[X-Factor Hunter] ✨ Candidate passed pre-filter (${vibeScore}/10). Fetching deep content...`);

    // Step 2: Deep Fetch via Jina
    const postText = await fetchPostContent(candidate.url);
    if (postText.length < 200) continue;


    // Score with Grok
    const score = await scorePostWithGrok(postText, candidate.url);

    if (!score) continue;

    console.log(`[X-Factor Hunter] Score: ${score.score}/10 | ${candidate.url}`);

    const reportItem = {
      url: candidate.url,
      title: candidate.title,
      score: score.score,
      hookArchetype: score.hookArchetype,
      whyItHelps: score.whyItHelps,
      injected: false
    };

    // Only inject posts scoring 6.5+ (Lowered threshold for high-potential candidates)
    if (score.score >= 6.5 && injectedCount < 5) {
      console.log(`[X-Factor Hunter] ✅ Score ${score.score} ≥ 6.5! Injecting into Resonance Engine...`);

      const template = await injectIntoResonanceEngine(postText);
      if (template) {
        injectedCount++;
        reportItem.injected = true;
        console.log(`[X-Factor Hunter] 🧬 Template saved: "${template.name}"`);
      }
    }

    reportItems.push(reportItem);
  }

  // Upsert report to database (prevent duplicate key crashes)
  await db.resonanceReport.upsert({
    where: { date: today },
    update: {
      postsAnalyzed: reportItems.length,
      postsInjected: injectedCount,
      reportItems
    },
    create: {
      date: today,
      postsAnalyzed: reportItems.length,
      postsInjected: injectedCount,
      reportItems
    }
  });

  console.log(`[X-Factor Hunter] Hunt complete. Analyzed: ${reportItems.length} | Injected: ${injectedCount}\n`);
}
