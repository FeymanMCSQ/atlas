'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function ResonanceLab() {
  const [viralText, setViralText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTemplate, setLastTemplate] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    fetch('/api/resonance/report')
      .then(r => r.json())
      .then(data => { if (data.success) setReports(data.reports); })
      .catch(() => {})
      .finally(() => setLoadingReports(false));
  }, []);

  const handleDeconstruct = async () => {
    if (!viralText || viralText.length < 20) return;
    setIsProcessing(true);
    setLastTemplate(null);
    try {
      const res = await fetch('/api/resonance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viralPostText: viralText })
      });
      const data = await res.json();
      if (data.success) {
        setLastTemplate(data.template);
        setViralText('');
      } else {
        alert(data.error || 'Failed to tear down post');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to Resonance Engine.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTestCircuit = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/resonance/test');
      const data = await res.json();
      if (data.error) {
        alert(`Circuit Failed: ${data.details}`);
      } else {
        console.log("Resonance Circuit Result:", data.steps);
        const latestStep = data.steps[data.steps.length - 1];
        if (latestStep.status === 'SKIPPED_EMPTY_DB') {
          alert('Circuit Test Complete:\n\nStep 1: 0 Templates Found.\nStep 2: Injection aborted.\n\nResult: The database is empty. You need to inject a template first!');
        } else {
          alert(`Circuit Test Complete:\n\nStep 1 Found: ${data.steps[0].count} templates.\nStep 2 Selected: ${data.steps[1].selectedName}\n\nStep 3 Injected Override:\n${data.steps[2].injectedString}`);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Network Error testing circuit.');
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h1 className={styles.title}>The Resonance Engine 🔬</h1>
              <div style={{display: 'flex', gap: '1rem'}}>
                <button 
                   className={styles.btnLaunch} 
                   style={{padding: '0.8rem 1.5rem', fontSize: '0.9rem', backgroundColor: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1'}}
                   onClick={handleTestCircuit}
                   disabled={isProcessing}
                >
                  {isProcessing ? '⚙️ Running...' : '🔧 Test Circuit'}
                </button>
                <a href="/" style={{textDecoration: 'none'}}>
                  <button className={styles.btnLaunch} style={{padding: '0.8rem 1.5rem', fontSize: '0.9rem'}}>Back to Atlas ⬅️</button>
                </a>
              </div>
            </div>

            <p className={styles.subtitle}>
              Reverse-engineer viral social media psychology. Paste a highly-successful post from X or LinkedIn below. Claude-Opus-4.6 will extract the psychological hook, pacing, and formatting structure, permanently saving it for Atlas Content Brain to mimic.
            </p>
        </div>

        <div className={styles.content}>
            <div className={styles.inputSection}>
               <textarea
                 className={styles.textarea}
                 placeholder="Paste a viral post here (e.g. '3 hard truths about AI SaaS nobody wants to admit...')"
                 value={viralText}
                 onChange={(e) => setViralText(e.target.value)}
                 disabled={isProcessing}
               />
               <button 
                 className={styles.btnLaunch} 
                 onClick={handleDeconstruct}
                 disabled={isProcessing || viralText.length < 20}
               >
                 {isProcessing ? '⚡ Deconstructing Psychology...' : 'Initiate Reverse Engineering 🧬'}
               </button>
            </div>

            {lastTemplate && (
              <div className={styles.resultsPanel}>
                <div className={styles.resultHeader}>
                   <h2>✅ Reverse-Engineering Complete</h2>
                   <span className={styles.templateName}>{lastTemplate.name}</span>
                </div>
                
                <div className={styles.grid}>
                   <div className={styles.card}>
                     <h3 className={styles.cardHeader}>🪝 Hook Archetype</h3>
                     <p className={styles.cardBody}>{lastTemplate.hookArchetype}</p>
                   </div>
                   <div className={styles.card}>
                     <h3 className={styles.cardHeader}>📏 Format Structure</h3>
                     <p className={styles.cardBody}>{lastTemplate.formatStructure}</p>
                   </div>
                   <div className={styles.card}>
                     <h3 className={styles.cardHeader}>⏱️ Pacing & Rhythm</h3>
                     <p className={styles.cardBody}>{lastTemplate.pacing}</p>
                   </div>
                </div>

                <div className={styles.fullCard}>
                    <h3 className={styles.cardHeader}>🧬 Reconstructed Placeholder Example</h3>
                    <p className={styles.cardBody}>{lastTemplate.examples}</p>
                </div>
                
                <div className={styles.successMessage}>
                    This generic template has been securely injected into the PostgreSQL <code>PostTemplate</code> database. Atlas Content Brain will now randomly clone this format when synthesizing future news.
                </div>
              </div>
            )}

            {/* ── Automated Daily Hunt Reports ── */}
            <div className={styles.reportSection}>
              <h2 className={styles.reportTitle}>🎯 Automated X-Factor Hunt — Daily Reports</h2>
              <p className={styles.reportSubtitle}>
                Every day at 6 AM, Atlas autonomously searches Google for structurally-excellent LinkedIn posts, 
                scores each one with Claude-Opus-4.6 on Hook Strength, Reach Independence, and Engagement Architecture, 
                then injects qualifying posts (score ≥ 7.5/10) into the Resonance Engine.
              </p>

              {loadingReports ? (
                <p style={{ color: 'var(--text-secondary)', padding: '2rem 0' }}>Loading reports...</p>
              ) : reports.length === 0 ? (
                <div className={styles.emptyReport}>
                  <p>⏳ No hunt reports yet. The first X-Factor Hunt runs at 6 AM EST tomorrow.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.6 }}>
                    You can also trigger a manual test run from the backend logs.
                  </p>
                </div>
              ) : (
                <div className={styles.reportList}>
                  {reports.map((report) => {
                    const items = report.reportItems as any[];
                    const injected = items.filter((i: any) => i.injected);
                    return (
                      <div key={report.id} className={styles.reportCard}>
                        <div className={styles.reportCardHeader}>
                          <span className={styles.reportDate}>📅 {report.date}</span>
                          <span className={styles.reportStats}>
                            {report.postsAnalyzed} analyzed → <strong>{report.postsInjected} injected</strong>
                          </span>
                        </div>
                        <div className={styles.reportItems}>
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className={`${styles.reportItem} ${item.injected ? styles.reportItemInjected : ''}`}>
                              <div className={styles.reportItemScore}>
                                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.score}/10</span>
                                {item.injected && <span className={styles.injectedBadge}>✅ INJECTED</span>}
                              </div>
                              <div className={styles.reportItemBody}>
                                <a href={item.url} target="_blank" rel="noreferrer" className={styles.reportItemUrl}>
                                  {item.title || item.url}
                                </a>
                                <p className={styles.reportItemHook}>Hook: <em>{item.hookArchetype}</em></p>
                                <p className={styles.reportItemWhy}>{item.whyItHelps}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </main>
    </div>
  );
}
