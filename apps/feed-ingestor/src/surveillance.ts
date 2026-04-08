import { db } from '@atlas/db';

// ---------------------------------------------------------------------------
// 1. Synthetic API Mock
//    Because X and LinkedIn heavily ban unauthorized automated scrapers, 
//    this abstraction simulates fetching data from a premium API like Apify.
//    In production, you'd replace this function payload with real HTTP calls.
// ---------------------------------------------------------------------------
async function fetchTargetPostsMock(handle: string) {
  // Simulating 5 recent posts for the target
  const baseLikes = handle === "shaanvp" ? 200 : 50; 
  
  const posts = [
    { url: `https://x.com/${handle}/1`, text: "Normal day building SaaS.", likes: baseLikes + 10, comments: 2 },
    { url: `https://x.com/${handle}/2`, text: "Just pushed another branch.", likes: baseLikes - 5, comments: 1 },
    { url: `https://x.com/${handle}/3`, text: "Hiring is hard.", likes: baseLikes + 20, comments: 5 },
    { url: `https://x.com/${handle}/4`, text: "Weekly update #45.", likes: baseLikes - 10, comments: 0 }
  ];

  // We inject one mathematically engineered "Outlier" viral post that breaks their baseline.
  if (handle === "shaanvp") {
    posts.push({
      url: `https://x.com/${handle}/5-viral`,
      text: "3 hard truths about scaling AI agents:\n\n1. Wrappers die fast.\n2. Infrastructure is your only moat.\n3. Latency is the real competitor.\n\nStop building toys. Build engines.",
      likes: baseLikes * 15, // 3,000 likes! MASSIVE outlier.
      comments: 480
    });
  }

  return posts;
}

// ---------------------------------------------------------------------------
// 2. Mathematical Z-Score Engine
// ---------------------------------------------------------------------------
function calculateZScore(value: number, baselineAvg: number) {
  if (baselineAvg === 0) return 0;
  // A simplified standard deviation calculation for demonstration.
  // In a robust system, you'd pull historically logged variances from ObservedPost.
  const varianceEst = baselineAvg * 0.5; 
  return (value - baselineAvg) / varianceEst;
}

// ---------------------------------------------------------------------------
// 3. Autonomous Pipeline Execution
// ---------------------------------------------------------------------------
export async function executeSurveillancePipeline() {
  console.log(`\n[Surveillance Engine] 🕵️‍♂️ Initializing Midnight Competitor Sweep...`);

  // Ensure mock targets exist in DB for testing
  await db.surveillanceTarget.upsert({
    where: { handle: 'shaanvp' },
    update: {},
    create: { platform: 'x', handle: 'shaanvp', baselineAverage: 200, postCount: 40 }
  });

  const targets = await db.surveillanceTarget.findMany();
  console.log(`[Surveillance Engine] Scanning ${targets.length} targets...`);

  for (const target of targets) {
    console.log(`[Surveillance] Scraping ${target.platform} / ${target.handle}...`);
    const recentPosts = await fetchTargetPostsMock(target.handle);

    for (const post of recentPosts) {
      const zScore = calculateZScore(post.likes, target.baselineAverage);
      
      // Update historical baseline
      const newTotal = (target.baselineAverage * target.postCount) + post.likes;
      const newCount = target.postCount + 1;
      const newAvg = Math.round(newTotal / newCount);

      await db.surveillanceTarget.update({
        where: { id: target.id },
        data: { baselineAverage: newAvg, postCount: newCount }
      });

      // Log observation
      await db.observedPost.upsert({
        where: { url: post.url },
        update: { likes: post.likes, comments: post.comments, zScore },
        create: {
          targetId: target.id,
          url: post.url,
          content: post.text,
          likes: post.likes,
          comments: post.comments,
          zScore
        }
      });

      // -------------------------------------------------------
      // Viral Outlier Protocol (The Math Filter)
      // If Z-Score > 2.5, it goes to Claude Resonance Engine.
      // -------------------------------------------------------
      if (zScore > 2.5) {
        console.log(`\n🚨 [Surveillance Engine] VIRAL OUTLIER DETECTED! 🚨`);
        console.log(` > Post: ${post.url}`);
        console.log(` > Likes: ${post.likes} (Z-Score: +${zScore.toFixed(2)})`);
        console.log(` > Executing automated Claude-3-Opus Resonance extraction...\n`);

        try {
          // Send it directly to our internal Resonance API to reverse engineer
          const req = await fetch('http://localhost:3000/api/resonance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viralPostText: post.text })
          });
          const res = await req.json();
          if (res.success) {
             console.log(`[Surveillance Engine] ✅ Cloned Template -> [${res.template.name}]`);
          } else {
             console.log(`[Surveillance] ⚠️ Failed Resonance parsing: ${res.error}`);
          }
        } catch (e: any) {
          console.error(`[Surveillance Engine] Cannot reach Frontend API: ${e.message}`);
        }
      }
    }
  }

  console.log(`[Surveillance Engine] Sweep Complete.\n`);
}
