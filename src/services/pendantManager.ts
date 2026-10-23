/**
 * Ambient Memory Pendant - Central Device & Sync Coordinator
 * Orchestrates hardware transports, telemetry streams, chunked transfer queues,
 * local IndexedDB storage, and AI processing pipelines.
 */

import { PendantDeviceStatus, TransportType } from '../types/device';
import { SyncManifestItem, TransferState } from '../types/protocol';
import { RecordingSession } from '../types/session';
import { calculateCrc32 } from '../utils/crc32';
import { IAIProcessingService } from './ai/IAIProcessingService';
import { MockAIProcessor } from './ai/mockAIProcessor';
import { localDb } from './storage/indexedDb';
import { ITransport } from './transport/ITransport';
import { MockTransport } from './transport/MockTransport';
import { WebBleTransport } from './transport/WebBleTransport';
import { WifiHttpTransport } from './transport/WifiHttpTransport';

export type StatusListener = (status: PendantDeviceStatus) => void;
export type TransferListener = (state: TransferState | null) => void;
export type SessionsUpdatedListener = () => void;

class PendantManager {
  private activeTransport: ITransport;
  private mockTransportInstance: MockTransport;
  private bleTransportInstance: WebBleTransport;
  private wifiTransportInstance: WifiHttpTransport;
  private aiProcessor: IAIProcessingService;

  private currentStatus: PendantDeviceStatus;
  private activeTransfer: TransferState | null = null;
  private transferAborted: boolean = false;
  private transferPaused: boolean = false;

  private statusListeners: Set<StatusListener> = new Set();
  private transferListeners: Set<TransferListener> = new Set();
  private sessionUpdateListeners: Set<SessionsUpdatedListener> = new Set();

  constructor() {
    this.mockTransportInstance = new MockTransport();
    this.bleTransportInstance = new WebBleTransport();
    this.wifiTransportInstance = new WifiHttpTransport();
    this.aiProcessor = new MockAIProcessor();

    // Default to Mock Transport for software-first evaluation
    this.activeTransport = this.mockTransportInstance;
    this.currentStatus = this.mockTransportInstance.getStatusSnapshot();

    // Attach transport status listener
    this.attachTransportListener();
  }

  private attachTransportListener(): void {
    this.activeTransport.subscribeStatus((newStatus) => {
      this.currentStatus = newStatus;
      this.notifyStatus();
    });
  }

  public getMockTransport(): MockTransport {
    return this.mockTransportInstance;
  }

  public getStatus(): PendantDeviceStatus {
    return this.currentStatus;
  }

  public getActiveTransfer(): TransferState | null {
    return this.activeTransfer;
  }

  public getActiveTransportType(): TransportType {
    return this.activeTransport.type;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeTransfer(listener: TransferListener): () => void {
    this.transferListeners.add(listener);
    listener(this.activeTransfer);
    return () => this.transferListeners.delete(listener);
  }

  public subscribeSessionUpdates(listener: SessionsUpdatedListener): () => void {
    this.sessionUpdateListeners.add(listener);
    return () => this.sessionUpdateListeners.delete(listener);
  }

  private notifyStatus(): void {
    this.statusListeners.forEach((l) => l(this.currentStatus));
  }

  private notifyTransfer(): void {
    this.transferListeners.forEach((l) => l(this.activeTransfer ? { ...this.activeTransfer } : null));
  }

  private notifySessionsUpdated(): void {
    this.sessionUpdateListeners.forEach((l) => l());
  }

  // --- Transport Switching ---

  public async setTransport(type: TransportType, wifiEndpoint?: string): Promise<void> {
    if (this.activeTransport.isConnected()) {
      await this.activeTransport.disconnect();
    }

    if (type === 'mock') {
      this.activeTransport = this.mockTransportInstance;
    } else if (type === 'web_ble') {
      this.activeTransport = this.bleTransportInstance;
    } else if (type === 'wifi_http') {
      if (wifiEndpoint) {
        this.wifiTransportInstance.setEndpoint(wifiEndpoint);
      }
      this.activeTransport = this.wifiTransportInstance;
    }

    this.attachTransportListener();
    this.currentStatus.transportType = type;
    this.notifyStatus();
  }

  public async connect(): Promise<boolean> {
    const success = await this.activeTransport.connect();
    return success;
  }

  public async disconnect(): Promise<void> {
    await this.activeTransport.disconnect();
  }

  public async startRecording(): Promise<boolean> {
    return this.activeTransport.startRecording();
  }

  public async stopRecording(): Promise<string | null> {
    const recId = await this.activeTransport.stopRecording();
    this.notifySessionsUpdated();
    return recId;
  }

  public async setPrivacyMute(enabled: boolean): Promise<boolean> {
    if (this.activeTransport.setPrivacyMute) {
      const res = await this.activeTransport.setPrivacyMute(enabled);
      this.notifySessionsUpdated();
      return res;
    }
    return false;
  }

  // --- Manifest & MicroSD Scanning ---

  public async getPendantManifest(): Promise<SyncManifestItem[]> {
    if (!this.activeTransport.isConnected()) return [];
    return this.activeTransport.fetchManifest();
  }

  // --- Robust Resumable Transfer Engine ---

  public pauseTransfer(): void {
    this.transferPaused = true;
    if (this.activeTransfer) {
      this.activeTransfer.status = 'paused';
      this.notifyTransfer();
    }
  }

  public resumeTransfer(): void {
    this.transferPaused = false;
    if (this.activeTransfer) {
      this.activeTransfer.status = 'in_progress';
      this.notifyTransfer();
    }
  }

  public cancelTransfer(): void {
    this.transferAborted = true;
    if (this.activeTransfer) {
      this.activeTransfer.status = 'failed';
      this.activeTransfer.lastError = 'Cancelled by user';
      this.notifyTransfer();
    }
  }

  /**
   * Synchronizes an audio recording from pendant to local IndexedDB
   * Features: 4KB chunking, per-packet CRC32 validation, retry loops, resume capability,
   * safe microSD preservation, and automatic AI insight pipeline execution.
   */
  public async syncRecording(
    manifestItem: SyncManifestItem,
    autoDeleteFromSd: boolean = false
  ): Promise<RecordingSession> {
    if (!this.activeTransport.isConnected()) {
      throw new Error('Cannot sync: Pendant is disconnected');
    }

    this.transferAborted = false;
    this.transferPaused = false;

    const CHUNK_SIZE = 4096;
    const totalChunks = Math.ceil(manifestItem.fileSizeBytes / CHUNK_SIZE);
    const chunkBuffers: Uint8Array[] = new Array(totalChunks);

    this.activeTransfer = {
      sessionId: manifestItem.sessionId,
      status: 'in_progress',
      totalBytes: manifestItem.fileSizeBytes,
      transferredBytes: 0,
      currentChunk: 0,
      totalChunks,
      bytesPerSecond: 0,
      estimatedRemainingSec: 0,
      retryCount: 0,
      canResume: true,
    };
    this.notifyTransfer();

    const startTime = Date.now();

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      // Check for user cancellation
      if (this.transferAborted) {
        throw new Error('Transfer aborted by user');
      }

      // Check for pause
      while (this.transferPaused && !this.transferAborted) {
        await new Promise((r) => setTimeout(r, 200));
      }

      // Retry loop for packet transfer
      let success = false;
      let chunkRetries = 0;
      const MAX_RETRIES = 3;

      while (!success && chunkRetries < MAX_RETRIES) {
        try {
          const packet = await this.activeTransport.requestChunk(manifestItem.sessionId, chunkIdx);

          // Verify CRC32 checksum of the chunk
          const computedCrc = calculateCrc32(packet.payload);
          if (computedCrc !== packet.chunkCrc32) {
            throw new Error(`CRC Checksum mismatch on chunk ${chunkIdx}: expected ${packet.chunkCrc32}, got ${computedCrc}`);
          }

          chunkBuffers[chunkIdx] = packet.payload;
          success = true;
        } catch (err: unknown) {
          chunkRetries++;
          if (this.activeTransfer) {
            this.activeTransfer.retryCount++;
            this.activeTransfer.lastError = err instanceof Error ? err.message : 'Packet transmission failure';
            this.notifyTransfer();
          }

          if (chunkRetries >= MAX_RETRIES) {
            if (this.activeTransfer) {
              this.activeTransfer.status = 'failed';
              this.notifyTransfer();
            }
            throw new Error(`Transfer failed after ${MAX_RETRIES} retries on chunk ${chunkIdx}: ${err instanceof Error ? err.message : 'Unknown'}`);
          }

          // Backoff before retry
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      // Update transfer telemetry
      const transferred = (chunkIdx + 1) * CHUNK_SIZE > manifestItem.fileSizeBytes
        ? manifestItem.fileSizeBytes
        : (chunkIdx + 1) * CHUNK_SIZE;

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const bps = Math.round(transferred / elapsedSec);
      const remainingBytes = manifestItem.fileSizeBytes - transferred;
      const eta = bps > 0 ? Math.ceil(remainingBytes / bps) : 0;

      if (this.activeTransfer) {
        this.activeTransfer.transferredBytes = transferred;
        this.activeTransfer.currentChunk = chunkIdx + 1;
        this.activeTransfer.bytesPerSecond = bps;
        this.activeTransfer.estimatedRemainingSec = eta;
        this.notifyTransfer();
      }
    }

    // Transfer completed, enter verification phase
    if (this.activeTransfer) {
      this.activeTransfer.status = 'verifying';
      this.notifyTransfer();
    }

    // Assemble complete binary file
    const assembledFile = new Uint8Array(manifestItem.fileSizeBytes);
    let offset = 0;
    for (const chunk of chunkBuffers) {
      assembledFile.set(chunk, offset);
      offset += chunk.length;
    }

    // Full file CRC verification against manifest
    const fileCrc = calculateCrc32(assembledFile);
    if (fileCrc !== manifestItem.checksumCrc32) {
      if (this.activeTransfer) {
        this.activeTransfer.status = 'failed';
        this.activeTransfer.lastError = 'Final file CRC32 verification failed';
        this.notifyTransfer();
      }
      throw new Error(`Full file verification failed: expected CRC ${manifestItem.checksumCrc32}, calculated ${fileCrc}`);
    }

    // Create durable Audio Blob
    const audioBlob = new Blob([assembledFile], { type: 'audio/wav' });
    await localDb.saveAudioBlob(manifestItem.sessionId, audioBlob);

    // Process with AI & Transcription engine
    const aiResult = await this.aiProcessor.processAudio(audioBlob, {
      titleHint: manifestItem.filename,
      durationSeconds: manifestItem.durationSeconds,
    });

    // Create and save complete RecordingSession
    const session: RecordingSession = {
      id: manifestItem.sessionId,
      title: manifestItem.filename.replace('.WAV', '').replace(/_/g, ' '),
      capturedAtMs: manifestItem.capturedAtMs,
      pendantDeviceId: this.currentStatus.deviceId,
      metadata: {
        format: 'wav',
        sampleRateHz: 16000,
        channels: 1,
        bitDepth: 16,
        durationSeconds: manifestItem.durationSeconds,
        fileSizeBytes: manifestItem.fileSizeBytes,
        checksumSha256: fileCrc.toString(16),
        filename: manifestItem.filename,
      },
      transcript: aiResult.transcript,
      insights: aiResult.insights,
      syncStatus: 'synced_local',
      transferProgressPercent: 100,
      tags: aiResult.insights.importantTopics.slice(0, 3),
    };

    await localDb.saveSession(session);

    // Send final ACK to pendant (only now is microSD marked synced or safe to delete)
    await this.activeTransport.acknowledgeSync(manifestItem.sessionId, autoDeleteFromSd);

    if (this.activeTransfer) {
      this.activeTransfer.status = 'completed';
      this.notifyTransfer();
    }

    // Notify UI that new session is persisted
    this.notifySessionsUpdated();

    // Reset transfer state after 2 seconds
    setTimeout(() => {
      this.activeTransfer = null;
      this.notifyTransfer();
    }, 2000);

    return session;
  }
}

export const pendantManager = new PendantManager();
