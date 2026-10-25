import React, { useState } from 'react';
import { 
  Sliders, 
  Battery, 
  BatteryCharging, 
  HardDrive, 
  Bug, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  CheckCircle2, 
  X, 
  HelpCircle, 
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { ChargingStatusSignal, PendantDeviceStatus } from '../../types/device';
import { pendantManager } from '../../services/pendantManager';

interface MockHardwareControlsProps {
  status: PendantDeviceStatus;
  isOpen: boolean;
  onClose: () => void;
}

export const MockHardwareControls: React.FC<MockHardwareControlsProps> = ({
  status,
  isOpen,
  onClose,
}) => {
  const [faultActive, setFaultActive] = useState(false);

  if (!isOpen) return null;

  const mockTransport = pendantManager.getMockTransport();
  const isRecording = status.operatingMode === 'recording';
  const isPaused = status.operatingMode === 'paused';
  const isPrivacyMuted = status.privacyMuteActive;

  const handleRecordToggle = async () => {
    try {
      if (isRecording || isPaused) {
        await pendantManager.stopRecording();
      } else {
        await pendantManager.startRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Record toggle error');
    }
  };

  const handlePauseResume = async () => {
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

  const handleTogglePrivacy = async () => {
    try {
      await pendantManager.setPrivacyMute(!isPrivacyMuted);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Privacy toggle error');
    }
  };

  const handleBatteryChange = (val: string) => {
    if (val === 'uncalibrated') {
      mockTransport.setBatteryPercentage(null);
    } else {
      mockTransport.setBatteryPercentage(parseInt(val, 10));
    }
  };

  const handleChargingSignalChange = (sig: ChargingStatusSignal) => {
    mockTransport.setChargingStatusSignal(sig);
  };

  const handleToggleFault = () => {
    const next = !faultActive;
    setFaultActive(next);
    mockTransport.setFailNextChunk(next);
  };

  const handleSimulateConnectionDrop = () => {
    mockTransport.simulateConnectionError('Simulated transport disconnection: ESP32 GATT signal dropped');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 76,
      right: 16,
      width: 'calc(100% - 32px)',
      maxWidth: 440,
      maxHeight: 'calc(100vh - 96px)',
      overflowY: 'auto',
      background: '#ffffff',
      border: '1.5px solid #d7ede1',
      borderRadius: 'var(--radius-lg)',
      boxShadow: '0 24px 60px rgba(5, 41, 30, 0.16)',
      zIndex: 150,
      padding: 20,
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-full)',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sliders size={17} color="var(--accent-emerald)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
              Hardware Testbed Simulator
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              ESP32-S3 + INMP441 + MicroSD
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close Simulator"
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
        Simulates ESP32-S3 Super Mini firmware behavior before physical assembly, including hardware privacy switch, battery voltage ADC, and CRC32 bit-flip fault injection.
      </p>

      {/* Control 1: Recording & Mic Peripheral */}
      <div style={{
        background: '#f2faf5',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        marginBottom: 12,
        border: '1px solid #d7ede1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-forest)' }}>
            INMP441 Microphone Peripheral:
          </span>
          <span className={`badge ${isPrivacyMuted ? 'badge-rose' : isRecording ? 'badge-rose' : isPaused ? 'badge-amber' : 'badge-emerald'}`}>
            {isPrivacyMuted ? 'Muted' : isRecording ? `REC (${status.activeRecordingDurationSec}s)` : isPaused ? 'Paused' : 'Standby'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(isRecording || isPaused) && (
            <button
              onClick={handlePauseResume}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem' }}
            >
              {isPaused ? <Play size={14} color="var(--accent-emerald)" /> : <Pause size={14} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            onClick={handleRecordToggle}
            disabled={isPrivacyMuted && !isRecording && !isPaused}
            className={`btn ${isRecording || isPaused ? 'btn-danger' : 'btn-forest'}`}
            style={{
              flex: 2,
              padding: '8px 14px',
              fontSize: '0.82rem',
              opacity: isPrivacyMuted && !isRecording && !isPaused ? 0.5 : 1,
            }}
          >
            {isRecording || isPaused ? (
              <>
                <Square size={13} fill="currentColor" /> Stop & Commit to SD
              </>
            ) : (
              <>
                <Mic size={14} /> Start Voice Memo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Control 2: Hardware Privacy Switch */}
      <div style={{
        background: isPrivacyMuted ? '#fff1f2' : '#f2faf5',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        marginBottom: 12,
        border: `1px solid ${isPrivacyMuted ? '#fecdd3' : '#d7ede1'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-forest)' }}>
            <ShieldAlert size={15} color={isPrivacyMuted ? 'var(--accent-rose)' : 'var(--accent-emerald)'} />
            <span>Hardware Privacy Switch:</span>
          </div>
          <span className={`badge ${isPrivacyMuted ? 'badge-rose' : 'badge-secondary'}`}>
            {isPrivacyMuted ? 'Muted' : 'Normal'}
          </span>
        </div>

        <button
          onClick={handleTogglePrivacy}
          className={`btn ${isPrivacyMuted ? 'btn-forest' : 'btn-danger'}`}
          style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem' }}
        >
          {isPrivacyMuted ? 'Disengage Privacy Switch (Allow Mic)' : 'Engage Hardware Privacy (Cut Mic)'}
        </button>
      </div>

      {/* Control 3: Battery & Charging Signals */}
      <div style={{
        background: '#f2faf5',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        marginBottom: 12,
        border: '1px solid #d7ede1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-forest)' }}>
            <Battery size={15} color="var(--accent-emerald)" />
            <span>Battery & Charging Signals:</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {status.battery.voltageMv ? `${(status.battery.voltageMv / 1000).toFixed(2)} V` : 'ADC uncalibrated'}
          </span>
        </div>

        {/* Battery percentage presets */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => handleBatteryChange('84')}
            className={`btn ${status.battery.percentage === 84 ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
          >
            84% (Nominal)
          </button>
          <button
            onClick={() => handleBatteryChange('14')}
            className={`btn ${status.battery.percentage === 14 ? 'btn-danger' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
          >
            14% (Low)
          </button>
          <button
            onClick={() => handleBatteryChange('uncalibrated')}
            className={`btn ${status.battery.percentage === null ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
            title="Simulate uncalibrated ADC without voltage lookup table"
          >
            <HelpCircle size={12} /> Uncalibrated
          </button>
        </div>

        {/* Charging Status Signal Selector */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
          Onboard Charger STAT Pin:
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleChargingSignalChange('charging')}
            className={`btn ${status.battery.chargingStatusSignal === 'charging' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 4px', fontSize: '0.7rem' }}
          >
            <BatteryCharging size={12} /> Charging
          </button>
          <button
            onClick={() => handleChargingSignalChange('charged')}
            className={`btn ${status.battery.chargingStatusSignal === 'charged' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 4px', fontSize: '0.7rem' }}
          >
            Charged
          </button>
          <button
            onClick={() => handleChargingSignalChange('not_charging')}
            className={`btn ${status.battery.chargingStatusSignal === 'not_charging' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 4px', fontSize: '0.7rem' }}
          >
            Discharging
          </button>
          <button
            onClick={() => handleChargingSignalChange('unknown')}
            className={`btn ${status.battery.chargingStatusSignal === 'unknown' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 4px', fontSize: '0.7rem' }}
          >
            Unknown
          </button>
        </div>
      </div>

      {/* Control 4: MicroSD State & Fault Injection */}
      <div style={{
        background: '#f2faf5',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        marginBottom: 12,
        border: '1px solid #d7ede1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-forest)' }}>
            <HardDrive size={15} color="var(--accent-emerald)" />
            <span>MicroSD Peripheral State:</span>
          </div>
          <span className={`badge ${status.storage.status === 'mounted' ? 'badge-emerald' : 'badge-rose'}`}>
            {status.storage.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => mockTransport.setStorageStatus('mounted')}
            className={`btn ${status.storage.status === 'mounted' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
          >
            <CheckCircle2 size={13} /> Mounted
          </button>
          <button
            onClick={() => mockTransport.setStorageStatus('missing')}
            className={`btn ${status.storage.status === 'missing' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '5px 8px', fontSize: '0.74rem' }}
          >
            Missing
          </button>
        </div>

        {/* Fault Injection Button */}
        <button
          onClick={handleToggleFault}
          className={`btn ${faultActive ? 'btn-danger' : 'btn-secondary'}`}
          style={{ width: '100%', padding: '7px 10px', fontSize: '0.75rem', marginBottom: 6 }}
          title="Inject bit-flip to test chunk CRC32 verification and auto-retry"
        >
          <Bug size={14} color={faultActive ? 'var(--accent-rose)' : 'var(--text-muted)'} />
          {faultActive ? 'Fault Active (Chunk bit-flip injected)' : 'Inject Packet Transfer Failure'}
        </button>

        {/* Connection Failure Button */}
        <button
          onClick={handleSimulateConnectionDrop}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '7px 10px', fontSize: '0.75rem', color: '#b91c1c', borderColor: '#fca5a5' }}
          title="Simulate sudden hardware connection disconnect"
        >
          <AlertTriangle size={14} /> Simulate Connection Drop
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: '6px 18px', fontSize: '0.78rem' }}
        >
          Close Simulator
        </button>
      </div>
    </div>
  );
};
