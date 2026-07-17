'use client';

import { useEffect, useState, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import FAB from '@/components/FAB';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import DeletePinModal from '@/components/DeletePinModal';
import BottomNav from '@/components/BottomNav';
import SyncIndicator from '@/components/SyncIndicator';
import { useSyncStatus, useOfflineMutation } from '@/lib/offline/hooks';

interface WorkType {
  _id: string;
  name: string;
  hourlyRate: number | null;
  totalHours: number;
  totalMins: number;
}

interface WorkerData {
  _id: string;
  name: string;
}

interface WorkerPageProps {
  params: Promise<{
    [key: string]: string | undefined;
    id: string;
  }>;
}

export default function WorkerPage({ params }: WorkerPageProps) {
  const resolvedParams = use(params);
  const workerId = resolvedParams.id;

  const t = useTranslations();
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerData | null>(null);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Add work type state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [showHourlyRate, setShowHourlyRate] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');

  // Edit worker state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');

  // Delete worker state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeletePinOpen, setIsDeletePinOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const { status, pendingCount } = useSyncStatus();
  const performMutation = useOfflineMutation();

  const fetchWorkerData = async () => {
    try {
      // Fetch worker + work types in parallel
      const [workerRes, typesRes] = await Promise.all([
        fetch(`/api/workers/${workerId}`),
        fetch(`/api/work-types?workerId=${workerId}`),
      ]);

      if (workerRes.ok) {
        const data = await workerRes.json();
        setWorker(data);
        setEditName(data.name);
      } else {
        router.push('/');
      }

      if (typesRes.ok) {
        setWorkTypes(await typesRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch worker details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerData();

    // Refresh when sync completes
    const handleSyncChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'synced') {
        fetchWorkerData();
      }
    };
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, [workerId]);

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim().length === 0 || !worker) return;

    startTransition(async () => {
      const result = await performMutation(
        'PUT',
        `/api/workers/${workerId}`,
        { name: editName },
        () => {
          setWorker((prev) => prev ? { ...prev, name: editName.trim() } : null);
        }
      );

      setIsEditOpen(false);
      if (!result.offline) {
        fetchWorkerData();
      }
    });
  };

  const handleDeleteWorker = async () => {
    if (!worker) return;

    startTransition(async () => {
      const result = await performMutation(
        'DELETE',
        `/api/workers/${workerId}`,
        {},
        () => {
          router.push('/');
        }
      );

      setIsDeleteOpen(false);
      if (result.success) {
        router.push('/');
      }
    });
  };

  const handleAddWorkType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTypeName.trim().length === 0) return;

    startTransition(async () => {
      const rate = showHourlyRate && hourlyRate ? Number(hourlyRate) : null;
      const body = {
        workerId,
        name: newTypeName,
        hourlyRate: rate,
      };

      const result = await performMutation('POST', '/api/work-types', body, () => {
        // Optimistic update
        const tempId = 'temp-' + Date.now();
        const optimisticType: WorkType = {
          _id: tempId,
          name: newTypeName.trim(),
          hourlyRate: rate,
          totalHours: 0,
          totalMins: 0,
        };
        setWorkTypes((prev) => [...prev, optimisticType]);
      });

      if (result.success && !result.offline) {
        setWorkTypes((prev) => {
          const filtered = prev.filter((wt) => !wt._id.startsWith('temp-'));
          return [...filtered, result.data];
        });
      }

      setNewTypeName('');
      setShowHourlyRate(false);
      setHourlyRate('');
      setIsAddOpen(false);

      if (!result.offline) {
        fetchWorkerData();
      }
    });
  };

  const filteredWorkTypes = workTypes.filter((wt) =>
    wt.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <SyncIndicator status={status} pendingCount={pendingCount} />

      <Header
        title={worker?.name || t('common.loading')}
        showBack
        onBack={() => router.push('/')}
      >
        {worker && !worker._id.startsWith('temp-') && (
          <>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsEditOpen(true)}
              aria-label={t('home.editWorker')}
              style={{ color: 'var(--color-primary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsDeleteOpen(true)}
              aria-label={t('home.deleteWorker')}
              style={{ color: 'var(--color-danger)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </>
        )}
      </Header>

      <main className="main-content" style={{ paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-8))' }}>
        <div style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('worker.searchPlaceholder')}
          />
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2].map((n) => (
              <div key={n} className="card skeleton" style={{ height: '88px', width: '100%' }} />
            ))}
          </div>
        ) : filteredWorkTypes.length === 0 ? (
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
              {searchQuery ? t('common.noData') : t('worker.noWorkTypes')}
            </h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-light)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              {searchQuery ? '' : t('worker.noWorkTypesDesc')}
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
            {filteredWorkTypes.map((wt) => (
              <div
                key={wt._id}
                className="card"
                onClick={() => {
                  if (!wt._id.startsWith('temp-')) {
                    router.push(`/workers/${workerId}/work-types/${wt._id}`);
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'between',
                  alignItems: 'center',
                  cursor: wt._id.startsWith('temp-') ? 'not-allowed' : 'pointer',
                  opacity: wt._id.startsWith('temp-') ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                    {wt.name}
                  </span>
                  {wt.hourlyRate !== null && (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-dark)', fontWeight: 600 }}>
                      ₹{wt.hourlyRate} / hour
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span className="badge">
                    {t('worker.totalHours', {
                      hours: wt.totalHours,
                      minutes: wt.totalMins,
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

      {worker && !worker._id.startsWith('temp-') && (
        <FAB onClick={() => setIsAddOpen(true)} label={t('worker.addWorkType')} />
      )}

      {/* Add Work Type Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t('worker.addWorkType')}>
        <form onSubmit={handleAddWorkType} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="work-type-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('worker.workTypeName')}
            </label>
            <input
              id="work-type-name"
              type="text"
              className="input"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder={t('worker.workTypeNamePlaceholder')}
              autoFocus
              required
              disabled={isPending}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 'var(--space-2) 0' }}>
            <input
              id="add-wage-rate"
              type="checkbox"
              style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
              checked={showHourlyRate}
              onChange={(e) => setShowHourlyRate(e.target.checked)}
              disabled={isPending}
            />
            <label htmlFor="add-wage-rate" style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none' }}>
              {t('worker.addWageRate')}
            </label>
          </div>

          {showHourlyRate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} className="fade-in">
              <label htmlFor="hourly-rate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('worker.hourlyRate')}
              </label>
              <input
                id="hourly-rate"
                type="number"
                inputMode="decimal"
                className="input"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder={t('worker.hourlyRatePlaceholder')}
                required={showHourlyRate}
                disabled={isPending}
              />
            </div>
          )}

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

      {/* Edit Worker Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={t('home.editWorker')}>
        <form onSubmit={handleEditWorker} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="edit-worker-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('home.workerName')}
            </label>
            <input
              id="edit-worker-name"
              type="text"
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
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
              onClick={() => setIsEditOpen(false)}
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

      {/* Delete Worker Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onConfirm={() => {
          setIsDeleteOpen(false);
          setIsDeletePinOpen(true);
        }}
        onCancel={() => setIsDeleteOpen(false)}
        title={t('home.deleteWorker')}
        message={t('home.deleteWorkerConfirm', { name: worker?.name || '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <DeletePinModal
        isOpen={isDeletePinOpen}
        onClose={() => setIsDeletePinOpen(false)}
        onSuccess={handleDeleteWorker}
      />

      <BottomNav />
    </>
  );
}
