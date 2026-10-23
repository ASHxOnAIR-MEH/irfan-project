/**
 * Ambient Memory Pendant - IndexedDB Local Persistence Engine
 * Safely stores sessions, timestamped transcripts, AI insights, and raw audio Blobs offline.
 */

import { RecordingSession } from '../../types/session';

const DB_NAME = 'AmbientMemoryPendantDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const AUDIO_BLOBS_STORE = 'audioBlobs';
const SETTINGS_STORE = 'settings';

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

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
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

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  // --- Session Operations ---

  public async saveSession(session: RecordingSession): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readwrite');
      const store = tx.objectStore(SESSIONS_STORE);
      // Remove temporary transient blob URL before serializing
      const sessionToSave = { ...session };
      delete sessionToSave.audioBlobUrl;

      const req = store.put(sessionToSave);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getSession(id: string): Promise<RecordingSession | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllSessions(): Promise<RecordingSession[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result || []) as RecordingSession[];
        // Sort descending by capture date
        results.sort((a, b) => b.capturedAtMs - a.capturedAtMs);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, AUDIO_BLOBS_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).delete(id);
      tx.objectStore(AUDIO_BLOBS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Audio Blob Operations ---

  public async saveAudioBlob(sessionId: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_BLOBS_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_BLOBS_STORE);
      const req = store.put({ sessionId, blob, savedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getAudioBlob(sessionId: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_BLOBS_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_BLOBS_STORE);
      const req = store.get(sessionId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- App Settings Operations ---

  public async getSettings(): Promise<AppSettings> {
    const db = await this.getDB();
    return new Promise((resolve) => {
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
    });
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key: 'app_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clearAll(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, AUDIO_BLOBS_STORE], 'readwrite');
      tx.objectStore(SESSIONS_STORE).clear();
      tx.objectStore(AUDIO_BLOBS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const localDb = new LocalDatabase();
