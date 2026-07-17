'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
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
  
  const [isPending, startTransition] = useTransition();
  const { status, pendingCount } = useSyncStatus();

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

      <BottomNav />
    </>
  );
}
