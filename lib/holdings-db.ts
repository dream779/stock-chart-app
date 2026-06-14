import type { Holding } from './holdings';

const DB_NAME = 'fund-holdings-db';
const DB_VERSION = 1;
const STORE_NAME = 'holdings';

export function initHoldingsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'code' });
      }
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return initHoldingsDB().then((db) => {
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = callback(store);

      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(transaction.error ?? request.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(new Error('IndexedDB transaction aborted'));
    }).finally(() => {
      db.close();
    });
  });
}

export async function getAllHoldings(): Promise<Holding[]> {
  return withStore('readonly', (store) => store.getAll() as IDBRequest<Holding[]>);
}

export async function getHolding(code: string): Promise<Holding | undefined> {
  return withStore('readonly', (store) => store.get(code) as IDBRequest<Holding | undefined>);
}

export async function saveHolding(holding: Holding): Promise<void> {
  await withStore('readwrite', (store) => store.put(holding) as IDBRequest<IDBValidKey>);
}

export async function deleteHolding(code: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(code) as IDBRequest<undefined>);
}

export type { Holding } from './holdings';
