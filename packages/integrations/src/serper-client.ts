/**
 * serper-client.ts
 * Integration with Serper.dev for autonomous Google Image Search falback.
 */

export async function searchGoogleImages(query: string): Promise<string | undefined> {
  const SERPER_API_KEY = process.env.SERPER_KEY;
  if (!SERPER_API_KEY) {
    throw new Error("Missing SERPER_KEY in environment variables.");
  }

  const response = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      autoCorrect: true
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Serper API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  if (data.images && data.images.length > 0) {
    // Return the URL of the top image result
    return data.images[0].imageUrl;
  }

  return undefined;
}

export async function searchGoogleNews(query: string): Promise<any[]> {
  const SERPER_API_KEY = process.env.SERPER_KEY;
  if (!SERPER_API_KEY) {
    throw new Error("Missing SERPER_KEY in environment variables.");
  }

  const response = await fetch("https://google.serper.dev/news", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      num: 5, // fetch top 5 news articles
      tbs: "qdr:w" // past week
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Serper News API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.news || [];
}

export async function searchGoogle(query: string, num = 10): Promise<any[]> {
  const SERPER_API_KEY = process.env.SERPER_KEY;
  if (!SERPER_API_KEY) {
    throw new Error('Missing SERPER_KEY in environment variables.');
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Serper Search API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.organic || [];
}
