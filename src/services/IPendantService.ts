/**
 * Ambient Memory Pendant - Decoupled Pendant Service Contract
 * UI components interact strictly with this interface, never coupling directly
 * to hardware transports (Mock, Web BLE, or Wi-Fi SoftAP).
 */

import { PendantDeviceStatus, TransportType } from '../types/device';
import { SyncManifestItem, TransferState } from '../types/protocol';
import { RecordingSession } from '../types/session';

export type StatusListener = (status: PendantDeviceStatus) => void;
export type TransferListener = (state: TransferState | null) => void;
export type SessionsUpdatedListener = () => void;

export interface IPendantService {
  /** Returns the current device status snapshot */
  getStatus(): PendantDeviceStatus;

  /** Returns active audio transfer progress state, or null if idle */
  getActiveTransfer(): TransferState | null;

  /** Returns active transport mode (mock, web_ble, wifi_http) */
  getActiveTransportType(): TransportType;

  /** Subscribe to device connection, battery, storage, and mode changes */
  subscribeStatus(listener: StatusListener): () => void;

  /** Subscribe to binary chunk transfer progress */
  subscribeTransfer(listener: TransferListener): () => void;

  /** Subscribe to session list updates (e.g. after new recording or sync) */
  subscribeSessionUpdates(listener: SessionsUpdatedListener): () => void;

  /** Switch active transport backend (mock, web_ble, wifi_http) */
  setTransport(type: TransportType, wifiEndpoint?: string): Promise<void>;

  /** Connect to the pendant device */
  connect(): Promise<boolean>;

  /** Disconnect safely from the pendant device */
  disconnect(): Promise<void>;

  /** Start a new recording session on the pendant */
  startRecording(): Promise<boolean>;

  /** Pause active recording without stopping session */
  pauseRecording(): Promise<boolean>;

  /** Resume a paused recording session */
  resumeRecording(): Promise<boolean>;

  /** Stop active recording, flush buffers to microSD, and finalize */
  stopRecording(): Promise<string | null>;

  /** Toggle hardware privacy mute (immediately halts and commits audio) */
  setPrivacyMute(enabled: boolean): Promise<boolean>;

  /** Fetch manifest of sessions stored on microSD */
  getPendantManifest(): Promise<SyncManifestItem[]>;

  /** Synchronize a single recording session from microSD to local IndexedDB */
  syncRecording(manifestItem: SyncManifestItem, autoDeleteFromSd?: boolean): Promise<RecordingSession>;

  /** Pause an in-progress audio transfer */
  pauseTransfer(): void;

  /** Resume a paused audio transfer */
  resumeTransfer(): void;

  /** Cancel an in-progress audio transfer */
  cancelTransfer(): void;

  /** Simulate a connection error for testing UI error resilience (Simulator only) */
  simulateConnectionError?(errorMessage: string): void;
}
