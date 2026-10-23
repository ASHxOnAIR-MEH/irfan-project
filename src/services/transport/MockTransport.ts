/**
 * Ambient Memory Pendant - Mock Hardware Transport
 * Simulates ESP32-S3 microcontroller with onboard battery charging circuitry,
 * I2S microphone peripheral, microSD SPI/SDMMC storage, hardware privacy button,
 * realistic 4KB chunk streaming, CRC32 checks, and fault injection.
 */

import { ChargingStatusSignal, PendantDeviceStatus } from '../../types/device';
import { FirmwareCommand, SyncManifestItem, TransferPacket } from '../../types/protocol';
import { calculateCrc32 } from '../../utils/crc32';
import { AudioSynthesizer } from '../audio/audioSynthesizer';
import { ITransport } from './ITransport';

export class MockTransport implements ITransport {
  public readonly id = 'mock_transport';
  public readonly name = 'ESP32-S3 Super Mini (Onboard Charger Emulator)';
  public readonly type = 'mock' as const;

  private connected: boolean = false;
  private statusListeners: Set<(status: PendantDeviceStatus) => void> = new Set();
  private tickerInterval: number | null = null;

  // Virtual Hardware State
  private status: PendantDeviceStatus = {
    deviceId: 'ESP32S3-MINI-9A71',
    hardwareRevision: 'ESP32-S3 Super Mini (Dual-Core LX7 240MHz, Onboard Charger)',
    firmwareVersion: '0.5.0-s3',
    connectionState: 'disconnected',
    operatingMode: 'idle',
    battery: {
      chargingCircuitSupported: true,
      chargingStatusSignal: 'not_charging',
      isCharging: false,
      percentage: 84,
      voltageMv: 3960,
      estimatedRunMinutesRemaining: 480, // ~8 hrs estimated run-time
      health: 'good',
    },
    storage: {
      totalBytes: 15931539456, // 16GB MicroSD
      usedBytes: 2415919104,   // ~2.4GB
      freeBytes: 13515620352,
      estimatedMinutesRemaining: 7039, // ~117 hours at 32KB/s
      status: 'mounted',
    },
    clock: {
      deviceRtcTimestampMs: Date.now(),
      isClockSynchronized: true,
    },
    activeRecordingId: null,
    activeRecordingDurationSec: 0,
    lastSyncTimestampMs: Date.now() - 3600000,
    transportType: 'mock',
    signalRssi: -48,
    privacyMuteActive: false,
  };

  // Virtual MicroSD Storage Cache
  private virtualSdManifest: Map<string, { manifest: SyncManifestItem; rawData: Uint8Array }> = new Map();

  // Fault Injection & Simulation flags
  public failNextChunk: boolean = false;
  public transferSpeedBps: number = 64 * 1024; // 64 KB/s simulated transfer speed

  constructor() {
    this.seedVirtualMicroSd();
  }

  public isSupported(): boolean {
    return true; // Virtual transport runs in any browser
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<boolean> {
    this.status.connectionState = 'connecting';
    this.notifyStatus();

    await new Promise((resolve) => setTimeout(resolve, 600)); // Simulate BLE/WiFi handshake

    this.connected = true;
    this.status.connectionState = 'connected';
    this.status.clock.deviceRtcTimestampMs = Date.now();
    this.status.clock.isClockSynchronized = true;
    this.startHardwareTicker();
    this.notifyStatus();
    return true;
  }

  public async disconnect(): Promise<void> {
    this.stopHardwareTicker();
    this.connected = false;
    this.status.connectionState = 'disconnected';
    this.notifyStatus();
  }

  public subscribeStatus(callback: (status: PendantDeviceStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatusSnapshot());
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public getStatusSnapshot(): PendantDeviceStatus {
    return JSON.parse(JSON.stringify(this.status));
  }

  private notifyStatus(): void {
    const snapshot = this.getStatusSnapshot();
    this.statusListeners.forEach((listener) => listener(snapshot));
  }

  private startHardwareTicker(): void {
    if (this.tickerInterval) return;
    this.tickerInterval = window.setInterval(() => {
      if (!this.connected) return;

      // Increment recording duration if active
      if (this.status.operatingMode === 'recording') {
        this.status.activeRecordingDurationSec += 1;
        // Increase microSD used bytes (32KB/sec for 16kHz 16-bit mono)
        if (this.status.storage.usedBytes !== null && this.status.storage.freeBytes !== null) {
          this.status.storage.usedBytes += 32768;
          this.status.storage.freeBytes -= 32768;
        }
      }

      // Micro-drain battery slowly when operating on battery
      if (this.status.battery.percentage !== null && !this.status.battery.isCharging) {
        if (Math.random() < 0.05 && this.status.battery.percentage > 1) {
          this.status.battery.percentage -= 1;
          if (this.status.battery.voltageMv !== null) {
            this.status.battery.voltageMv = Math.max(3400, this.status.battery.voltageMv - 5);
          }
          if (this.status.battery.estimatedRunMinutesRemaining !== null) {
            this.status.battery.estimatedRunMinutesRemaining = Math.max(
              0,
              this.status.battery.estimatedRunMinutesRemaining - 5
            );
          }
        }
      }

      this.notifyStatus();
    }, 1000);
  }

  private stopHardwareTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  // --- Virtual MicroSD & Session Management ---

  private async seedVirtualMicroSd(): Promise<void> {
    const sampleRecordings = [
      {
        id: 'REC_20261022_001',
        title: 'Hardware Architecture & Microphone Interface Selection',
        durationSec: 18,
        topic: 'hardware',
      },
      {
        id: 'REC_20261022_002',
        title: 'MicroSD CRC32 Resumption & Transfer Reliability Review',
        durationSec: 24,
        topic: 'protocol',
      },
      {
        id: 'REC_20261022_003',
        title: 'Privacy Boundaries: Local Storage vs BYOK Cloud Transcription',
        durationSec: 15,
        topic: 'privacy',
      },
    ];

    for (const rec of sampleRecordings) {
      const audioBlob = await AudioSynthesizer.generateSpokenAudioBlob(rec.durationSec, rec.topic);
      const arrayBuffer = await audioBlob.arrayBuffer();
      const rawData = new Uint8Array(arrayBuffer);
      const crc = calculateCrc32(rawData);

      const manifestItem: SyncManifestItem = {
        sessionId: rec.id,
        filename: `${rec.id}.WAV`,
        fileSizeBytes: rawData.length,
        durationSeconds: rec.durationSec,
        capturedAtMs: Date.now() - (rec.durationSec * 1000 + Math.random() * 86400000),
        checksumCrc32: crc,
        isSyncedToApp: false,
      };

      this.virtualSdManifest.set(rec.id, { manifest: manifestItem, rawData });
    }
  }

  public async fetchManifest(): Promise<SyncManifestItem[]> {
    if (!this.connected) throw new Error('Pendant is disconnected');
    await new Promise((resolve) => setTimeout(resolve, 150));
    return Array.from(this.virtualSdManifest.values()).map((v) => ({ ...v.manifest }));
  }

  public async requestChunk(sessionId: string, chunkIndex: number): Promise<TransferPacket> {
    if (!this.connected) throw new Error('Pendant is disconnected');

    if (this.failNextChunk) {
      this.failNextChunk = false;
      throw new Error('CRC Checksum Mismatch / Packet dropped in transit (simulated fault)');
    }

    const item = this.virtualSdManifest.get(sessionId);
    if (!item) {
      throw new Error(`Session ${sessionId} not found on microSD`);
    }

    const CHUNK_SIZE = 4096; // 4KB chunk
    const totalChunks = Math.ceil(item.rawData.length / CHUNK_SIZE);

    if (chunkIndex >= totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} out of range (total: ${totalChunks})`);
    }

    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, item.rawData.length);
    const payload = item.rawData.slice(start, end);
    const chunkCrc = calculateCrc32(payload);

    // Simulate transfer latency based on bandwidth
    const simulatedDelayMs = Math.max(15, Math.floor((payload.length / this.transferSpeedBps) * 1000));
    await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));

    return {
      sessionId,
      chunkIndex,
      totalChunks,
      chunkSizeBytes: payload.length,
      payload,
      chunkCrc32: chunkCrc,
    };
  }

  public async acknowledgeSync(sessionId: string, deleteFromSd: boolean): Promise<boolean> {
    if (!this.connected) throw new Error('Pendant is disconnected');

    const item = this.virtualSdManifest.get(sessionId);
    if (item) {
      item.manifest.isSyncedToApp = true;
      if (deleteFromSd) {
        this.virtualSdManifest.delete(sessionId);
        if (this.status.storage.usedBytes !== null && this.status.storage.freeBytes !== null) {
          this.status.storage.usedBytes -= item.rawData.length;
          this.status.storage.freeBytes += item.rawData.length;
        }
      }
    }

    this.status.lastSyncTimestampMs = Date.now();
    this.notifyStatus();
    return true;
  }

  public async startRecording(): Promise<boolean> {
    if (!this.connected) throw new Error('Pendant is disconnected');
    if (this.status.privacyMuteActive) {
      throw new Error('Hardware Privacy Button is active. Disengage privacy button on pendant to start recording.');
    }
    if (this.status.operatingMode === 'recording') return true;

    const newRecId = `REC_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15)}`;
    this.status.operatingMode = 'recording';
    this.status.activeRecordingId = newRecId;
    this.status.activeRecordingDurationSec = 0;
    this.notifyStatus();
    return true;
  }

  public async stopRecording(): Promise<string | null> {
    if (!this.connected || this.status.operatingMode !== 'recording') return null;

    const recId = this.status.activeRecordingId || `REC_${Date.now()}`;
    const duration = Math.max(3, this.status.activeRecordingDurationSec);

    // Create synthesized audio on the virtual microSD
    const audioBlob = await AudioSynthesizer.generateSpokenAudioBlob(duration, 'live_memo');
    const arrayBuffer = await audioBlob.arrayBuffer();
    const rawData = new Uint8Array(arrayBuffer);
    const crc = calculateCrc32(rawData);

    const manifestItem: SyncManifestItem = {
      sessionId: recId,
      filename: `${recId}.WAV`,
      fileSizeBytes: rawData.length,
      durationSeconds: duration,
      capturedAtMs: Date.now(),
      checksumCrc32: crc,
      isSyncedToApp: false,
    };

    this.virtualSdManifest.set(recId, { manifest: manifestItem, rawData });

    this.status.operatingMode = this.status.privacyMuteActive ? 'privacy_muted' : 'idle';
    this.status.activeRecordingId = null;
    this.status.activeRecordingDurationSec = 0;
    this.notifyStatus();
    return recId;
  }

  public async setPrivacyMute(enabled: boolean): Promise<boolean> {
    this.status.privacyMuteActive = enabled;
    if (enabled && this.status.operatingMode === 'recording') {
      // Hardware privacy control pressed: immediately halt recording and commit audio to SD
      await this.stopRecording();
      this.status.operatingMode = 'privacy_muted';
    } else if (!enabled && this.status.operatingMode === 'privacy_muted') {
      this.status.operatingMode = 'idle';
    }
    this.notifyStatus();
    return true;
  }

  public async sendCommand(cmd: FirmwareCommand): Promise<unknown> {
    switch (cmd.type) {
      case 'GET_TELEMETRY':
        return this.getStatusSnapshot();
      case 'START_RECORD':
        return this.startRecording();
      case 'STOP_RECORD':
        return this.stopRecording();
      case 'GET_MANIFEST':
        return this.fetchManifest();
      case 'REQUEST_CHUNK':
        return this.requestChunk(cmd.sessionId, cmd.chunkIndex);
      case 'ACK_COMPLETE':
        return this.acknowledgeSync(cmd.sessionId, cmd.deleteFromSd);
      case 'SYNC_TIME':
        this.status.clock.deviceRtcTimestampMs = cmd.timestampMs;
        this.status.clock.isClockSynchronized = true;
        this.notifyStatus();
        return true;
      case 'SET_PRIVACY_MUTE':
        return this.setPrivacyMute(cmd.enabled);
      case 'FORMAT_SD':
        this.virtualSdManifest.clear();
        if (this.status.storage.totalBytes !== null) {
          this.status.storage.usedBytes = 0;
          this.status.storage.freeBytes = this.status.storage.totalBytes;
        }
        this.notifyStatus();
        return true;
    }
  }

  // --- Fault Injection & Hardware Testing Controls ---

  public setBatteryPercentage(pct: number | null): void {
    this.status.battery.percentage = pct;
    if (pct === null) {
      this.status.battery.voltageMv = null;
      this.status.battery.estimatedRunMinutesRemaining = null;
    } else {
      this.status.battery.voltageMv = Math.round(3300 + (pct / 100) * 900);
      this.status.battery.estimatedRunMinutesRemaining = Math.round((pct / 100) * 600);
    }
    this.notifyStatus();
  }

  public toggleCharging(): void {
    const nextCharging = !this.status.battery.isCharging;
    this.status.battery.isCharging = nextCharging;
    this.status.battery.chargingStatusSignal = nextCharging ? 'charging' : 'not_charging';
    this.notifyStatus();
  }

  public setChargingStatusSignal(signal: ChargingStatusSignal): void {
    this.status.battery.chargingStatusSignal = signal;
    this.status.battery.isCharging = signal === 'charging';
    this.notifyStatus();
  }

  public togglePrivacyButton(): void {
    this.setPrivacyMute(!this.status.privacyMuteActive);
  }

  public setStorageStatus(status: 'mounted' | 'missing' | 'write_error' | 'unformatted'): void {
    this.status.storage.status = status;
    if (status === 'missing') {
      this.status.storage.totalBytes = null;
      this.status.storage.usedBytes = null;
      this.status.storage.freeBytes = null;
      this.status.storage.estimatedMinutesRemaining = null;
    }
    this.notifyStatus();
  }
}
