'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import FAB from '@/components/FAB';
import Modal from '@/components/Modal';
import BottomNav from '@/components/BottomNav';
import SyncIndicator from '@/components/SyncIndicator';
import InstallPrompt from '@/components/InstallPrompt';
import { useSyncStatus, useOfflineMutation } from '@/lib/offline/hooks';

interface Worker {
  _id: string;
  name: string;
  totalHours: number;
  totalMins: number;
  matchType?: 'worker' | 'workType';
  matchedWorkTypes?: Array<{ _id: string; name: string }>;
}

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Worker[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Add worker state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [isPending, startTransition] = useTransition();

  const { status, pendingCount } = useSyncStatus();
  const performMutation = useOfflineMutation();

  const fetchWorkers = async () => {
    try {
      const res = await fetch('/api/workers');
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (error) {
      console.error('Failed to fetch workers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    
    // Refresh when sync completes
    const handleSyncChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'synced') {
        fetchWorkers();
      }
    };
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, []);

  // Search effect
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults(null);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/workers/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // We also need to fetch/match hours for these search results
          const enriched = data.map((searchedWorker: any) => {
            const match = workers.find((w) => w._id === searchedWorker._id);
            return {
              ...searchedWorker,
              totalHours: match?.totalHours || 0,
              totalMins: match?.totalMins || 0,
            };
          });
          setSearchResults(enriched);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, workers]);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newWorkerName.trim().length === 0) return;

    startTransition(async () => {
      const body = { name: newWorkerName };
      
      const result = await performMutation('POST', '/api/workers', body, () => {
        // Optimistic update
        const tempId = 'temp-' + Date.now();
        const optimisticWorker: Worker = {
          _id: tempId,
          name: newWorkerName.trim(),
          totalHours: 0,
          totalMins: 0,
        };
        setWorkers((prev) => [...prev, optimisticWorker]);
      });

      if (result.success && !result.offline) {
        setWorkers((prev) => {
          // Remove temp and add actual
          const filtered = prev.filter((w) => !w._id.startsWith('temp-'));
          return [...filtered, result.data];
        });
      }

      setNewWorkerName('');
      setIsAddOpen(false);
      
      if (!result.offline) {
        fetchWorkers();
      }
    });
  };

  const displayedWorkers = searchResults !== null ? searchResults : workers;
  const showEmptyState = displayedWorkers.length === 0 && !loading;

  return (
    <>
      <SyncIndicator status={status} pendingCount={pendingCount} />
      
      <Header title={t('common.appName')} />

      <main className="main-content" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-8))' }}>
        <div style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('home.searchPlaceholder')}
          />
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="card skeleton" style={{ height: '88px', width: '100%' }} />
            ))}
          </div>
        ) : showEmptyState ? (
          <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: 'rgba(27, 67, 50, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--space-4)',
                color: 'var(--color-primary-light)',
              }}
            >
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
              {searchQuery ? t('common.noData') : t('home.noWorkers')}
            </h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-light)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              {searchQuery ? '' : t('home.noWorkersDesc')}
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: '0 var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}
          >
            {displayedWorkers.map((worker) => (
              <div
                key={worker._id}
                className="card"
                onClick={() => {
                  if (!worker._id.startsWith('temp-')) {
                    router.push(`/workers/${worker._id}`);
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'between',
                  alignItems: 'center',
                  cursor: worker._id.startsWith('temp-') ? 'not-allowed' : 'pointer',
                  opacity: worker._id.startsWith('temp-') ? 0.7 : 1,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {worker.name}
                  </span>
                  
                  {worker.matchedWorkTypes && worker.matchedWorkTypes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {worker.matchedWorkTypes.map((wt) => (
                        <span
                          key={wt._id}
                          className="badge"
                          style={{ fontSize: 'var(--text-xs)', backgroundColor: 'rgba(233, 163, 25, 0.15)', color: 'var(--color-accent-dark)' }}
                        >
                          {wt.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="badge">
                    {t('home.totalHours', {
                      hours: worker.totalHours,
                      minutes: worker.totalMins,
                    })}
                  </span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--color-text-light)' }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <FAB onClick={() => setIsAddOpen(true)} label={t('home.addWorker')} />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t('home.addWorker')}>
        <form onSubmit={handleAddWorker} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="worker-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('home.workerName')}
            </label>
            <input
              id="worker-name"
              type="text"
              className="input"
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              placeholder={t('home.workerNamePlaceholder')}
              autoFocus
              required
              disabled={isPending}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsAddOpen(false)}
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

      <InstallPrompt />
      <BottomNav />
    </>
  );
}
