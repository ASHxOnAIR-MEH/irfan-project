/**
 * Ambient Memory Pendant - Hardware Protocol & Binary Transfer Types
 */

export interface SyncManifestItem {
  sessionId: string;
  filename: string;
  fileSizeBytes: number;
  durationSeconds: number;
  capturedAtMs: number;
  checksumCrc32: number;
  isSyncedToApp: boolean;
}

export interface TransferPacket {
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkSizeBytes: number;
  payload: Uint8Array;
  chunkCrc32: number;
}

export type TransferStatus = 'idle' | 'in_progress' | 'paused' | 'verifying' | 'completed' | 'failed';

export interface TransferState {
  sessionId: string;
  status: TransferStatus;
  totalBytes: number;
  transferredBytes: number;
  currentChunk: number;
  totalChunks: number;
  bytesPerSecond: number;
  estimatedRemainingSec: number;
  retryCount: number;
  lastError?: string;
  canResume: boolean;
}

export type FirmwareCommand = 
  | { type: 'GET_TELEMETRY' }
  | { type: 'START_RECORD' }
  | { type: 'PAUSE_RECORD' }
  | { type: 'RESUME_RECORD' }
  | { type: 'STOP_RECORD' }
  | { type: 'GET_MANIFEST' }
  | { type: 'REQUEST_CHUNK'; sessionId: string; chunkIndex: number }
  | { type: 'ACK_COMPLETE'; sessionId: string; deleteFromSd: boolean }
  | { type: 'SYNC_TIME'; timestampMs: number }
  | { type: 'SET_PRIVACY_MUTE'; enabled: boolean }
  | { type: 'FORMAT_SD'; confirmationKey: string };
