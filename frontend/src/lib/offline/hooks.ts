'use client';

import { useState, useEffect, useCallback } from 'react';
import { getQueueCount, addToQueue } from './queue';
import { processSyncQueue } from './sync';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export type SyncState = 'synced' | 'pending' | 'syncing' | 'offline';

export function useSyncStatus() {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState<SyncState>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await getQueueCount();
    setPendingCount(count);
    if (!isOnline) {
      setStatus('offline');
    } else if (count > 0) {
      setStatus('pending');
    } else {
      setStatus('synced');
    }
  }, [isOnline]);

  useEffect(() => {
    refreshCount();

    const handleQueueUpdate = () => {
      refreshCount();
    };

    const handleSyncStatusChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as SyncState;
      setStatus(detail);
      refreshCount();
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-status-changed', handleSyncStatusChange);

    return () => {
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-status-changed', handleSyncStatusChange);
    };
  }, [refreshCount]);

  const triggerSync = useCallback(() => {
    if (isOnline) {
      processSyncQueue(setPendingCount);
    }
  }, [isOnline]);

  return { status, pendingCount, triggerSync };
}

export function useOfflineMutation() {
  const isOnline = useOnlineStatus();

  const performMutation = useCallback(
    async (
      method: 'POST' | 'PUT' | 'DELETE',
      url: string,
      body: any,
      optimisticAction?: () => void
    ) => {
      // If client is offline, queue it immediately and run optimistic UI changes
      if (!isOnline) {
        if (optimisticAction) optimisticAction();
        await addToQueue(method, url, body);
        return { offline: true, success: true };
      }

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          return { offline: false, success: true, data: await res.json() };
        } else {
          // If server failed, let the caller handle it.
          // Or queue it if it was a network failure that look like a 5xx or server timeout
          if (res.status >= 500) {
            if (optimisticAction) optimisticAction();
            await addToQueue(method, url, body);
            return { offline: true, success: true };
          }
          return { offline: false, success: false, status: res.status };
        }
      } catch (err) {
        // Fetch failed (network drop or timeout) -> queue it
        console.warn('Network call failed, queueing request offline:', err);
        if (optimisticAction) optimisticAction();
        await addToQueue(method, url, body);
        return { offline: true, success: true };
      }
    },
    [isOnline]
  );

  return performMutation;
}
