import { db } from '@atlas/db';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// ---------------------------------------------------------------------------
// X-Factor Resonance Hunter
// Runs every 24 hours. Searches Google for high-quality viral LinkedIn/X posts
// from tech founders, scores them with Claude-4.6-Opus for structural X-Factor,
// and feeds qualifying posts into the Resonance Engine.
// ---------------------------------------------------------------------------

// Rotating query pool — designed to surface posts using proven viral hooks
const XFACTOR_QUERIES = [
  `site:linkedin.com/posts/ "but everyone is missing the actual point"`,
  `site:linkedin.com/posts/ "the hard truth" bootstrapped founder`,
  `site:linkedin.com/posts/ "I used to think" MRR lessons`,
  `site:linkedin.com/posts/ "3 things nobody tells you"`,
  `site:linkedin.com/posts/ "stop doing" indie hacker productivity`,
  `site:linkedin.com/posts/ "I spent" "$" "months" SaaS`,
  `site:linkedin.com/posts/ "contrarian" startup insight`,
  `site:linkedin.com/posts/ "the real reason" AI failed`,
];


async function searchLinkedInPosts(query: string): Promise<{ url: string; title: string; snippet: string }[]> {
  const SERPER_API_KEY = process.env.SERPER_KEY;
  if (!SERPER_API_KEY) {
    console.warn('[X-Factor Hunter] SERPER_KEY not set. Skipping search.');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 15 })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[X-Factor Hunter] Serper API error (${response.status}): ${errorText}`);
        return [];
    }
    const data = await response.json();
    return (data.organic || [])
      .filter((r: any) => r.link && r.link.includes('linkedin.com'))
      .map((r: any) => ({ url: r.link, title: r.title || '', snippet: r.snippet || '' }));
  } catch (e: any) {
    console.error(`[X-Factor Hunter] Search error: ${e.message}`);
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



async function scorePostWithClaude(postText: string, url: string): Promise<{ score: number; hookArchetype: string; whyItHelps: string } | null> {
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
        model: 'anthropic/claude-opus-4.6',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing psychologist API. You output ONLY raw JSON that conforms strictly to the provided schema. No conversational filler, no markdown, no backticks.'
          },
          {
            role: 'user',
            content: `Score this post from 1-10 on its STRUCTURAL QUALITY:
            
            """
            ${postText.substring(0, 1500)}
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
        console.error(`[X-Factor Hunter] Claude API error (${response.status}): ${errorText}`);
        return null;
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
        console.error(`[X-Factor Hunter] Claude returned empty response`);
        return null;
    }
    return JSON.parse(raw);
  } catch (e: any) {
    console.error(`[X-Factor Hunter] Claude scoring exception: ${e.message}`);
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

  // Check if already ran today
  const existing = await db.resonanceReport.findUnique({ where: { date: today } });
  if (existing) {
    console.log(`[X-Factor Hunter] Daily report already exists for ${today}. This run will update the existing record.`);
  }



  // Pick 3 random queries from our pool (to avoid burning all Serper credits daily)
  const shuffled = XFACTOR_QUERIES.sort(() => Math.random() - 0.5).slice(0, 3);

  const candidatePool: { url: string; title: string; snippet: string }[] = [];
  for (const query of shuffled) {
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


    // Score with Claude
    const score = await scorePostWithClaude(postText, candidate.url);
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

    // Only inject posts scoring 7.5+
    if (score.score >= 7.5 && injectedCount < 5) {
      console.log(`[X-Factor Hunter] ✅ Score ${score.score} ≥ 7.5! Injecting into Resonance Engine...`);
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
