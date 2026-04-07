"use client";

import React, { useEffect, useState, useRef } from 'react';
import styles from './page.module.css';

// Type declarations mapping our internal domain
type Feed = { id: string; name: string; url: string; isActive: boolean };
type Signal = { id: string; source: string; title: string; url: string; summary: string; imageUrl?: string };
type Draft = { id: string; contentItemId: string; platform: string; body: string; status: string; mediaUrl?: string };

export default function AtlasDashboard() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set());
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedMode, setSelectedMode] = useState<Record<string, string>>({});
  const [selectedAIModel, setSelectedAIModel] = useState<string>('google/gemini-3-flash-preview');
  
  const [draftsMap, setDraftsMap] = useState<Record<string, Draft[]>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<string>('');
  
  // Article Viewer Modal State
  const [readingSignal, setReadingSignal] = useState<Signal | null>(null);
  const [articleMarkdown, setArticleMarkdown] = useState<string>('');
  const [isArticleLoading, setIsArticleLoading] = useState<boolean>(false);
  
  // Track intervals per signal to avoid overlap in active polls
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    fetch('/api/feeds')
      .then(res => res.json())
      .then(data => {
        if (data.feeds) {
          setFeeds(data.feeds);
          // Auto-select all on load
          setSelectedFeeds(new Set(data.feeds.map((f: Feed) => f.id)));
        }
      });

    // Theme initialization
    const savedTheme = localStorage.getItem('atlas-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('atlas-theme', nextTheme);
  };

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

  const selectAllFeeds = () => {
    setSelectedFeeds(new Set(feeds.map(f => f.id)));
  };

  const deselectAllFeeds = () => {
    setSelectedFeeds(new Set());
  };

  const synthesizeSignal = async (signalId: string, mode: string) => {
    setProcessing(prev => ({ ...prev, [signalId]: true }));
    
    // 1. Fire the emission request
    await fetch('/api/synthesize', {
      method: 'POST',
      body: JSON.stringify({ contentItemId: signalId, mode, model: selectedAIModel }),
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveEdit = async (signalId: string, draftId: string) => {
    await fetch('/api/drafts', {
      method: 'PATCH',
      body: JSON.stringify({ draftId, body: editBody })
    });
    
    setDraftsMap(prev => {
      const signalDrafts = prev[signalId].map(d => 
        d.id === draftId ? { ...d, body: editBody } : d
      );
      return { ...prev, [signalId]: signalDrafts };
    });
    setEditingDraftId(null);
    setEditBody('');
  };

  const openArticleReader = async (signal: Signal) => {
    setReadingSignal(signal);
    setIsArticleLoading(true);
    setArticleMarkdown('');
    try {
       const res = await fetch(`https://r.jina.ai/${signal.url}`);
       if (res.ok) {
         setArticleMarkdown(await res.text());
       } else {
         setArticleMarkdown(`⚠️ Failed to load article automatically (HTTP ${res.status}).\n\nPlease visit the source manually: ${signal.url}`);
       }
    } catch (e) {
       setArticleMarkdown(`⚠️ Network error while attempting to load article.\n\nPlease visit the source manually: ${signal.url}`);
    } finally {
       setIsArticleLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.logoGroup}>
            <h1 className={styles.title}>Atlas Neural Control</h1>
            <p className={styles.subtitle}>Autonomous B2B SaaS Content Generation Engine</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/resonance-lab" style={{textDecoration: 'none'}}>
              <button className={styles.btnActionSecondary}>
                Resonance Lab 🔬
              </button>
            </a>
            <select 
              className={styles.modeSelect} 
              style={{ margin: 0, padding: '0.5rem 1rem' }}
              value={selectedAIModel} 
              onChange={(e) => setSelectedAIModel(e.target.value)}
            >
              <option value="google/gemini-3-flash-preview">google/gemini-3-flash-preview</option>
              <option value="anthropic/claude-opus-4.6">anthropic/claude-opus-4.6</option>
              <option value="x-ai/grok-4.1-fast">x-ai/grok-4.1-fast</option>
              <option value="x-ai/grok-4.20">x-ai/grok-4.20</option>
              <option value="moonshotai/kimi-k2.5">moonshotai/kimi-k2.5</option>
            </select>
            <button className={styles.themeToggle} onClick={toggleTheme} aria-label="Toggle Theme">
              {theme === 'light' ? '● Dark Mode' : '○ Light Mode'}
            </button>
          </div>
        </div>
      </header>

      {/* Top Section: RSS Menu */}
      <section className={styles.ribbon}>
        {feeds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginRight: '1rem', paddingRight: '1rem', borderRight: '1px solid var(--glass-border)' }}>
            <button className={`${styles.chip} ${styles.chipAction}`} onClick={selectAllFeeds}>Select All</button>
            <button className={`${styles.chip} ${styles.chipAction}`} onClick={deselectAllFeeds}>Deselect All</button>
          </div>
        )}
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
              {signal.imageUrl && (
                <div className={styles.cardImageContainer}>
                  <img src={signal.imageUrl} alt={signal.title} className={styles.cardImage} />
                </div>
              )}
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{signal.title}</h3>
                <span className={styles.cardSource}>{feedName}</span>
              </div>
              <p className={styles.cardSummary}>{signal.summary}</p>
              
              {!drafts && (
                  <div className={styles.cardActions}>
                   <div className={styles.actionGroup}>
                     <select
                       className={styles.modeSelect}
                       value={selectedMode[signal.id] || 'INFORMATION'}
                       onChange={(e) => setSelectedMode(prev => ({ ...prev, [signal.id]: e.target.value }))}
                       disabled={isProcessing}
                     >
                       <option value="INFORMATION">Info Mode</option>
                       <option value="FOUNDER">Founder Mode</option>
                     </select>
                     <button
                       className={styles.btnActionSecondary}
                       onClick={() => openArticleReader(signal)}
                       title="View Source Text"
                     >
                       🌐 Read
                     </button>
                   </div>
                   <button 
                     className={styles.btnSynthesize} 
                     onClick={() => synthesizeSignal(signal.id, selectedMode[signal.id] || 'INFORMATION')}
                     disabled={isProcessing}
                   >
                     {isProcessing ? '⚡ Generating...' : 'Synthesize ✨'}
                   </button>
                 </div>
              )}

              {/* Bottom Section: Draft Terminal */}
              {drafts && (
                 <div className={styles.draftTerminal}>
                   {drafts.map(d => (
                     <div key={d.id} className={styles.draftBox}>
                       <span className={styles.draftPlatform}>{d.platform}</span>

                       {editingDraftId === d.id ? (
                         <div className={styles.editContainer}>
                           <textarea 
                             className={styles.editTextArea} 
                             value={editBody} 
                             onChange={(e) => setEditBody(e.target.value)}
                           />
                           <div className={styles.publishActions} style={{marginTop: 0}}>
                             <button className={styles.btnPublishX} onClick={() => saveEdit(signal.id, d.id)}>Save Changes</button>
                             <button className={styles.btnCopy} onClick={() => setEditingDraftId(null)}>Cancel</button>
                           </div>
                         </div>
                       ) : (
                         <>
                           {d.mediaUrl && (
                             <div className={styles.draftMediaWrapper}>
                               <img src={d.mediaUrl} alt="Attached Media" className={styles.draftMediaImage} />
                               <div className={styles.draftMediaOverlay}>
                                 <a href={d.mediaUrl} target="_blank" rel="noreferrer" download="atlas-visual.png" className={styles.btnActionSecondary}>
                                   ⬇️ Download
                                 </a>
                               </div>
                             </div>
                           )}
                           <p className={styles.draftBody}>{d.body}</p>
                           <div className={styles.publishActions}>
                             <button 
                               className={styles.btnCopy} 
                               onClick={() => {
                                 setEditingDraftId(d.id);
                                 setEditBody(d.body);
                               }}
                             >
                               ✎ Edit
                             </button>
                             <button 
                               className={`${styles.btnPublish} ${d.platform === 'x' ? styles.btnPublishX : styles.btnPublishLn}`}
                               onClick={() => triggerPublish(d.id, d.platform, signal.id)}
                             >
                               Post to {d.platform === 'x' ? 'X' : 'LinkedIn'}
                             </button>
                             <button 
                               className={styles.btnCopy} 
                               onClick={() => copyToClipboard(d.body, d.id)}
                             >
                               {copiedId === d.id ? '✓ Copied!' : 'Copy'}
                             </button>
                           </div>
                         </>
                       )}
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

      {/* Deep-Web Article Viewer Modal */}
      {readingSignal && (
        <div className={styles.modalOverlay} onClick={() => setReadingSignal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{readingSignal.title}</h2>
              <button className={styles.modalClose} onClick={() => setReadingSignal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {isArticleLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
                  <p>🕸️ Fetching raw deep-web markdown...</p>
                </div>
              ) : (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {articleMarkdown}
                </pre>
              )}
            </div>
            <div className={styles.modalFooter}>
               <a href={readingSignal.url} target="_blank" rel="noreferrer" className={styles.btnPublish}>
                 Open Original URL
               </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
