'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, Suspense } from 'react';
import PinInput from '@/components/PinInput';

function PinContent() {
  const t = useTranslations('pin');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'loading' | 'setup' | 'confirm' | 'entry'>('loading');
  const [tempPin, setTempPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    // Check pin status on load
    const checkPinStatus = async () => {
      try {
        const res = await fetch('/api/auth/pin/status');
        if (res.status === 401) {
          // session expired
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.hasPin) {
          setMode('entry');
        } else {
          setMode('setup');
        }
      } catch (err) {
        console.error('Failed to check pin status:', err);
        setErrorMsg('Network error. Please try again.');
      }
    };

    checkPinStatus();
  }, [router]);

  const handleSetupComplete = (pin: string) => {
    setTempPin(pin);
    setSetupError(null);
    setMode('confirm');
  };

  const handleConfirmComplete = async (confirmPin: string) => {
    if (confirmPin !== tempPin) {
      setSetupError(t('mismatch'));
      setMode('setup');
      setTempPin('');
      return;
    }

    try {
      // 1. Setup the PIN
      const setupRes = await fetch('/api/auth/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: confirmPin }),
      });

      if (!setupRes.ok) {
        const errData = await setupRes.json().catch(() => ({}));
        setSetupError(errData.error || 'Failed to set up PIN');
        setMode('setup');
        setTempPin('');
        return;
      }

      // 2. Auto-verify to set cookies
      const verifyRes = await fetch('/api/auth/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: confirmPin }),
      });

      if (verifyRes.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        router.push(callbackUrl);
        router.refresh();
      } else {
        const errData = await verifyRes.json().catch(() => ({}));
        setSetupError(errData.error || 'Verification failed');
        setMode('entry');
      }
    } catch {
      setSetupError('Network error. Failed to save PIN.');
      setMode('setup');
      setTempPin('');
    }
  };

  const handleEntryComplete = async (pin: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/pin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        router.push(callbackUrl);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || t('incorrect'));
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    }
  };

  if (mode === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <PinInput
        length={4}
        onComplete={handleSetupComplete}
        error={setupError}
        title={t('setupTitle')}
        subtitle={t('setupSubtitle')}
      />
    );
  }

  if (mode === 'confirm') {
    return (
      <PinInput
        length={4}
        onComplete={handleConfirmComplete}
        error={setupError}
        title={t('confirmTitle')}
        subtitle={t('confirmSubtitle')}
      />
    );
  }

  return (
    <PinInput
      length={4}
      onComplete={handleEntryComplete}
      error={errorMsg}
      title={t('enterTitle')}
      subtitle={t('enterSubtitle')}
    />
  );
}

export default function PinPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>}>
      <PinContent />
    </Suspense>
  );
}
