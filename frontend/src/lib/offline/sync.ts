import {
  getQueuedItems,
  removeFromQueue,
  updateQueueItemStatus,
} from './queue';

let isSyncing = false;

export async function processSyncQueue(onProgress?: (pendingCount: number) => void) {
  if (isSyncing) return;
  if (typeof window === 'undefined' || !navigator.onLine) return;

  const items = await getQueuedItems();
  if (items.length === 0) {
    if (onProgress) onProgress(0);
    return;
  }

  isSyncing = true;
  window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'syncing' }));

  // Process sequentially to maintain data relationships (Workers -> WorkTypes -> Entries)
  for (const item of items) {
    try {
      await updateQueueItemStatus(item.id, 'processing');

      const response = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.body),
      });

      if (response.ok) {
        await removeFromQueue(item.id);
      } else {
        // If server rejected (4xx) or server error (5xx)
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        console.error(`Sync failed for item ${item.id}:`, errorData);
        await updateQueueItemStatus(item.id, 'failed', errorData.error);
        
        // Break out of the loop because subsequent items might depend on this one
        break;
      }
    } catch (err) {
      console.error(`Network error during sync replay for ${item.id}:`, err);
      await updateQueueItemStatus(item.id, 'pending'); // revert back to pending to try later
      break; // stop processing since network is probably down again
    }
  }

  isSyncing = false;
  const remaining = await getQueuedItems();
  
  if (onProgress) onProgress(remaining.length);
  
  const status = remaining.length > 0 ? 'pending' : 'synced';
  window.dispatchEvent(
    new CustomEvent('sync-status-changed', {
      detail: status,
    })
  );
}

// Automatically setup listeners for online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue();
  });
}
