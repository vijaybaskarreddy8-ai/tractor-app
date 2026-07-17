'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/Modal';

interface DeletePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called only after PIN is successfully verified or first-time setup completes */
  onSuccess: () => void;
}

type FlowStep =
  | 'loading'
  | 'setup-new'       // first time: enter new PIN
  | 'setup-confirm'   // first time: confirm new PIN
  | 'verify';         // PIN already set: enter to verify

export default function DeletePinModal({ isOpen, onClose, onSuccess }: DeletePinModalProps) {
  const [step, setStep] = useState<FlowStep>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check PIN status whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPin('');
    setConfirmPin('');
    setTempPin('');
    setError(null);
    setStep('loading');

    fetch('/api/auth/delete-pin/status')
      .then((r) => r.json())
      .then((data) => {
        setStep(data.hasPin ? 'verify' : 'setup-new');
      })
      .catch(() => {
        setStep('verify'); // fallback
      });
  }, [isOpen]);

  // Auto-focus input when step changes
  useEffect(() => {
    if (step !== 'loading') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step]);

  const resetAndClose = () => {
    setPin('');
    setConfirmPin('');
    setTempPin('');
    setError(null);
    onClose();
  };

  const handleSetupNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4 to 6 digits.');
      return;
    }
    setTempPin(pin);
    setPin('');
    setError(null);
    setStep('setup-confirm');
  };

  const handleSetupConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== tempPin) {
      setError('PINs do not match. Please try again.');
      setPin('');
      setTempPin('');
      setStep('setup-new');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/delete-pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        resetAndClose();
        onSuccess();
      } else {
        setError(data.error || 'Failed to save PIN. Try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Please enter your delete PIN.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/delete-pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        resetAndClose();
        onSuccess();
      } else {
        setError(data.error || 'Incorrect PIN. Try again.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    if (step === 'loading') return 'Delete Protection';
    if (step === 'setup-new') return '🔐 Set Delete PIN';
    if (step === 'setup-confirm') return '🔐 Confirm PIN';
    return '🔐 Delete PIN';
  };

  const pinDots = (value: string, maxLen = 6) => {
    const filled = Math.min(value.length, maxLen);
    return Array.from({ length: Math.max(filled, 4) }, (_, i) => (
      <div
        key={i}
        style={{
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: i < filled ? 'var(--color-primary)' : 'transparent',
          border: '2px solid',
          borderColor: i < filled ? 'var(--color-primary)' : 'var(--color-text-light)',
          transition: 'all 0.15s ease',
        }}
      />
    ));
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={getTitle()}>
      {step === 'loading' && (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-light)' }}>
          Checking...
        </div>
      )}

      {step === 'setup-new' && (
        <form onSubmit={handleSetupNext} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'rgba(233, 163, 25, 0.1)',
            border: '1px solid var(--color-accent)',
            borderRadius: 'var(--radius-default)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dark)', fontWeight: 600 }}>
              🔒 First-time Setup
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-medium)', marginTop: '4px' }}>
              Create a 4–6 digit PIN to protect deletions. You will need this PIN every time you delete a worker, work type, or entry.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="delete-pin-new" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              New Delete PIN (4–6 digits)
            </label>
            <input
              id="delete-pin-new"
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
              placeholder="Enter PIN"
              required
              disabled={submitting}
              style={{ letterSpacing: '0.3em', fontSize: 'var(--text-lg)', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
              {pinDots(pin)}
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={resetAndClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={pin.length < 4 || submitting}>
              Next →
            </button>
          </div>
        </form>
      )}

      {step === 'setup-confirm' && (
        <form onSubmit={handleSetupConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="delete-pin-confirm" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              Confirm your PIN
            </label>
            <input
              id="delete-pin-confirm"
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
              placeholder="Re-enter PIN"
              required
              disabled={submitting}
              style={{ letterSpacing: '0.3em', fontSize: 'var(--text-lg)', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
              {pinDots(pin)}
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }}
              onClick={() => { setStep('setup-new'); setPin(''); setError(null); }}>
              ← Back
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}
              disabled={pin.length < 4 || submitting}>
              {submitting ? 'Saving...' : 'Save PIN'}
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'rgba(220, 53, 69, 0.07)',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            borderRadius: 'var(--radius-default)',
            padding: 'var(--space-3) var(--space-4)',
          }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 600 }}>
              ⚠ Confirm Deletion
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-medium)', marginTop: '4px' }}>
              Enter your delete PIN to proceed. This action cannot be undone.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="delete-pin-verify" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              Delete PIN
            </label>
            <input
              id="delete-pin-verify"
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
              placeholder="Enter PIN"
              autoComplete="off"
              required
              disabled={submitting}
              style={{ letterSpacing: '0.3em', fontSize: 'var(--text-lg)', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
              {pinDots(pin)}
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={resetAndClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" style={{ flex: 1 }}
              disabled={!pin || submitting}>
              {submitting ? 'Verifying...' : 'Delete'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
