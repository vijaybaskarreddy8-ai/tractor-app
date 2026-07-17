'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';

// Extend the global Window to include the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'install-prompt-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const t = useTranslations('install');
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Check if the user previously dismissed the banner
  const isDismissed = useCallback(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const dismissedAt = parseInt(raw, 10);
      if (isNaN(dismissedAt)) return false;
      return Date.now() - dismissedAt < DISMISS_DURATION_MS;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isDismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setVisible(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable
    }
  };

  if (!visible) return null;

  return (
    <div className="install-banner" role="banner">
      <div className="install-banner-text">
        <div className="install-banner-title">{t('title')}</div>
        <div className="install-banner-desc">{t('description')}</div>
      </div>

      <div className="install-banner-actions">
        <button
          type="button"
          className="btn-dismiss"
          onClick={handleDismiss}
        >
          {t('dismiss')}
        </button>
        <button
          type="button"
          className="btn-install"
          onClick={handleInstall}
        >
          {t('install')}
        </button>
      </div>
    </div>
  );
}
