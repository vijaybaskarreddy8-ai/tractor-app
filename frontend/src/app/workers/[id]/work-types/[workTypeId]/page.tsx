'use client';

import { useEffect, useState, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import FAB from '@/components/FAB';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import BottomNav from '@/components/BottomNav';
import SyncIndicator from '@/components/SyncIndicator';
import { useSyncStatus, useOfflineMutation } from '@/lib/offline/hooks';
import { shareWorkLog } from '@/lib/share';

interface Entry {
  _id: string;
  date: string; // ISO date string
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  note?: string | null;
}

interface WorkTypeData {
  _id: string;
  name: string;
  hourlyRate: number | null;
  workerId: string;
}

interface WorkerData {
  _id: string;
  name: string;
}

interface WorkTypeDetailPageProps {
  params: Promise<{
    [key: string]: string | undefined;
    id: string;
    workTypeId: string;
  }>;
}

export default function WorkTypeDetailPage({ params }: WorkTypeDetailPageProps) {
  const resolvedParams = use(params);
  const workerId = resolvedParams.id;
  const workTypeId = resolvedParams.workTypeId;

  const t = useTranslations();
  const router = useRouter();
  
  const [worker, setWorker] = useState<WorkerData | null>(null);
  const [workType, setWorkType] = useState<WorkTypeData | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [note, setNote] = useState('');

  // Editing state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNote, setEditNote] = useState('');

  // Edit/Delete Work Type states
  const [isEditWTOpen, setIsEditWTOpen] = useState(false);
  const [editWTName, setEditWTName] = useState('');
  const [showHourlyRate, setShowHourlyRate] = useState(false);
  const [editWTRate, setEditWTRate] = useState('');
  const [isDeleteWTOpen, setIsDeleteWTOpen] = useState(false);

  // Warning/confirm states
  const [showMidnightAlert, setShowMidnightAlert] = useState(false);
  const [showOverlapWarning, setShowOverlapWarning] = useState(false);

  const [isPending, startTransition] = useTransition();

  const { status, pendingCount } = useSyncStatus();
  const performMutation = useOfflineMutation();

  const fetchData = async () => {
    try {
      // Fire all 3 requests in parallel
      const [workerRes, wtRes, entriesRes] = await Promise.all([
        fetch(`/api/workers/${workerId}`),
        fetch(`/api/work-types/${workTypeId}`),
        fetch(`/api/entries?workTypeId=${workTypeId}`),
      ]);

      if (workerRes.ok) {
        setWorker(await workerRes.json());
      }

      if (wtRes.ok) {
        const wtData = await wtRes.json();
        setWorkType(wtData);
        setEditWTName(wtData.name);
        setShowHourlyRate(wtData.hourlyRate !== null);
        setEditWTRate(wtData.hourlyRate !== null ? wtData.hourlyRate.toString() : '');
      } else {
        router.push(`/workers/${workerId}`);
        return;
      }

      if (entriesRes.ok) {
        setEntries(await entriesRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch work type details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleSyncChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'synced') {
        fetchData();
      }
    };
    window.addEventListener('sync-status-changed', handleSyncChange);
    return () => window.removeEventListener('sync-status-changed', handleSyncChange);
  }, [workerId, workTypeId]);

  // Format 24h string to 12h representation for display
  const format12h = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = m.toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
  };

  // Convert ISO Date back to local DD-MM-YYYY
  const formatDateString = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Check midnight crossing and overlap alerts
  useEffect(() => {
    if (startTime && endTime) {
      setShowMidnightAlert(startTime >= endTime);
    }
  }, [startTime, endTime]);

  const handleAddEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const body = {
        workTypeId,
        date: entryDate,
        startTime,
        endTime,
        note,
      };

      const result = await performMutation('POST', '/api/entries', body, () => {
        // Compute optimistic duration
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff <= 0) diff += 24 * 60;

        const optimisticEntry: Entry = {
          _id: 'temp-' + Date.now(),
          date: new Date(entryDate).toISOString(),
          startTime,
          endTime,
          durationMinutes: diff,
          note: note.trim() || null,
        };

        setEntries((prev) => {
          const updated = [...prev, optimisticEntry];
          return updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
      });

      if (result.success && result.data?.hasOverlap) {
        alert(t('entry.overlapWarning'));
      }

      setIsAddOpen(false);
      setNote('');
      setEntryDate(new Date().toISOString().split('T')[0]);
      
      if (!result.offline) {
        fetchData();
      }
    });
  };

  const handleEditEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    startTransition(async () => {
      const body = {
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        note: editNote,
      };

      await performMutation('PUT', `/api/entries/${editingEntry._id}`, body, () => {
        const [sh, sm] = editStartTime.split(':').map(Number);
        const [eh, em] = editEndTime.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff <= 0) diff += 24 * 60;

        setEntries((prev) =>
          prev.map((ent) =>
            ent._id === editingEntry._id
              ? {
                  ...ent,
                  date: new Date(editDate).toISOString(),
                  startTime: editStartTime,
                  endTime: editEndTime,
                  durationMinutes: diff,
                  note: editNote.trim() || null,
                }
              : ent
          ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        );
      });

      setEditingEntry(null);
      fetchData();
    });
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;

    startTransition(async () => {
      await performMutation('DELETE', `/api/entries/${editingEntry._id}`, {}, () => {
        setEntries((prev) => prev.filter((ent) => ent._id !== editingEntry._id));
      });
      setEditingEntry(null);
      fetchData();
    });
  };

  const handleEditWorkType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editWTName.trim().length === 0 || !workType) return;

    startTransition(async () => {
      const rate = showHourlyRate && editWTRate ? Number(editWTRate) : null;
      const body = {
        name: editWTName,
        hourlyRate: rate,
      };

      const result = await performMutation('PUT', `/api/work-types/${workTypeId}`, body, () => {
        setWorkType((prev) => prev ? { ...prev, name: editWTName.trim(), hourlyRate: rate } : null);
      });

      setIsEditWTOpen(false);
      if (!result.offline) {
        fetchData();
      }
    });
  };

  const handleDeleteWorkType = async () => {
    if (!workType) return;

    startTransition(async () => {
      const result = await performMutation('DELETE', `/api/work-types/${workTypeId}`, {}, () => {
        router.push(`/workers/${workerId}`);
      });

      setIsDeleteWTOpen(false);
      if (result.success) {
        router.push(`/workers/${workerId}`);
      }
    });
  };

  const handleShare = async () => {
    if (!worker || !workType) return;
    
    // Sort chronological first
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const totalMinSum = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const totalH = Math.floor(totalMinSum / 60);
    const totalM = totalMinSum % 60;
    
    let paymentSum: number | null = null;
    if (workType.hourlyRate !== null) {
      paymentSum = Number(((totalMinSum / 60) * workType.hourlyRate).toFixed(2));
    }

    const shareData = {
      workerName: worker.name,
      workTypeName: workType.name,
      hourlyRate: workType.hourlyRate,
      totalHours: totalH,
      totalMinutes: totalM,
      totalPayment: paymentSum,
      entries: sorted,
    };

    await shareWorkLog(shareData, t);
  };

  // Group entries by Date
  const groupEntriesByDate = () => {
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const groups: { [key: string]: { dateStr: string; entries: Entry[]; subtotalMinutes: number } } = {};

    sorted.forEach((e) => {
      const dateKey = e.date.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateStr: formatDateString(e.date),
          entries: [],
          subtotalMinutes: 0,
        };
      }
      groups[dateKey].entries.push(e);
      groups[dateKey].subtotalMinutes += Number(e.durationMinutes || 0);
    });

    return Object.values(groups);
  };

  const dateGroups = groupEntriesByDate();

  // Grand totals computation — sum up subtotalMinutes from groups to guarantee correctness and handle formatting
  const grandTotalMinutes = dateGroups.reduce((sum, group) => sum + Number(group.subtotalMinutes || 0), 0);
  const grandHours = Math.floor(grandTotalMinutes / 60);
  const grandMinutes = grandTotalMinutes % 60;

  const totalPaymentVal =
    workType?.hourlyRate !== null
      ? ((grandTotalMinutes / 60) * (workType?.hourlyRate || 0)).toFixed(2)
      : null;

  return (
    <>
      <SyncIndicator status={status} pendingCount={pendingCount} />

      <Header
        title={workType ? `${worker?.name} — ${workType.name}` : t('common.loading')}
        showBack
        onBack={() => router.push(`/workers/${workerId}`)}
      >
        {workType && !workType._id.startsWith('temp-') && (
          <>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsEditWTOpen(true)}
              aria-label={t('worker.editWorkType')}
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
              onClick={() => setIsDeleteWTOpen(true)}
              aria-label={t('worker.deleteWorkType')}
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

      <main
        className="main-content"
        style={{
          paddingBottom: 'calc(var(--bottom-nav-height) + 160px)', // space for grand total footer panel
        }}
      >
        {loading ? (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {[1, 2].map((n) => (
              <div key={n} className="card skeleton" style={{ height: '120px', width: '100%' }} />
            ))}
          </div>
        ) : dateGroups.length === 0 ? (
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
              {t('entry.noEntries')}
            </h2>
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-light)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
              {t('entry.noEntriesDesc')}
            </p>
          </div>
        ) : (
          <div style={{ padding: '0 var(--space-4) var(--space-4) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {dateGroups.map((group) => (
              <div
                key={group.dateStr}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {/* Date Header */}
                <h3
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    backgroundColor: 'rgba(27, 67, 50, 0.05)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    alignSelf: 'flex-start',
                  }}
                >
                  {group.dateStr}
                </h3>

                {/* Date Group Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {group.entries.map((ent) => (
                    <div
                      key={ent._id}
                      className="card"
                      onClick={() => {
                        if (!ent._id.startsWith('temp-')) {
                          setEditingEntry(ent);
                          setEditDate(ent.date.split('T')[0]);
                          setEditStartTime(ent.startTime);
                          setEditEndTime(ent.endTime);
                          setEditNote(ent.note || '');
                        }
                      }}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: ent._id.startsWith('temp-') ? 'not-allowed' : 'pointer',
                        opacity: ent._id.startsWith('temp-') ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                          {format12h(ent.startTime)} — {format12h(ent.endTime)}
                        </span>
                        <span className="badge" style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}>
                          {t('entry.duration', {
                            hours: Math.floor(ent.durationMinutes / 60),
                            minutes: ent.durationMinutes % 60,
                          })}
                        </span>
                      </div>
                      {ent.note && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-medium)', italic: 'true' } as any}>
                          {t('entry.note')}: {ent.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Subtotal */}
                <div style={{ textAlign: 'right', paddingRight: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', fontWeight: 600 }}>
                  {t('entry.dayTotal')}: {Math.floor(group.subtotalMinutes / 60)}h {group.subtotalMinutes % 60}m
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Grand Total Sticky Footer Card with Action Buttons integrated to avoid overlapping */}
      <div
        style={{
          position: 'fixed',
          bottom: 'var(--bottom-nav-height)',
          left: 0,
          right: 0,
          backgroundColor: 'var(--color-primary)',
          color: '#FFFFFF',
          padding: 'var(--space-4) var(--space-6)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          zIndex: 850,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              {t('entry.grandTotal')}:
            </span>
            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {grandHours}h {grandMinutes}m
            </span>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleShare}
                className="btn"
                style={{
                  minHeight: '40px',
                  height: '40px',
                  padding: '0 var(--space-3)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 'var(--text-sm)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <span>{t('entry.share')}</span>
              </button>
            )}

            {workType && !workType._id.startsWith('temp-') && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="btn"
                style={{
                  minHeight: '40px',
                  height: '40px',
                  padding: '0 var(--space-4)',
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  fontSize: 'var(--text-sm)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{t('entry.addEntry')}</span>
              </button>
            )}
          </div>
        </div>

        {workType?.hourlyRate !== null && totalPaymentVal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', fontWeight: 600 }}>{t('entry.totalPayment')}:</span>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-accent)' }}>
              ₹{totalPaymentVal}
            </span>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t('entry.addEntry')}>
        <form onSubmit={handleAddEntrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="entry-date" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('entry.date')}
            </label>
            <input
              id="entry-date"
              type="date"
              className="input"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="start-time" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('entry.startTime')}
              </label>
              <input
                id="start-time"
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="end-time" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('entry.endTime')}
              </label>
              <input
                id="end-time"
                type="time"
                className="input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {showMidnightAlert && (
            <div style={{ color: 'var(--color-warning)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{t('entry.midnightCrossing')}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="entry-note" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('entry.note')}
            </label>
            <input
              id="entry-note"
              type="text"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('entry.notePlaceholder')}
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

      {/* Edit Entry Modal */}
      <Modal isOpen={editingEntry !== null} onClose={() => setEditingEntry(null)} title={t('entry.editEntry')}>
        {editingEntry && (
          <form onSubmit={handleEditEntrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="edit-entry-date" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('entry.date')}
              </label>
              <input
                id="edit-entry-date"
                type="date"
                className="input"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label htmlFor="edit-start-time" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                  {t('entry.startTime')}
                </label>
                <input
                  id="edit-start-time"
                  type="time"
                  className="input"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label htmlFor="edit-end-time" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                  {t('entry.endTime')}
                </label>
                <input
                  id="edit-end-time"
                  type="time"
                  className="input"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  required
                  disabled={isPending}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="edit-entry-note" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('entry.note')}
              </label>
              <input
                id="edit-entry-note"
                type="text"
                className="input"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('entry.notePlaceholder')}
                disabled={isPending}
              />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: '1 1 100%', minHeight: '48px', order: 3 }}
                onClick={handleDeleteEntry}
                disabled={isPending}
              >
                {t('common.delete')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: '1' }}
                onClick={() => setEditingEntry(null)}
                disabled={isPending}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: '1' }}
                disabled={isPending}
              >
                {isPending ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Work Type Modal */}
      <Modal isOpen={isEditWTOpen} onClose={() => setIsEditWTOpen(false)} title={t('worker.editWorkType')}>
        <form onSubmit={handleEditWorkType} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="edit-wt-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
              {t('worker.workTypeName')}
            </label>
            <input
              id="edit-wt-name"
              type="text"
              className="input"
              value={editWTName}
              onChange={(e) => setEditWTName(e.target.value)}
              placeholder={t('worker.workTypeNamePlaceholder')}
              autoFocus
              required
              disabled={isPending}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 'var(--space-2) 0' }}>
            <input
              id="edit-add-wage"
              type="checkbox"
              style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
              checked={showHourlyRate}
              onChange={(e) => setShowHourlyRate(e.target.checked)}
              disabled={isPending}
            />
            <label htmlFor="edit-add-wage" style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none' }}>
              {t('worker.addWageRate')}
            </label>
          </div>

          {showHourlyRate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <label htmlFor="edit-hourly-rate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-medium)' }}>
                {t('worker.hourlyRate')}
              </label>
              <input
                id="edit-hourly-rate"
                type="number"
                inputMode="decimal"
                className="input"
                value={editWTRate}
                onChange={(e) => setEditWTRate(e.target.value)}
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
              onClick={() => setIsEditWTOpen(false)}
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

      {/* Delete Work Type Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteWTOpen}
        onConfirm={handleDeleteWorkType}
        onCancel={() => setIsDeleteWTOpen(false)}
        title={t('worker.deleteWorkType')}
        message={t('worker.deleteWorkTypeConfirm', { name: workType?.name || '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <BottomNav />
    </>
  );
}
