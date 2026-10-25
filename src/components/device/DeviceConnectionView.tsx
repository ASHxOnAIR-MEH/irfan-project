import React, { useState } from 'react';
import { 
  Radio, 
  Bluetooth, 
  Wifi, 
  Cpu, 
  Battery, 
  BatteryCharging, 
  HardDrive, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  ShieldAlert, 
  Sliders, 
  HelpCircle,
  Activity,
  ArrowRight
} from 'lucide-react';
import { PendantDeviceStatus, TransportType } from '../../types/device';
import { pendantManager } from '../../services/pendantManager';

interface DeviceConnectionViewProps {
  status: PendantDeviceStatus;
  onOpenSimulator: () => void;
  onNavigateToSessions: () => void;
}

export const DeviceConnectionView: React.FC<DeviceConnectionViewProps> = ({
  status,
  onOpenSimulator,
  onNavigateToSessions,
}) => {
  const [selectedTransport, setSelectedTransport] = useState<TransportType>(status.transportType);
  const [isAttemptingConnect, setIsAttemptingConnect] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isConnected = status.connectionState === 'connected';
  const isConnecting = status.connectionState === 'connecting' || isAttemptingConnect;
  const isError = status.connectionState === 'error' || localError !== null;
  const isRecording = status.operatingMode === 'recording';
  const isPaused = status.operatingMode === 'paused';

  // Check browser capabilities
  const isWebBleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const isIosDevice = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleTransportChange = async (type: TransportType) => {
    try {
      setSelectedTransport(type);
      setLocalError(null);
      await pendantManager.setTransport(type);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to switch transport');
    }
  };

  const handleConnect = async () => {
    setIsAttemptingConnect(true);
    setLocalError(null);
    try {
      await pendantManager.connect();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Connection handshake failed');
    } finally {
      setIsAttemptingConnect(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLocalError(null);
      await pendantManager.disconnect();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Disconnect error');
    }
  };

  const handleSimulateError = () => {
    pendantManager.simulateConnectionError('Simulated transport disconnection (ESP32-S3 signal lost or timeout)');
  };

  const handleRecordToggle = async () => {
    try {
      if (isRecording) {
        await pendantManager.stopRecording();
      } else if (isPaused) {
        await pendantManager.resumeRecording();
      } else {
        await pendantManager.startRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Record control error');
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (isRecording) {
        await pendantManager.pauseRecording();
      } else if (isPaused) {
        await pendantManager.resumeRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Pause/resume error');
    }
  };

  const handleStopRecord = async () => {
    try {
      await pendantManager.stopRecording();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Stop record error');
    }
  };

  const handlePrivacyToggle = async () => {
    try {
      await pendantManager.setPrivacyMute(!status.privacyMuteActive);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Privacy switch toggle error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 980, margin: '0 auto', width: '100%' }}>
      {/* 1. Primary Device Status Hero */}
      <div 
        className={isConnected ? 'dark-panel' : 'white-card'}
        style={{
          padding: 32,
          border: isConnected ? 'none' : isError ? '1.5px solid #fecdd3' : '1px solid var(--border-card)',
          background: isError ? '#fff1f2' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              background: isConnected
                ? 'rgba(255, 255, 255, 0.1)'
                : isConnecting
                ? '#ecfdf5'
                : isError
                ? '#fee2e2'
                : '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${
                isConnected
                  ? 'rgba(255, 255, 255, 0.2)'
                  : isConnecting
                  ? '#a7f3d0'
                  : isError
                  ? '#fca5a5'
                  : '#bce3cf'
              }`,
            }}>
              {isConnecting ? (
                <RefreshCw size={26} color="var(--accent-emerald)" style={{ animation: 'spin 1.5s linear infinite' }} />
              ) : isConnected ? (
                <Radio size={28} color="#34d399" />
              ) : isError ? (
                <AlertTriangle size={28} color="var(--accent-rose)" />
              ) : (
                <Radio size={28} color="var(--accent-forest)" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: isConnected ? '#ffffff' : 'var(--text-primary)' }}>
                  {isConnected
                    ? status.deviceId
                    : isConnecting
                    ? 'Connecting to Pendant...'
                    : isError
                    ? 'Connection Error'
                    : 'Pendant Disconnected'}
                </h2>
                <span className={`badge ${
                  isConnected
                    ? 'badge-emerald'
                    : isConnecting
                    ? 'badge-emerald'
                    : isError
                    ? 'badge-rose'
                    : 'badge-amber'
                }`}>
                  {status.connectionState.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '0.86rem', color: isConnected ? '#d1fae5' : 'var(--text-secondary)' }}>
                {isConnected
                  ? `${status.hardwareRevision} • Firmware v${status.firmwareVersion}`
                  : isConnecting
                  ? 'Establishing secure link and synchronizing hardware RTC clock...'
                  : isError
                  ? (status.connectionErrorMessage || localError || 'Failed to establish connection with device.')
                  : 'Select your preferred transport below to connect with your Ambient Pendant.'}
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {isConnected ? (
              <>
                <button
                  onClick={handleDisconnect}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                >
                  Disconnect
                </button>
                <button
                  onClick={onOpenSimulator}
                  className="btn btn-mint-bright"
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                >
                  <Sliders size={15} /> Simulator Controls
                </button>
              </>
            ) : isConnecting ? (
              <button
                onClick={handleDisconnect}
                className="btn btn-secondary"
                style={{ padding: '8px 18px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
            ) : isError ? (
              <>
                <button
                  onClick={handleConnect}
                  className="btn btn-forest"
                  style={{ padding: '8px 22px', fontSize: '0.88rem' }}
                >
                  <RefreshCw size={15} /> Retry Connection
                </button>
                <button
                  onClick={() => handleTransportChange('mock')}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                >
                  Switch to Emulator
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleConnect}
                  className="btn btn-forest"
                  style={{ padding: '10px 24px', fontSize: '0.92rem' }}
                >
                  <Radio size={16} /> Connect to Pendant
                </button>
                <button
                  onClick={handleSimulateError}
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}
                  title="Simulate connection failure for QA testing"
                >
                  Test Error State
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Controls Bar when Connected */}
        {isConnected && (
          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>Live Actions:</span>

              <button
                onClick={handleRecordToggle}
                className={`btn ${isRecording || isPaused ? 'btn-danger' : 'btn-mint-bright'}`}
                style={{ padding: '7px 16px', fontSize: '0.82rem' }}
              >
                {isRecording ? <Square size={14} fill="currentColor" /> : <Play size={14} />}
                <span>{isRecording ? 'Recording Active' : isPaused ? 'Resume Capture' : 'Start Recording'}</span>
              </button>

              {(isRecording || isPaused) && (
                <button
                  onClick={handlePauseToggle}
                  className="btn btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
              )}

              {(isRecording || isPaused) && (
                <button
                  onClick={handleStopRecord}
                  className="btn btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  <Square size={14} />
                  <span>Stop & Commit</span>
                </button>
              )}

              <button
                onClick={handlePrivacyToggle}
                className="btn"
                style={{
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  background: status.privacyMuteActive ? 'var(--accent-rose)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  borderColor: status.privacyMuteActive ? 'var(--accent-rose)' : 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <ShieldAlert size={14} />
                <span>{status.privacyMuteActive ? 'Privacy Muted' : 'Privacy Mute'}</span>
              </button>
            </div>

            <button
              onClick={onNavigateToSessions}
              className="btn btn-secondary"
              style={{ padding: '7px 16px', fontSize: '0.82rem' }}
            >
              <span>View Recordings</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 2. Live Telemetry Inspection Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {/* Battery Telemetry Card */}
        <div className="white-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {status.battery.isCharging ? (
                <BatteryCharging size={18} color="var(--accent-emerald)" />
              ) : (
                <Battery size={18} color="var(--accent-forest)" />
              )}
              <h3 style={{ fontSize: '1rem' }}>Battery & Charging</h3>
            </div>
            <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
              {status.battery.chargingCircuitSupported ? 'Onboard Charger' : 'No Charger'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {status.battery.percentage !== null ? `${status.battery.percentage}%` : 'Uncalibrated'}
            </span>
            {status.battery.percentage === null && (
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                (Voltage curve required)
              </span>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div>
              Charging State:{' '}
              <strong style={{ color: status.battery.isCharging ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                {status.battery.chargingStatusSignal}
              </strong>
            </div>
            <div>
              ADC Cell Voltage:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>
                {status.battery.voltageMv !== null ? `${status.battery.voltageMv} mV` : 'Null (Unmeasured)'}
              </strong>
            </div>
            <div>
              Estimated Run-Time:{' '}
              <strong>
                {status.battery.estimatedRunMinutesRemaining !== null
                  ? `${Math.floor(status.battery.estimatedRunMinutesRemaining / 60)}h ${status.battery.estimatedRunMinutesRemaining % 60}m`
                  : 'Undetermined'}
              </strong>
            </div>
          </div>
        </div>

        {/* MicroSD Storage Telemetry Card */}
        <div className="white-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive size={18} color="var(--accent-forest)" />
              <h3 style={{ fontSize: '1rem' }}>MicroSD Card Buffer</h3>
            </div>
            <span className={`badge ${status.storage.status === 'mounted' ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '0.68rem' }}>
              {status.storage.status.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {status.storage.usedBytes !== null && status.storage.totalBytes !== null
                ? `${(status.storage.usedBytes / 1073741824).toFixed(1)} / ${(status.storage.totalBytes / 1073741824).toFixed(0)} GB`
                : 'Offline'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div>
              Storage Role: <strong style={{ color: 'var(--accent-emerald)' }}>Source of Truth</strong>
            </div>
            <div>
              Remaining Recording Capacity:{' '}
              <strong>
                {status.storage.estimatedMinutesRemaining !== null
                  ? `~${Math.floor(status.storage.estimatedMinutesRemaining / 60)} hrs (${status.storage.estimatedMinutesRemaining} mins)`
                  : 'Undetermined'}
              </strong>
            </div>
            <div>
              Filesystem Format: <strong>FAT32 (16kHz WAV)</strong>
            </div>
          </div>
        </div>

        {/* Wireless Link & Transport Diagnostic */}
        <div className="white-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="var(--accent-forest)" />
              <h3 style={{ fontSize: '1rem' }}>Link & Transport</h3>
            </div>
            <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
              {status.transportType.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {status.signalRssi !== null ? `${status.signalRssi} dBm` : 'Direct Link'}
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div>
              Clock Sync:{' '}
              <strong style={{ color: status.clock.isClockSynchronized ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                {status.clock.isClockSynchronized ? 'Synchronized with Client' : 'Pending Sync'}
              </strong>
            </div>
            <div>
              Transfer Chunk Size: <strong>4096 Bytes with CRC32</strong>
            </div>
            <div>
              Active Adapter:{' '}
              <strong style={{ color: 'var(--accent-forest)' }}>
                {status.transportType === 'mock' ? 'Virtual Hardware Simulator' : status.transportType === 'web_ble' ? 'Web Bluetooth GATT' : 'Local Wi-Fi SoftAP'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Transport Adapter Selection Grid */}
      <div className="white-card" style={{ padding: 28 }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: 6 }}>Select Hardware Transport Adapter</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Choose how the companion PWA interfaces with the pendant. You can test the entire workflow with the simulator before assembling physical electronics.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Transport 1: Mock Emulator */}
          <div
            onClick={() => handleTransportChange('mock')}
            style={{
              padding: 20,
              borderRadius: '16px',
              background: selectedTransport === 'mock' ? '#f0fdf4' : '#ffffff',
              border: `2px solid ${selectedTransport === 'mock' ? 'var(--accent-emerald)' : 'var(--border-card)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={18} color="var(--accent-forest)" />
                <span style={{ fontWeight: 800, fontSize: '0.94rem' }}>Mock Emulator</span>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>Software-First</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              100% offline virtual ESP32-S3 hardware emulator. Generates synthesized test audio, simulates chunked transfers, and provides fault injection without needing hardware.
            </p>
          </div>

          {/* Transport 2: Web Bluetooth */}
          <div
            onClick={() => handleTransportChange('web_ble')}
            style={{
              padding: 20,
              borderRadius: '16px',
              background: selectedTransport === 'web_ble' ? '#f0fdf4' : '#ffffff',
              border: `2px solid ${selectedTransport === 'web_ble' ? 'var(--accent-emerald)' : 'var(--border-card)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bluetooth size={18} color="var(--accent-forest)" />
                <span style={{ fontWeight: 800, fontSize: '0.94rem' }}>Web Bluetooth (BLE)</span>
              </div>
              <span className={`badge ${isWebBleSupported ? 'badge-emerald' : 'badge-amber'}`} style={{ fontSize: '0.65rem' }}>
                {isWebBleSupported ? 'Browser Ready' : 'Unsupported Browser'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Standard BLE GATT wireless profile for Chromium and Android devices. Best for real-time telemetry streaming and lightweight control commands.
            </p>
          </div>

          {/* Transport 3: Wi-Fi SoftAP / HTTP */}
          <div
            onClick={() => handleTransportChange('wifi_http')}
            style={{
              padding: 20,
              borderRadius: '16px',
              background: selectedTransport === 'wifi_http' ? '#f0fdf4' : '#ffffff',
              border: `2px solid ${selectedTransport === 'wifi_http' ? 'var(--accent-emerald)' : 'var(--border-card)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={18} color="var(--accent-forest)" />
                <span style={{ fontWeight: 800, fontSize: '0.94rem' }}>Local Wi-Fi SoftAP</span>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>iOS Safari Ready</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Connect directly to the pendant's local Wi-Fi hotspot (`192.168.4.1`). Universal compatibility with Apple iOS Safari and ~50x faster audio transfers.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Platform Reality & iOS Safari Architecture Notice */}
      {isIosDevice && (
        <div style={{
          background: '#ecfdf5',
          border: '1.5px solid #a7f3d0',
          borderRadius: '16px',
          padding: 20,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <HelpCircle size={22} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 4, color: 'var(--text-primary)' }}>
              iOS Safari Platform Architecture Notice
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Apple Safari (and all iOS browsers) does not support the W3C Web Bluetooth API.
              The Ambient Memory Pendant solves this transparently: the ESP32-S3 broadcasts a local Wi-Fi SoftAP
              (e.g., <code>AmbientPendant-9A71</code>). Once joined, audio transfers stream at 1.5–4.0 MB/s directly
              over local HTTP REST, providing full offline capability on iPhone and iPad without native app store friction.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
