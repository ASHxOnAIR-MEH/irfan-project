/**
 * Ambient Memory Pendant - Web Bluetooth (GATT) Transport
 * Compatible with Chromium-based browsers (Chrome, Edge, Chrome for Android).
 * Note: Apple Safari on iOS does NOT support Web Bluetooth. Use WifiHttpTransport instead.
 */

import { PendantDeviceStatus } from '../../types/device';
import { FirmwareCommand, SyncManifestItem, TransferPacket } from '../../types/protocol';
import { ITransport } from './ITransport';

// Placeholder BLE Service & Characteristic UUIDs (pending physical firmware specification)
export const BLE_SERVICES = {
  PENDANT_SERVICE: '0000fe60-0000-1000-8000-00805f9b34fb',
  TELEMETRY_CHAR: '0000fe61-0000-1000-8000-00805f9b34fb',
  COMMAND_CHAR: '0000fe62-0000-1000-8000-00805f9b34fb',
  DATA_STREAM_CHAR: '0000fe63-0000-1000-8000-00805f9b34fb',
};

export class WebBleTransport implements ITransport {
  public readonly id = 'web_ble';
  public readonly name = 'Bluetooth Low Energy (Web BLE)';
  public readonly type = 'web_ble' as const;

  private connected: boolean = false;
  private statusListeners: Set<(status: PendantDeviceStatus) => void> = new Set();

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error(
        'Web Bluetooth is not supported in this browser environment. ' +
        'If you are on an iPhone or iPad, Safari prohibits Web Bluetooth. ' +
        'Please switch to Local WiFi SoftAP mode or use Chrome/Edge on Desktop/Android.'
      );
    }

    try {
      // In production, invoke navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'Pendant' }] })
      // For now, declare interface contract
      throw new Error(
        'Physical BLE hardware not yet paired. Please verify ESP32-S3 firmware flash ' +
        'or switch to the Virtual Emulator transport.'
      );
    } catch (err: unknown) {
      this.connected = false;
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  public subscribeStatus(callback: (status: PendantDeviceStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  public async sendCommand(_cmd: FirmwareCommand): Promise<unknown> {
    throw new Error('BLE Transport not connected to physical device');
  }

  public async fetchManifest(): Promise<SyncManifestItem[]> {
    throw new Error('BLE Transport not connected to physical device');
  }

  public async requestChunk(_sessionId: string, _chunkIndex: number): Promise<TransferPacket> {
    throw new Error('BLE Transport not connected to physical device');
  }

  public async acknowledgeSync(_sessionId: string, _deleteFromSd: boolean): Promise<boolean> {
    throw new Error('BLE Transport not connected to physical device');
  }

  public async startRecording(): Promise<boolean> {
    throw new Error('BLE Transport not connected to physical device');
  }

  public async stopRecording(): Promise<string | null> {
    throw new Error('BLE Transport not connected to physical device');
  }
}
