'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface PinInputProps {
  length: number;
  onComplete: (pin: string) => void;
  error: string | null;
  title: string;
  subtitle?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

export default function PinInput({
  length,
  onComplete,
  error,
  title,
  subtitle,
}: PinInputProps) {
  const [pin, setPin] = useState('');
  const [shaking, setShaking] = useState(false);
  const prevErrorRef = useRef<string | null>(null);

  // Trigger shake animation when error changes to a non-null value
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setShaking(true);
      setPin('');
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }
    prevErrorRef.current = error;
  }, [error]);

  const handleKeyPress = useCallback(
    (digit: string) => {
      setPin((prev) => {
        if (prev.length >= length) return prev;
        const next = prev + digit;
        if (next.length === length) {
          // Slight delay so the user sees the last dot fill
          setTimeout(() => onComplete(next), 150);
        }
        return next;
      });
    },
    [length, onComplete]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        minHeight: '100vh',
      }}
    >
      <h1
        style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h1>

      {subtitle && (
        <p
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-light)',
            textAlign: 'center',
            marginBottom: 'var(--space-8)',
            maxWidth: '300px',
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Dots */}
      <div className={`pin-dots${shaking ? ' shake' : ''}`}>
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`pin-dot${i < pin.length ? ' filled' : ''}`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-danger)',
            marginBottom: 'var(--space-4)',
            textAlign: 'center',
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Numpad */}
      <div className="numpad">
        {KEYS.map((key, i) => {
          if (key === '') {
            return <div key={i} className="numpad-key empty" />;
          }

          if (key === 'backspace') {
            return (
              <button
                key={i}
                type="button"
                className="numpad-key backspace"
                onClick={handleBackspace}
                aria-label="Backspace"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            );
          }

          return (
            <button
              key={i}
              type="button"
              className="numpad-key"
              onClick={() => handleKeyPress(key)}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
