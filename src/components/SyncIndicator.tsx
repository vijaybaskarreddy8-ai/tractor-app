'use client';

import { useEffect, useState } from 'react';

interface SyncIndicatorProps {
  status: 'synced' | 'pending' | 'syncing' | 'offline';
  pendingCount?: number;
}

const statusLabels: Record<SyncIndicatorProps['status'], string> = {
  synced: 'All synced',
  pending: 'pending',
  syncing: 'Syncing...',
  offline: 'Offline',
};

export default function SyncIndicator({
  status,
  pendingCount = 0,
}: SyncIndicatorProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (status === 'synced') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [status]);

  if (!visible) return null;

  const label =
    status === 'pending'
      ? `${pendingCount} ${statusLabels.pending}`
      : statusLabels[status];

  return (
    <div className={`sync-indicator ${status}`} role="status" aria-live="polite">
      <span className="sync-indicator-dot" />
      <span>{label}</span>
    </div>
  );
}
