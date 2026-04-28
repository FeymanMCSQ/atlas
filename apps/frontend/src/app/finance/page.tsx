'use client';

import styles from './page.module.css';

export default function FinanceDashboard() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <header className={styles.header}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <h1 className={styles.title}>Financial Control Center 💳</h1>
               <a href="/" style={{textDecoration: 'none'}}>
                  <button className={styles.btnLaunch} style={{padding: '0.8rem 1.5rem', fontSize: '0.9rem'}}>Back to Atlas ⬅️</button>
               </a>
            </div>
            <p className={styles.subtitle}>
              Atlas operates as a swarm of autonomous background agents. Below is the master ledger of every third-party vendor currently wired into the Atlas Neural Control system, tracking exactly where your API credits are burning.
            </p>
        </header>

        <section className={styles.modulesGrid}>
            {/* OpenRouter Sector */}
            <div className={styles.apiCard}>
                <div className={styles.cardHeader}>
                   <div className={styles.vendorName}>OpenRouter.ai</div>
                   <div className={styles.costBadge}>Highest Spend 🔥</div>
                </div>
                <p className={styles.vendorDesc}>The primary LLM routing service powering logical deduction.</p>
                <ul className={styles.dependencyList}>
                   <li>
                     <strong>Content Brain:</strong> Runs <code>gemini-3-flash</code> standard for routine drafts. Modest usage.
                   </li>
                   <li>
                     <strong>Resonance Lab:</strong> Runs <code>claude-opus-4.6</code> to deconstruct marketing psychology. Very expensive per-token.
                   </li>
                   <li>
                     <strong>Discovery Engine:</strong> Periodically queries standard models to identify macro-trends from hacker news titles. Very low usage.
                   </li>
                </ul>
                <a href="https://openrouter.ai/credits" target="_blank" rel="noreferrer" className={styles.linkButton}>Check OpenRouter Balance ↗</a>
            </div>

            {/* Fal.ai Sector */}
            <div className={styles.apiCard}>
                <div className={styles.cardHeader}>
                   <div className={styles.vendorName}>Fal.ai</div>
                   <div className={styles.costBadgeMed}>Medium Spend 💰</div>
                </div>
                <p className={styles.vendorDesc}>High-speed serverless infrastructure for generative media.</p>
                <ul className={styles.dependencyList}>
                   <li>
                     <strong>Content Brain (Visuals):</strong> Generates the premium minimal typography plates using <code>fal-ai/flux-pro/v1.1</code>. Billed strictly per-generation every time a draft clears the image synthesis stage.
                   </li>
                </ul>
                <a href="https://fal.ai/dashboard/billing" target="_blank" rel="noreferrer" className={styles.linkButton}>Check Fal.ai Balance ↗</a>
            </div>

            {/* Brave Search API Sector */}
            <div className={styles.apiCard}>
                <div className={styles.cardHeader}>
                   <div className={styles.vendorName}>Brave Search API</div>
                   <div className={styles.costBadgeFree}>Effectively Free 🆓</div>
                </div>
                <p className={styles.vendorDesc}>Independent web, news, and image search API — no Google dependency.</p>
                <ul className={styles.dependencyList}>
                   <li>
                     <strong>Discovery Engine:</strong> Queries Brave News and Web Search for live tech trends. Manual-only — only fires when you press the dashboard buttons.
                   </li>
                   <li>
                     <strong>Free tier:</strong> $5 in free credits auto-applied monthly. A hard spending cap of $5 ensures the card is never charged.
                   </li>
                </ul>
                <a href="https://api-dashboard.search.brave.com/app/subscriptions" target="_blank" rel="noreferrer" className={styles.linkButton}>Check Brave Balance ↗</a>
            </div>

            {/* LinkedIn/X Sector */}
            <div className={styles.apiCard}>
                <div className={styles.cardHeader}>
                   <div className={styles.vendorName}>Social & Scraping</div>
                   <div className={styles.costBadgeFree}>Currently Free 🆓</div>
                </div>
                <p className={styles.vendorDesc}>Authentication infrastructure for pipeline execution.</p>
                <ul className={styles.dependencyList}>
                   <li>
                     <strong>LinkedIn API:</strong> Posts directly to your timeline. Free unless you breach massive enterprise scale ceilings.
                   </li>
                   <li>
                     <strong>Resonance Surveillance:</strong> Currently 100% free via local mock synthetic feeds.
                   </li>
                   <li>
                     <span style={{color: 'yellow'}}>Warning:</span> If you upgrade Surveillance to use Apify for real competitor tracking, expect a massive bill increase.
                   </li>
                </ul>
            </div>
        </section>

      </main>
    </div>
  );
}
