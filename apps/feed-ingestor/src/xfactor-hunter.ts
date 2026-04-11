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
  `site:linkedin.com "but everyone is missing the actual point" founder startup AI 2025`,
  `site:linkedin.com "the hard truth" bootstrapped SaaS founder 2025`,
  `site:linkedin.com "I used to think" startup lessons MRR 2025`,
  `site:linkedin.com "3 things nobody tells you" developer founder 2025`,
  `site:linkedin.com "the real reason" startup failed SaaS founder 2025`,
  `site:linkedin.com "stop doing" developer indie hacker productivity 2025`,
  `site:linkedin.com "I built" "MRR" OR "$" solo founder bootstrapped 2025`,
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
      body: JSON.stringify({ q: query, num: 5 })
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.organic || [])
      .filter((r: any) => r.link && r.link.includes('linkedin.com'))
      .map((r: any) => ({ url: r.link, title: r.title || '', snippet: r.snippet || '' }));
  } catch (e: any) {
    console.warn(`[X-Factor Hunter] Search error: ${e.message}`);
    return [];
  }
}

async function fetchPostContent(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return '';
    const text = await res.text();
    // Cap at 3000 chars to keep Claude scoring fast
    return text.substring(0, 3000);
  } catch (e: any) {
    console.warn(`[X-Factor Hunter] Jina fetch failed for ${url}: ${e.message}`);
    return '';
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
        messages: [{
          role: 'user',
          content: `You are an elite marketing psychologist judging the structural X-Factor of social media posts.

Score this post from 1-10 on its STRUCTURAL QUALITY (NOT based on the author's fame or subject matter):

Scoring Criteria:
1. Hook Strength (0-3pts): Does the first line create an irresistible open loop or contrarian tension?
2. Reach Independence (0-3pts): Would this post perform well for a completely unknown person? Or does it rely on the author being famous?
3. Engagement Architecture (0-2pts): Does the structure force a comment, share, or emotional reaction?
4. Originality of Insight (0-2pts): Is the insight genuinely non-obvious, or is it a cliché?

Post to score:
"""
${postText.substring(0, 1500)}
"""

Respond ONLY as JSON with this exact structure:
{
  "score": <number 1-10>,
  "hookArchetype": "<the psychological hook type used in one phrase>",
  "whyItHelps": "<one sentence on what structural technique Atlas content brain should borrow from this>"
}`
        }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e: any) {
    console.warn(`[X-Factor Hunter] Claude scoring failed: ${e.message}`);
    return null;
  }
}

async function injectIntoResonanceEngine(postText: string): Promise<{ name: string } | null> {
  try {
    // Call the Resonance API via localhost during development / Railway internal URL in prod
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
    console.log(`[X-Factor Hunter] Already ran today (${today}). Skipping.`);
    return;
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

  for (const candidate of unique.slice(0, 10)) { // Max 10 evaluations per day
    console.log(`[X-Factor Hunter] Evaluating: ${candidate.url}`);

    // First try snippet text (fast) — if too short, deep fetch via Jina
    let postText = candidate.snippet;
    if (postText.length < 200) {
      postText = await fetchPostContent(candidate.url);
    }
    if (postText.length < 50) continue;

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

  // Save report to database
  await db.resonanceReport.create({
    data: {
      date: today,
      postsAnalyzed: reportItems.length,
      postsInjected: injectedCount,
      reportItems
    }
  });

  console.log(`[X-Factor Hunter] Hunt complete. Analyzed: ${reportItems.length} | Injected: ${injectedCount}\n`);
}
