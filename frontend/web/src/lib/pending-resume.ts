/**
 * A resume chosen during signup cannot be uploaded before the account is
 * verified, because `/api/candidate/resume` requires an authenticated session.
 * We therefore keep the File in IndexedDB (the only browser storage that can
 * hold a multi-megabyte File) and attach it right after OTP verification.
 */

const DB_NAME = 'tp_pending_uploads';
const DB_VERSION = 1;
const STORE_NAME = 'resumes';
/** Drop stale files if the user abandons the verification step. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface PendingResumeRecord {
  email: string;
  file: File;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'email' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function savePendingResume(email: string, file: File): Promise<void> {
  const key = normalizeEmail(email);
  if (!key) return;

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record: PendingResumeRecord = { email: key, file, savedAt: Date.now() };
    store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not store the pending resume'));
    tx.onabort = () => reject(tx.error ?? new Error('Pending resume storage was aborted'));
  });
  db.close();
}

/** Returns and removes the pending resume in one step. */
export async function takePendingResume(email: string): Promise<File | null> {
  const key = normalizeEmail(email);
  if (!key) return null;

  const db = await openDatabase();
  const record = await new Promise<PendingResumeRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as PendingResumeRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('Could not read the pending resume'));
  });
  db.close();

  if (!record) return null;
  await deletePendingResume(key);

  if (!record.file || Date.now() - record.savedAt > MAX_AGE_MS) {
    return null;
  }
  return record.file;
}

export async function deletePendingResume(email: string): Promise<void> {
  const key = normalizeEmail(email);
  if (!key) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear the pending resume'));
    });
    db.close();
  } catch {
    // Best-effort cleanup only.
  }
}
