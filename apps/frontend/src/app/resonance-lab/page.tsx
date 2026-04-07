'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function ResonanceLab() {
  const [viralText, setViralText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTemplate, setLastTemplate] = useState<any>(null);

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

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h1 className={styles.title}>The Resonance Engine 🔬</h1>
              <a href="/" style={{textDecoration: 'none'}}>
                <button className={styles.btnLaunch} style={{padding: '0.8rem 1.5rem', fontSize: '0.9rem'}}>Back to Atlas ⬅️</button>
              </a>
            </div>
            <p className={styles.subtitle}>
              Reverse-engineer viral social media psychology. Paste a highly-successful post from X or LinkedIn below. Claude-3-Opus will extract the psychological hook, pacing, and formatting structure, permanently saving it for Atlas Content Brain to mimic.
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
                    This generic template has been securely injected into the PostgreSQL <code>PostTemplate</code> database. Atlas Content Brain will now randomly clone this format when synthesizing future news. You successfully stole their strategy without learning marketing!
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
