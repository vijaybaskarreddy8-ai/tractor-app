import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncQueueSchema extends DBSchema {
  mutations: {
    key: string;
    value: {
      id: string;
      method: 'POST' | 'PUT' | 'DELETE';
      url: string;
      body: any;
      timestamp: number;
      status: 'pending' | 'processing' | 'failed';
      error?: string;
    };
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'tractor-hours-offline-db';
const STORE_NAME = 'mutations';

let dbPromise: Promise<IDBPDatabase<SyncQueueSchema>> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<SyncQueueSchema>(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export async function addToQueue(
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  body: any
) {
  const db = await getDB();
  if (!db) return null;

  const mutation = {
    id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    method,
    url,
    body,
    timestamp: Date.now(),
    status: 'pending' as const,
  };

  await db.put(STORE_NAME, mutation);
  // Dispatch custom event to notify components of queue changes
  window.dispatchEvent(new CustomEvent('sync-queue-updated'));
  return mutation;
}

export async function getQueuedItems() {
  const db = await getDB();
  if (!db) return [];

  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-timestamp');
  return index.getAll();
}

export async function updateQueueItemStatus(
  id: string,
  status: 'pending' | 'processing' | 'failed',
  error?: string
) {
  const db = await getDB();
  if (!db) return;

  const item = await db.get(STORE_NAME, id);
  if (item) {
    item.status = status;
    if (error) item.error = error;
    await db.put(STORE_NAME, item);
    window.dispatchEvent(new CustomEvent('sync-queue-updated'));
  }
}

export async function removeFromQueue(id: string) {
  const db = await getDB();
  if (!db) return;

  await db.delete(STORE_NAME, id);
  window.dispatchEvent(new CustomEvent('sync-queue-updated'));
}

export async function getQueueCount() {
  const db = await getDB();
  if (!db) return 0;

  return db.count(STORE_NAME);
}
