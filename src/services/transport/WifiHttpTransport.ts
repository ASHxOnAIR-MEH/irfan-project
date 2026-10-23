/**
 * Ambient Memory Pendant - Local WiFi (SoftAP / REST) Transport
 * Universal compatibility mode: works on all browsers including Safari on iPhone and iPad!
 * The ESP32-S3 hosts a lightweight HTTP server at 192.168.4.1 or on the local LAN.
 */

import { PendantDeviceStatus } from '../../types/device';
import { FirmwareCommand, SyncManifestItem, TransferPacket } from '../../types/protocol';
import { ITransport } from './ITransport';

export class WifiHttpTransport implements ITransport {
  public readonly id = 'wifi_http';
  public readonly name = 'Local WiFi (SoftAP / REST - iOS Safari Compatible)';
  public readonly type = 'wifi_http' as const;

  private endpointBase: string;
  private connected: boolean = false;
  private statusListeners: Set<(status: PendantDeviceStatus) => void> = new Set();
  private pollInterval: number | null = null;

  constructor(endpointBase: string = 'http://192.168.4.1/api') {
    this.endpointBase = endpointBase;
  }

  public setEndpoint(endpoint: string): void {
    this.endpointBase = endpoint;
  }

  public isSupported(): boolean {
    return typeof fetch !== 'undefined'; // Universal browser support
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpointBase}/telemetry`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        throw new Error(`Pendant returned HTTP ${res.status}`);
      }

      this.connected = true;
      this.startPolling();
      return true;
    } catch {
      this.connected = false;
      throw new Error(
        `Unable to reach ESP32-S3 SoftAP at ${this.endpointBase}. ` +
        `Ensure your device is connected to the 'AmbientPendant-WiFi' network.`
      );
    }
  }

  public async disconnect(): Promise<void> {
    this.stopPolling();
    this.connected = false;
  }

  public subscribeStatus(callback: (status: PendantDeviceStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = window.setInterval(async () => {
      if (!this.connected) return;
      try {
        const res = await fetch(`${this.endpointBase}/telemetry`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const status = await res.json() as PendantDeviceStatus;
          this.statusListeners.forEach((l) => l(status));
        }
      } catch {
        // Soft drop
      }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public async sendCommand(cmd: FirmwareCommand): Promise<unknown> {
    const res = await fetch(`${this.endpointBase}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    return res.json();
  }

  public async fetchManifest(): Promise<SyncManifestItem[]> {
    const res = await fetch(`${this.endpointBase}/manifest`);
    return res.json() as Promise<SyncManifestItem[]>;
  }

  public async requestChunk(sessionId: string, chunkIndex: number): Promise<TransferPacket> {
    const res = await fetch(`${this.endpointBase}/sessions/${sessionId}/chunks/${chunkIndex}`);
    const data = await res.arrayBuffer();
    return {
      sessionId,
      chunkIndex,
      totalChunks: 1,
      chunkSizeBytes: data.byteLength,
      payload: new Uint8Array(data),
      chunkCrc32: 0,
    };
  }

  public async acknowledgeSync(sessionId: string, deleteFromSd: boolean): Promise<boolean> {
    const res = await fetch(`${this.endpointBase}/sessions/${sessionId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteFromSd }),
    });
    return res.ok;
  }

  public async startRecording(): Promise<boolean> {
    const res = await fetch(`${this.endpointBase}/record/start`, { method: 'POST' });
    return res.ok;
  }

  public async stopRecording(): Promise<string | null> {
    const res = await fetch(`${this.endpointBase}/record/stop`, { method: 'POST' });
    const data = await res.json() as { sessionId: string };
    return data.sessionId || null;
  }
}
