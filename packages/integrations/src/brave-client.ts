/**
 * brave-client.ts
 * Brave Search API integration — replaces Serper.dev.
 *
 * Exposes the same function signatures AND response shapes as the old
 * serper-client.ts, so all callers (discovery, pulse, xfactor-hunter,
 * content-brain) require zero field-mapping changes.
 *
 * API docs: https://api-dashboard.search.brave.com/app/documentation
 */

const BASE_URL = 'https://api.search.brave.com/res/v1';

// ---------------------------------------------------------------------------
// Daily budget guard (in-process counter — resets on restart / midnight)
// Purely a sanity check against runaway loops. Set BRAVE_DAILY_LIMIT in .env
// to override. Default: 100 calls/day.
// ---------------------------------------------------------------------------
const _budget = {
  date: new Date().toISOString().split('T')[0],
  count: 0,
};

function checkBudget(): void {
  const today = new Date().toISOString().split('T')[0];
  // Reset counter at midnight
  if (_budget.date !== today) {
    _budget.date = today;
    _budget.count = 0;
  }
  const limit = parseInt(process.env.BRAVE_DAILY_LIMIT ?? '100', 10);
  if (_budget.count >= limit) {
    throw new Error(
      `[Brave Client] 🚨 Daily budget of ${limit} calls exhausted. ` +
      `Resets at midnight. Override with BRAVE_DAILY_LIMIT env var.`
    );
  }
  _budget.count++;
  console.log(`[Brave Client] 📊 Call #${_budget.count}/${limit} today`);
}

// ---------------------------------------------------------------------------
// Map Google-style tbs time filters → Brave freshness param
// ---------------------------------------------------------------------------
function tbsToFreshness(tbs?: string): string | undefined {
  const map: Record<string, string> = {
    'qdr:d': 'pd', // past day
    'qdr:w': 'pw', // past week
    'qdr:m': 'pm', // past month
    'qdr:y': 'py', // past year
  };
  return tbs ? (map[tbs] ?? undefined) : undefined;
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------
async function braveGet(path: string, params: Record<string, string | number | undefined>): Promise<any> {
  const BRAVE_KEY = process.env.BRAVE_SEARCH_KEY;
  if (!BRAVE_KEY) {
    throw new Error('[Brave Client] Missing BRAVE_SEARCH_KEY in environment variables.');
  }

  checkBudget();

  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  ) as Record<string, string>;

  const url = `${BASE_URL}${path}?${new URLSearchParams(filteredParams as Record<string, string>)}`;

  const response = await fetch(url, {
    headers: {
      'X-Subscription-Token': BRAVE_KEY,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[Brave Client] API error ${response.status} on ${path}: ${errorBody}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// searchGoogleNews
// Replaces: POST https://google.serper.dev/news
// Returns results normalised to Serper shape: { title, link, snippet, imageUrl, source }
// ---------------------------------------------------------------------------
export async function searchGoogleNews(query: string): Promise<any[]> {
  const data = await braveGet('/news/search', {
    q: query,
    count: '5',
    freshness: 'pw', // past week — equivalent to Serper's tbs:"qdr:w"
  });

  const results: any[] = data.results ?? [];

  // Normalise Brave shape → Serper shape so callers need no changes
  return results.map((r: any) => ({
    title: r.title ?? '',
    link: r.url ?? '',          // callers use .link
    snippet: r.description ?? '',
    imageUrl: r.thumbnail?.src ?? undefined,
    source: r.meta_url?.hostname ?? r.source ?? 'Web',
    date: r.age ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// searchGoogle
// Replaces: POST https://google.serper.dev/search
// Returns results normalised to Serper shape: { title, link, snippet }
// ---------------------------------------------------------------------------
export async function searchGoogle(query: string, num = 10, tbs?: string): Promise<any[]> {
  const freshness = tbsToFreshness(tbs);

  const data = await braveGet('/web/search', {
    q: query,
    count: String(num),
    freshness,
  });

  const results: any[] = data.web?.results ?? [];

  // Normalise Brave shape → Serper shape so callers need no changes
  return results.map((r: any) => ({
    title: r.title ?? '',
    link: r.url ?? '',          // callers use .link
    snippet: r.description ?? '',
  }));
}

// ---------------------------------------------------------------------------
// searchGoogleImages
// Replaces: POST https://google.serper.dev/images
// Returns the top image URL (string) or undefined
// ---------------------------------------------------------------------------
export async function searchGoogleImages(query: string): Promise<string | undefined> {
  const data = await braveGet('/images/search', {
    q: query,
    count: '5',
    spellcheck: '1',
  });

  const results: any[] = data.results ?? [];
  // Brave image results: properties.url is the actual image URL
  return results[0]?.properties?.url ?? results[0]?.thumbnail?.src ?? undefined;
}
