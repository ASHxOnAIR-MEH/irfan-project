/**
 * Ambient Memory Pendant - Device & Hardware Telemetry Models
 * Strict adherence to hardware reality:
 * Target: ESP32-S3 microcontroller with onboard battery charging circuitry.
 * Peripherals (Microphone, MicroSD, Battery sense, Privacy button, LEDs) are marked TBD
 * until schematic/bench testing is verified. Uncalibrated/unmeasured values are typed as null.
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type DeviceOperatingMode = 'idle' | 'recording' | 'paused' | 'syncing' | 'privacy_muted' | 'low_power' | 'error';
export type TransportType = 'mock' | 'web_ble' | 'wifi_http' | 'web_serial';

export type ChargingStatusSignal = 'charging' | 'charged' | 'not_charging' | 'unknown';

export interface BatteryTelemetry {
  /** True: board features onboard charging circuit according to hardware design */
  chargingCircuitSupported: boolean;
  /** Actual charging status signal if hardware STAT pin is monitored (or 'unknown' if not wired) */
  chargingStatusSignal: ChargingStatusSignal;
  /** Convenience flag: true if chargingStatusSignal === 'charging', null if unknown */
  isCharging: boolean | null;
  /** Raw ADC battery voltage reading in millivolts, or null if unmeasured / uncalibrated */
  voltageMv: number | null;
  /** Estimated battery percentage (0-100), or null if ADC voltage curve is uncalibrated */
  percentage: number | null;
  /** Estimated operating battery run-time remaining in minutes, or null if undetermined */
  estimatedRunMinutesRemaining: number | null;
  /** Battery condition evaluation based on voltage stability */
  health: 'good' | 'degraded' | 'unknown';
}

export interface StorageTelemetry {
  /** MicroSD total size in bytes, or null if missing or unmeasured */
  totalBytes: number | null;
  /** MicroSD used bytes, or null if unmeasured */
  usedBytes: number | null;
  /** MicroSD free bytes, or null if unmeasured */
  freeBytes: number | null;
  /** Estimated remaining recording time in minutes at 16kHz 16-bit mono PCM (32KB/sec) */
  estimatedMinutesRemaining: number | null;
  /** MicroSD card state */
  status: 'mounted' | 'missing' | 'write_error' | 'unformatted';
}

export interface HardwareProfile {
  mcu: 'ESP32-S3 Super Mini (Dual-Core LX7, Onboard Charger)';
  boardModel: 'ESP32-S3 Super Mini (Onboard Battery Charging Circuitry)';
  flashSizeMb: number;
  psramSizeMb?: number;
  hasOnboardChargingCircuit: boolean;
  /** 
   * Pinouts are marked optional and flagged as unverified (TBD) until physical schematic/bench check.
   * DO NOT hardcode as verified without bench testing!
   */
  gpioPinout: {
    micI2sBclk?: number;
    micI2sWs?: number;
    micI2sDataIn?: number;
    sdSpiCs?: number;
    sdSpiMosi?: number;
    sdSpiMiso?: number;
    sdSpiSck?: number;
    sdMmcData0?: number;
    sdMmcClk?: number;
    sdMmcCmd?: number;
    adcBatteryPin?: number;
    chargeStatusPin?: number;
    privacyButtonPin?: number;
    statusLedPin?: number;
  };
  isVerifiedOnHardware: boolean;
  notes: string;
}

export interface PendantDeviceStatus {
  deviceId: string;
  hardwareRevision: string;
  firmwareVersion: string;
  connectionState: ConnectionState;
  operatingMode: DeviceOperatingMode;
  battery: BatteryTelemetry;
  storage: StorageTelemetry;
  clock: {
    deviceRtcTimestampMs: number | null;
    isClockSynchronized: boolean;
  };
  activeRecordingId: string | null;
  activeRecordingDurationSec: number;
  lastSyncTimestampMs: number | null;
  transportType: TransportType;
  signalRssi: number | null; // dBm or null if not wireless
  privacyMuteActive: boolean; // True when hardware privacy button is engaged (blocks recording)
  connectionErrorMessage?: string | null;
}
