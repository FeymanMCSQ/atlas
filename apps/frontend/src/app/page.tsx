"use client";

import React, { useEffect, useState, useRef } from 'react';
import styles from './page.module.css';

// Type declarations mapping our internal domain
type Feed = { id: string; name: string; url: string; isActive: boolean };
type Signal = { id: string; source: string; title: string; url: string; summary: string };
type Draft = { id: string; contentItemId: string; platform: string; body: string; status: string };

export default function AtlasDashboard() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set());
  const [signals, setSignals] = useState<Signal[]>([]);
  
  const [draftsMap, setDraftsMap] = useState<Record<string, Draft[]>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  
  // Track intervals per signal to avoid overlap in active polls
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    // Phase 1: Ribbon Hydration
    fetch('/api/feeds')
      .then(res => res.json())
      .then(data => {
        if (data.feeds) {
          setFeeds(data.feeds);
          // Auto-select all on load
          setSelectedFeeds(new Set(data.feeds.map((f: Feed) => f.id)));
        }
      });
  }, []);

  useEffect(() => {
    // Phase 2: Signal Grid Hydration (Filtered)
    if (selectedFeeds.size === 0) {
      setSignals([]);
      return;
    }
    
    // In a production app, we would batch this or send multiple IDs.
    // For this demonstration UI, we fetch signals based on the first selected feed for simplicity,
    // or aggregate them sequentially. We will aggregate:
    Promise.all(
      Array.from(selectedFeeds).map(feedId => 
        fetch(`/api/signals?feedId=${feedId}`).then(res => res.json())
      )
    ).then(results => {
      const combined = results.flatMap(r => r.signals || []);
      // Deduplicate + Shuffle latest
      const unique = combined.reduce((acc, current) => {
        const x = acc.find((item: Signal) => item.id === current.id);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);
      // Keep only top 24 for clean UI
      setSignals(unique.slice(0, 24));
    });
  }, [selectedFeeds]);

  const toggleFeed = (id: string) => {
    setSelectedFeeds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const synthesizeSignal = async (signalId: string) => {
    setProcessing(prev => ({ ...prev, [signalId]: true }));
    
    // 1. Fire the emission request
    await fetch('/api/synthesize', {
      method: 'POST',
      body: JSON.stringify({ contentItemId: signalId }),
    });

    // 2. Begin rigorous polling mechanism 
    const interval = setInterval(async () => {
      const res = await fetch(`/api/drafts?contentItemId=${signalId}`);
      const data = await res.json();
      
      const draftSet: Draft[] = data.drafts || [];
      
      // If our X and LinkedIn variants are generated correctly in the internal Orchestrator
      if (draftSet.length >= 2) {
        clearInterval(interval);
        setDraftsMap(prev => ({ ...prev, [signalId]: draftSet }));
        setProcessing(prev => ({ ...prev, [signalId]: false }));
      }
    }, 5000); // 5 sec heartbeat 

    pollIntervals.current[signalId] = interval;
  };

  const triggerPublish = async (draftId: string, platform: string, signalId: string) => {
    alert(`Publishing initiated for ${platform}! Workflow engaged.`);
    await fetch('/api/publish', {
      method: 'POST',
      body: JSON.stringify({ draftId, platform })
    });
    // In actual prod, we'd update `status: 'published'` visual indicator here.
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Atlas Neural Control</h1>
        <p className={styles.subtitle}>Autonomous B2B SaaS Content Generation Engine</p>
      </header>

      {/* Top Section: RSS Menu */}
      <section className={styles.ribbon}>
        {feeds.map(feed => (
          <div 
            key={feed.id}
            className={`${styles.chip} ${selectedFeeds.has(feed.id) ? styles.chipActive : ''}`}
            onClick={() => toggleFeed(feed.id)}
          >
            {feed.name}
          </div>
        ))}
        {feeds.length === 0 && <div className={styles.chip}>Loading Network...</div>}
      </section>

      {/* Middle Section: Display Grip */}
      <section className={styles.grid}>
        {signals.map(signal => {
          const drafts = draftsMap[signal.id];
          const isProcessing = processing[signal.id];
          const feedName = feeds.find(f => f.id === signal.source)?.name || 'Signal';

          return (
            <div key={signal.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{signal.title}</h3>
                <span className={styles.cardSource}>{feedName}</span>
              </div>
              <p className={styles.cardSummary}>{signal.summary}</p>
              
              {!drafts && (
                 <div className={styles.cardActions}>
                   <button 
                     className={styles.btnSynthesize} 
                     onClick={() => synthesizeSignal(signal.id)}
                     disabled={isProcessing}
                   >
                     {isProcessing ? '⚡ Generating AI Narrative...' : 'Synthesize Post ✨'}
                   </button>
                 </div>
              )}

              {/* Bottom Section: Draft Terminal */}
              {drafts && (
                 <div className={styles.draftTerminal}>
                   {drafts.map(d => (
                     <div key={d.id} className={styles.draftBox}>
                       <span className={styles.draftPlatform}>{d.platform}</span>
                       <p className={styles.draftBody}>{d.body}</p>
                       <div className={styles.publishActions}>
                         <button 
                           className={`${styles.btnPublish} ${d.platform === 'x' ? styles.btnPublishX : styles.btnPublishLn}`}
                           onClick={() => triggerPublish(d.id, d.platform, signal.id)}
                         >
                           Post to {d.platform === 'x' ? 'X' : 'LinkedIn'}
                         </button>
                       </div>
                     </div>
                   ))}
                   <div className={styles.publishActions} style={{borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '10px'}}>
                      <button className={styles.btnPublish} onClick={() => {
                        drafts.forEach(d => triggerPublish(d.id, d.platform, signal.id));
                      }}>
                        🚀 Post to Both
                      </button>
                   </div>
                 </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
