'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition, useEffect } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Modal from '@/components/Modal';
import SyncIndicator from '@/components/SyncIndicator';
import { useSyncStatus } from '@/lib/offline/hooks';

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [hasDeletePin, setHasDeletePin] = useState(false);
  const [isDeletePinOpen, setIsDeletePinOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const { status, pendingCount } = useSyncStatus();

  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const fetchDeletePinStatus = async () => {
    try {
      const res = await fetch('/api/delete-pin/status');
      if (res.ok) {
        const data = await res.json();
        setHasDeletePin(data.hasPin);
      }
    } catch (e) {
      console.error('Failed to fetch delete pin status:', e);
    }
  };

  useEffect(() => {
    fetchDeletePinStatus();

    // Check if running as standalone PWA
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(!!isStandaloneMode);

    // Check if deferredPrompt is already set globally
    if ((window as any).deferredPrompt) {
      setIsInstallable(true);
    }

    const handlePwaInstallable = () => {
      setIsInstallable(true);
    };
    window.addEventListener('pwa-installable', handlePwaInstallable);
    return () => {
      window.removeEventListener('pwa-installable', handlePwaInstallable);
    };
  }, []);

  const handleInstallApp = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    if (choiceResult.outcome === 'accepted') {
      (window as any).deferredPrompt = null;
      setIsInstallable(false);
    }
  };

  const handleLanguageChange = async (locale: string) => {
    startTransition(async () => {
      try {
        await fetch('/api/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        setIsLangOpen(false);
        router.refresh();
      } catch (error) {
        console.error('Failed to change language:', error);
      }
    });
  };

  const handleUpdateDeletePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('New PIN must be 4 to 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError(t('pin.mismatch'));
      return;
    }

    startTransition(async () => {
      setPinError(null);
      try {
        const res = await fetch('/api/delete-pin/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newPin,
            currentPin: hasDeletePin ? currentPin : undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert('Delete protection PIN saved successfully!');
          setIsDeletePinOpen(false);
          setCurrentPin('');
          setNewPin('');
          setConfirmNewPin('');
          fetchDeletePinStatus();
        } else {
          setPinError(data.error || 'Failed to save PIN.');
        }
      } catch (error) {
        setPinError('Network error. Failed to save PIN.');
      }
    });
  };

  const handleSignOut = async () => {
    startTransition(async () => {
      await signOut({ callbackUrl: '/login' });
    });
  };

  return (
    <>
      <SyncIndicator status={status} pendingCount={pendingCount} />
      
      <Header title={t('settings.title')} />

      <main className="main-content" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-8))' }}>
        
        {/* Language Selection Section */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {t('settings.language')}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600 }}>{t('settings.changeLanguage')}</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
                {t('language.subtitle')}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsLangOpen(true)}
            >
              Change
            </button>
          </div>
        </section>

        {/* PWA App Installation Section */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {t('settings.pwaTitle')}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 'var(--space-2)' }}>
              <p style={{ fontWeight: 600 }}>
                {isStandalone ? t('settings.pwaInstalled') : t('settings.pwaSubtitle')}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
                {isStandalone ? '✅ standalone app' : 'Add to home screen for quick offline access'}
              </p>
            </div>
            {isStandalone ? (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 700 }}>
                Installed
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleInstallApp}
                style={{ padding: '0 var(--space-4)', minHeight: '40px', height: '40px', fontSize: 'var(--text-sm)' }}
              >
                {t('settings.pwaInstallBtn')}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowInstructions(true)}
                style={{ padding: '0 var(--space-4)', minHeight: '40px', height: '40px', fontSize: 'var(--text-sm)' }}
              >
                {t('settings.pwaInstructions')}
              </button>
            )}
          </div>
        </section>

        {/* Delete PIN Protection Section */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {t('settings.deleteSecurity')}
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 'var(--space-2)' }}>
              <p style={{ fontWeight: 600 }}>
                {hasDeletePin ? t('settings.changeDeletePin') : t('settings.setUpDeletePin')}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>
                {t('settings.deletePinSubtitle')}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPinError(null);
                setCurrentPin('');
                setNewPin('');
                setConfirmNewPin('');
                setIsDeletePinOpen(true);
              }}
            >
              {hasDeletePin ? 'Update' : 'Setup'}
            </button>
          </div>
        </section>

        {/* Account Section */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {t('settings.account')}
          </h2>
          <div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)' }}>{t('settings.signedInAs')}</p>
            <p style={{ fontWeight: 600, wordBreak: 'break-all' }}>{session?.user?.email || 'Owner Account'}</p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            style={{ width: '100%' }}
            onClick={handleSignOut}
            disabled={isPending}
          >
            {t('settings.signOut')}
          </button>
        </section>

        {/* About App Section */}
        <section style={{ textAlign: 'center', marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>
            {t('common.appName')}
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
            {t('settings.appDescription')}
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-light)', marginTop: '8px' }}>
            {t('settings.version')}: 1.0.0
          </p>
        </section>
      </main>

      {/* Language Modal */}
      <Modal isOpen={isLangOpen} onClose={() => setIsLangOpen(false)} title={t('settings.language')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between', padding: 'var(--space-4)' }}
            onClick={() => handleLanguageChange('en')}
            disabled={isPending}
          >
            <span>English</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'space-between', padding: 'var(--space-4)', fontFamily: 'var(--font-telugu), sans-serif' }}
            onClick={() => handleLanguageChange('te')}
            disabled={isPending}
          >
            <span>తెలుగు</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </Modal>

      {/* Delete PIN Modal */}
      <Modal isOpen={isDeletePinOpen} onClose={() => setIsDeletePinOpen(false)} title={hasDeletePin ? t('settings.changeDeletePin') : t('settings.setUpDeletePin')}>
        <form onSubmit={handleUpdateDeletePin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {hasDeletePin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="current-pin" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('settings.currentPin')}
              </label>
              <input
                id="current-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
                required
                disabled={isPending}
                style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: 'var(--text-md)' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="new-pin" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('settings.newPin')}
            </label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 4-6 digit PIN"
              required
              disabled={isPending}
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: 'var(--text-md)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="confirm-new-pin" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('settings.confirmNewPin')}
            </label>
            <input
              id="confirm-new-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input"
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm new PIN"
              required
              disabled={isPending}
              style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: 'var(--text-md)' }}
            />
          </div>

          {pinError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              ⚠ {pinError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsDeletePinOpen(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={isPending}
            >
              {isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* PWA Manual Install Instructions Modal */}
      <Modal isOpen={showInstructions} onClose={() => setShowInstructions(false)} title="📲 How to Install App">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-1)' }}>
          
          <div style={{
            backgroundColor: 'rgba(27, 67, 50, 0.05)',
            borderRadius: 'var(--radius-default)',
            padding: 'var(--space-4)',
            borderLeft: '4px solid var(--color-primary)'
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🤖 Android (Chrome)
            </h3>
            <ol style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Open Chrome browser and visit this website.</li>
              <li>Tap the menu icon (<b>3 dots ⋮</b>) in the top-right corner.</li>
              <li>Select <b>"Add to Home Screen"</b> or <b>"Install App"</b>.</li>
              <li>Follow the prompt to add the icon to your home screen.</li>
            </ol>
          </div>

          <div style={{
            backgroundColor: 'rgba(233, 163, 25, 0.05)',
            borderRadius: 'var(--radius-default)',
            padding: 'var(--space-4)',
            borderLeft: '4px solid var(--color-accent)'
          }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-accent-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🍎 iPhone / iPad (Safari)
            </h3>
            <ol style={{ margin: 'var(--space-2) 0 0 0', paddingLeft: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Open Safari browser and visit this website.</li>
              <li>Tap the <b>Share</b> button (<b>📤 square with arrow pointing up</b>) at the bottom.</li>
              <li>Scroll down and tap <b>"Add to Home Screen"</b>.</li>
              <li>Tap <b>"Add"</b> in the top-right corner to complete.</li>
            </ol>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowInstructions(false)}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            {t('common.done')}
          </button>
        </div>
      </Modal>

      <BottomNav />
    </>
  );
}
