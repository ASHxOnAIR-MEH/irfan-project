import { PendantDeviceStatus, TransportType } from '../../types/device';
import { FirmwareCommand, SyncManifestItem, TransferPacket } from '../../types/protocol';

export interface ITransport {
  readonly id: string;
  readonly name: string;
  readonly type: TransportType;

  /** Checks if current browser environment and hardware support this transport */
  isSupported(): boolean;

  /** Connect to the pendant device */
  connect(): Promise<boolean>;

  /** Disconnect safely */
  disconnect(): Promise<void>;

  /** Current connection check */
  isConnected(): boolean;

  /** Subscribe to real-time status and telemetry changes */
  subscribeStatus(callback: (status: PendantDeviceStatus) => void): () => void;

  /** Send a command to the pendant firmware */
  sendCommand(cmd: FirmwareCommand): Promise<unknown>;

  /** Fetch the directory of sessions recorded on microSD */
  fetchManifest(): Promise<SyncManifestItem[]>;

  /** Request a specific binary chunk for reliable download */
  requestChunk(sessionId: string, chunkIndex: number): Promise<TransferPacket>;

  /** Acknowledge successful download and verification */
  acknowledgeSync(sessionId: string, deleteFromSd: boolean): Promise<boolean>;

  /** Trigger recording directly from UI */
  startRecording(): Promise<boolean>;

  /** Stop recording and return created session ID */
  stopRecording(): Promise<string | null>;

  /** Engage or disengage hardware privacy mute (stops active recording) */
  setPrivacyMute?(enabled: boolean): Promise<boolean>;
}
