'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LanguagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const selectLanguage = async (locale: string) => {
    setLoading(true);
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Failed to set language:', error);
      setLoading(false);
    }
  };

  return (
    <div className="language-page">
      <div className="language-content">
        <div className="language-icon">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="38" stroke="#1B4332" strokeWidth="3" />
            <path d="M20 40h40M40 20c-8 8-12 16-12 20s4 12 12 20c8-8 12-16 12-20s-4-12-12-20z" stroke="#1B4332" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M22 28h36M22 52h36" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="language-title">Choose your language</h1>
        <p className="language-subtitle">భాషను ఎంచుకోండి</p>

        <div className="language-buttons">
          <button
            className="language-btn"
            onClick={() => selectLanguage('en')}
            disabled={loading}
          >
            <span className="language-btn-text">English</span>
            <span className="language-btn-sub">Continue in English</span>
          </button>

          <button
            className="language-btn"
            onClick={() => selectLanguage('te')}
            disabled={loading}
          >
            <span className="language-btn-text">తెలుగు</span>
            <span className="language-btn-sub">తెలుగులో కొనసాగించండి</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .language-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #40916C 100%);
          padding: var(--space-lg);
        }
        .language-content {
          text-align: center;
          max-width: 400px;
          width: 100%;
        }
        .language-icon {
          margin-bottom: var(--space-xl);
          animation: fadeIn 0.6s ease-out;
        }
        .language-icon svg {
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2));
        }
        .language-icon circle,
        .language-icon path {
          stroke: #FFF8F0;
        }
        .language-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #FFF8F0;
          margin: 0 0 var(--space-xs) 0;
          animation: fadeIn 0.6s ease-out 0.1s both;
        }
        .language-subtitle {
          font-size: 1.25rem;
          color: rgba(255,248,240,0.8);
          margin: 0 0 var(--space-xl) 0;
          font-family: var(--font-telugu), sans-serif;
          animation: fadeIn 0.6s ease-out 0.2s both;
        }
        .language-buttons {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          animation: slideUp 0.5s ease-out 0.3s both;
        }
        .language-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
          padding: var(--space-lg) var(--space-xl);
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }
        .language-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.25);
          border-color: rgba(255,255,255,0.5);
          transform: translateY(-2px);
        }
        .language-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .language-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .language-btn-text {
          font-size: 1.5rem;
          font-weight: 700;
          color: #FFF8F0;
        }
        .language-btn-sub {
          font-size: 0.95rem;
          color: rgba(255,248,240,0.7);
        }
      `}</style>
    </div>
  );
}
