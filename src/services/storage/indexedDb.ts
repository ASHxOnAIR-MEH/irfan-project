/**
 * Ambient Memory Pendant - Hardened IndexedDB Local Persistence Engine
 * Safely stores sessions, timestamped transcripts, AI insights, and raw audio Blobs offline.
 * Stage 2 Hardened: Atomic transactions, transaction completion verification,
 * retryable database connection, quota error handling, and persistent storage management.
 */

import { RecordingSession } from '../../types/session';

const DB_NAME = 'AmbientMemoryPendantDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const AUDIO_BLOBS_STORE = 'audioBlobs';
const SETTINGS_STORE = 'settings';

export type StorageErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'UNAVAILABLE'
  | 'TRANSACTION_FAILED'
  | 'ABORTED'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly userMessage: string;
  public readonly isQuotaError: boolean;
  public readonly originalError?: unknown;

  constructor(code: StorageErrorCode, userMessage: string, originalError?: unknown) {
    super(userMessage);
    this.name = 'StorageError';
    this.code = code;
    this.userMessage = userMessage;
    this.isQuotaError = code === 'QUOTA_EXCEEDED';
    this.originalError = originalError;
  }
}

function detectQuotaError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const e = err as { name?: string; code?: number; message?: string };
    if (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014 ||
      (e.message && e.message.toLowerCase().includes('quota'))
    ) {
      return true;
    }
  }
  return false;
}

function formatStorageError(err: unknown, defaultMessage: string): StorageError {
  if (err instanceof StorageError) return err;

  if (detectQuotaError(err)) {
    return new StorageError(
      'QUOTA_EXCEEDED',
      'Browser storage quota exceeded. Please free up space or delete older sessions before saving more audio.',
      err
    );
  }

  const message = err instanceof Error ? err.message : defaultMessage;
  return new StorageError('TRANSACTION_FAILED', message || defaultMessage, err);
}

export interface AppSettings {
  privacyMode: 'local_only' | 'opt_in_cloud';
  preferredTransport: 'mock' | 'web_ble' | 'wifi_http' | 'web_serial';
  wifiEndpointUrl: string;
  autoDeleteFromSdAfterSync: boolean;
  byokApiKey?: string;
  aiProvider: 'local_mock' | 'cloud_gemini' | 'cloud_whisper';
}

export const DEFAULT_SETTINGS: AppSettings = {
  privacyMode: 'local_only',
  preferredTransport: 'mock',
  wifiEndpointUrl: 'http://192.168.4.1/api', // Default ESP32 SoftAP IP
  autoDeleteFromSdAfterSync: false,
  aiProvider: 'local_mock',
};

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  percentUsed: number;
  isSupported: boolean;
  isPersisted: boolean | null;
  warningLevel: 'normal' | 'moderate' | 'critical';
}

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Acquires the IDBDatabase handle. If connection fails, cached promise is discarded
   * so subsequent calls can retry without getting permanently stuck on a rejected state.
   */
  public async getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new StorageError(
        'UNAVAILABLE',
        'IndexedDB is not supported or has been disabled in this browser environment.'
      );
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
              const sessionStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
              sessionStore.createIndex('capturedAtMs', 'capturedAtMs', { unique: false });
              sessionStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            }

            if (!db.objectStoreNames.contains(AUDIO_BLOBS_STORE)) {
              db.createObjectStore(AUDIO_BLOBS_STORE, { keyPath: 'sessionId' });
            }

            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
              db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
          };

          request.onsuccess = () => {
            const db = request.result;

            db.onclose = () => {
              this.dbPromise = null;
            };

            db.onversionchange = () => {
              db.close();
              this.dbPromise = null;
            };

            resolve(db);
          };

          request.onerror = () => {
            this.dbPromise = null;
            reject(
              new StorageError(
                'UNAVAILABLE',
                `Failed to open IndexedDB database: ${request.error?.message || 'Unknown error'}`,
                request.error
              )
            );
          };

          request.onblocked = () => {
            console.warn('AmbientMemoryPendant IndexedDB open request blocked by another tab.');
          };
        } catch (err) {
          this.dbPromise = null;
          reject(formatStorageError(err, 'Failed to initialize IndexedDB storage.'));
        }
      });
    }

    try {
      return await this.dbPromise;
    } catch (err) {
      this.dbPromise = null;
      throw err;
    }
  }

  // --- Session Operations ---

  /**
   * Saves a session metadata record. Resolves strictly when the IndexedDB transaction completes.
   * Strips any transient in-memory audioBlobUrl before serializing.
   */
  public async saveSession(session: RecordingSession): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);

        // Sanitize object URL out of persisted representation
        const sessionToSave: RecordingSession = { ...session };
        delete sessionToSave.audioBlobUrl;

        store.put(sessionToSave);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(formatStorageError(tx.error, 'Failed to save session metadata.'));
        tx.onabort = () =>
          reject(
            formatStorageError(tx.error, 'Save session transaction was aborted by the storage engine.')
          );
      } catch (err) {
        reject(formatStorageError(err, 'Could not initiate session save transaction.'));
      }
    });
  }

  /**
   * Atomically saves both the session metadata and the raw audio Blob in a single transaction.
   * If saving either fails (e.g. quota limit reached), neither is committed.
   */
  public async saveSessionWithAudio(session: RecordingSession, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([SESSIONS_STORE, AUDIO_BLOBS_STORE], 'readwrite');
        const sessionStore = tx.objectStore(SESSIONS_STORE);
        const audioStore = tx.objectStore(AUDIO_BLOBS_STORE);

        const sessionToSave: RecordingSession = { ...session };
        delete sessionToSave.audioBlobUrl;

        sessionStore.put(sessionToSave);
        audioStore.put({
          sessionId: session.id,
          blob,
          savedAt: Date.now(),
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(formatStorageError(tx.error, 'Failed to commit atomic session and audio write.'));
        tx.onabort = () =>
          reject(
            formatStorageError(
              tx.error,
              'Atomic session save was aborted. Neither metadata nor audio was committed.'
            )
          );
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate atomic session-audio transaction.'));
      }
    });
  }

  public async getSession(id: string): Promise<RecordingSession | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.get(id);

        req.onsuccess = () => resolve((req.result as RecordingSession) || null);
        req.onerror = () =>
          reject(formatStorageError(req.error, `Failed to retrieve session with ID ${id}.`));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate getSession transaction.'));
      }
    });
  }

  public async getAllSessions(): Promise<RecordingSession[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = (req.result || []) as RecordingSession[];
          // Sort descending by capture timestamp
          results.sort((a, b) => b.capturedAtMs - a.capturedAtMs);
          resolve(results);
        };
        req.onerror = () =>
          reject(formatStorageError(req.error, 'Failed to retrieve sessions list from storage.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate getAllSessions transaction.'));
      }
    });
  }

  /**
   * Safely and atomically deletes a session and its associated audio blob.
   * Resolves only after transaction commits.
   */
  public async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([SESSIONS_STORE, AUDIO_BLOBS_STORE], 'readwrite');
        tx.objectStore(SESSIONS_STORE).delete(id);
        tx.objectStore(AUDIO_BLOBS_STORE).delete(id);

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(formatStorageError(tx.error, `Failed to delete session ${id} from storage.`));
        tx.onabort = () =>
          reject(formatStorageError(tx.error, 'Delete session transaction was aborted.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate delete session transaction.'));
      }
    });
  }

  // --- Audio Blob Operations ---

  public async saveAudioBlob(sessionId: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(AUDIO_BLOBS_STORE, 'readwrite');
        const store = tx.objectStore(AUDIO_BLOBS_STORE);

        store.put({ sessionId, blob, savedAt: Date.now() });

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(formatStorageError(tx.error, 'Failed to save audio blob to storage.'));
        tx.onabort = () =>
          reject(formatStorageError(tx.error, 'Audio blob save transaction was aborted.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate saveAudioBlob transaction.'));
      }
    });
  }

  public async getAudioBlob(sessionId: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(AUDIO_BLOBS_STORE, 'readonly');
        const store = tx.objectStore(AUDIO_BLOBS_STORE);
        const req = store.get(sessionId);

        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob as Blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () =>
          reject(formatStorageError(req.error, `Failed to fetch audio for session ${sessionId}.`));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate getAudioBlob transaction.'));
      }
    });
  }

  /**
   * Fast check to determine if an audio blob exists in storage without pulling
   * the full multi-megabyte Blob into memory.
   */
  public async hasAudioBlob(sessionId: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(AUDIO_BLOBS_STORE, 'readonly');
        const store = tx.objectStore(AUDIO_BLOBS_STORE);
        const req = store.count(sessionId);

        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () =>
          reject(formatStorageError(req.error, 'Failed to check audio blob presence.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate hasAudioBlob check.'));
      }
    });
  }

  // --- App Settings Operations ---

  public async getSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(SETTINGS_STORE, 'readonly');
          const store = tx.objectStore(SETTINGS_STORE);
          const req = store.get('app_settings');

          req.onsuccess = () => {
            if (req.result && req.result.value) {
              resolve({ ...DEFAULT_SETTINGS, ...req.result.value });
            } else {
              resolve(DEFAULT_SETTINGS);
            }
          };
          req.onerror = () => resolve(DEFAULT_SETTINGS);
        } catch {
          resolve(DEFAULT_SETTINGS);
        }
      });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        store.put({ key: 'app_settings', value: settings });

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(formatStorageError(tx.error, 'Failed to save application preferences.'));
        tx.onabort = () =>
          reject(formatStorageError(tx.error, 'Settings save transaction was aborted.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate saveSettings transaction.'));
      }
    });
  }

  public async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([SESSIONS_STORE, AUDIO_BLOBS_STORE], 'readwrite');
        tx.objectStore(SESSIONS_STORE).clear();
        tx.objectStore(AUDIO_BLOBS_STORE).clear();

        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(formatStorageError(tx.error, 'Failed to clear local sessions storage.'));
        tx.onabort = () =>
          reject(formatStorageError(tx.error, 'Clear storage transaction was aborted.'));
      } catch (err) {
        reject(formatStorageError(err, 'Failed to initiate clearAll transaction.'));
      }
    });
  }

  // --- Storage Quota and Persistence Monitoring ---

  /**
   * Retrieves estimated storage quota and persistence state.
   */
  public async getStorageQuota(): Promise<StorageQuotaInfo> {
    const isSupported =
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      typeof navigator.storage.estimate === 'function';

    if (!isSupported) {
      return {
        usageBytes: 0,
        quotaBytes: 0,
        availableBytes: 0,
        percentUsed: 0,
        isSupported: false,
        isPersisted: null,
        warningLevel: 'normal',
      };
    }

    try {
      const [estimate, isPersisted] = await Promise.all([
        navigator.storage.estimate(),
        this.checkIsPersisted(),
      ]);

      const usageBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 0;
      const availableBytes = Math.max(0, quotaBytes - usageBytes);
      const percentUsed = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;

      let warningLevel: 'normal' | 'moderate' | 'critical' = 'normal';
      if (percentUsed >= 90) {
        warningLevel = 'critical';
      } else if (percentUsed >= 80) {
        warningLevel = 'moderate';
      }

      return {
        usageBytes,
        quotaBytes,
        availableBytes,
        percentUsed,
        isSupported: true,
        isPersisted,
        warningLevel,
      };
    } catch {
      return {
        usageBytes: 0,
        quotaBytes: 0,
        availableBytes: 0,
        percentUsed: 0,
        isSupported: false,
        isPersisted: null,
        warningLevel: 'normal',
      };
    }
  }

  /**
   * Checks whether the browser has granted persistent storage to this origin.
   */
  public async checkIsPersisted(): Promise<boolean | null> {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      typeof navigator.storage.persisted === 'function'
    ) {
      try {
        return await navigator.storage.persisted();
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Requests persistent storage permission from the browser so audio blobs
   * and transcripts are not evicted under disk pressure.
   */
  public async requestPersistentStorage(): Promise<{
    granted: boolean;
    supported: boolean;
    message: string;
  }> {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.storage === 'undefined' ||
      typeof navigator.storage.persist !== 'function'
    ) {
      return {
        granted: false,
        supported: false,
        message: 'Persistent storage API is not supported by your browser.',
      };
    }

    try {
      const granted = await navigator.storage.persist();
      return {
        granted,
        supported: true,
        message: granted
          ? 'Persistent storage granted. Browser will not evict memory sessions under storage pressure.'
          : 'Persistent storage request was denied by the browser.',
      };
    } catch (err) {
      return {
        granted: false,
        supported: true,
        message: `Persistent storage request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }
}

export const localDb = new LocalDatabase();
