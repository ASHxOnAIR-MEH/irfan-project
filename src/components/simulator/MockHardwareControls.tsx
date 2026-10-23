import React, { useState } from 'react';
import { 
  Sliders, 
  Battery, 
  BatteryCharging, 
  HardDrive, 
  Bug, 
  Mic, 
  Square, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  ShieldAlert,
  Zap
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
  const mockTransport = pendantManager.getMockTransport();

  if (!isOpen) return null;

  const isRecording = status.operatingMode === 'recording';
  const isPrivacyMuted = status.privacyMuteActive;

  const handleRecordToggle = async () => {
    try {
      if (isRecording) {
        await pendantManager.stopRecording();
      } else {
        await pendantManager.startRecording();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Record toggle error');
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
    mockTransport.failNextChunk = next;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 64,
      right: 16,
      width: 'calc(100% - 32px)',
      maxWidth: 440,
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
      background: 'rgba(11, 16, 28, 0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--accent-cyan)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7), var(--shadow-glow-cyan)',
      zIndex: 150,
      padding: 18,
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            ESP32-S3 Super Mini Simulator
          </span>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <XCircle size={18} />
        </button>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
        Simulates ESP32-S3 Super Mini with onboard battery charging circuitry, external microphone peripheral, microSD storage, and hardware privacy switch.
      </p>

      {/* Control 1: Device Recording Trigger */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Pendant Peripheral Mic:</span>
          <span className={`badge ${isPrivacyMuted ? 'badge-rose' : isRecording ? 'badge-rose' : 'badge-emerald'}`}>
            {isPrivacyMuted ? 'Muted' : isRecording ? `REC (${status.activeRecordingDurationSec}s)` : 'Standby'}
          </span>
        </div>
        <button
          onClick={handleRecordToggle}
          disabled={isPrivacyMuted && !isRecording}
          className={`btn ${isRecording ? 'btn-danger' : 'btn-record'}`}
          style={{
            width: '100%',
            padding: '8px 14px',
            fontSize: '0.82rem',
            opacity: isPrivacyMuted && !isRecording ? 0.5 : 1,
          }}
        >
          {isRecording ? (
            <>
              <Square size={14} fill="currentColor" /> Stop Recording & Save to MicroSD
            </>
          ) : (
            <>
              <Mic size={14} /> Start Voice Memo on Pendant
            </>
          )}
        </button>
      </div>

      {/* Control 2: Hardware Privacy Button (Stops Recording Immediately) */}
      <div style={{
        background: isPrivacyMuted ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.04)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        border: `1px solid ${isPrivacyMuted ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-subtle)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}>
            <ShieldAlert size={15} color={isPrivacyMuted ? 'var(--accent-rose)' : 'var(--accent-cyan)'} />
            <span>Hardware Privacy Switch:</span>
          </div>
          <span className={`badge ${isPrivacyMuted ? 'badge-rose' : 'badge-secondary'}`}>
            {isPrivacyMuted ? 'Engaged (Muted)' : 'Disengaged'}
          </span>
        </div>

        <button
          onClick={handleTogglePrivacy}
          className={`btn ${isPrivacyMuted ? 'btn-primary' : 'btn-danger'}`}
          style={{ width: '100%', padding: '7px 12px', fontSize: '0.78rem' }}
        >
          {isPrivacyMuted ? 'Disengage Privacy Switch (Allow Mic)' : 'Press Privacy Switch (Halt Recording)'}
        </button>
      </div>

      {/* Control 3: Onboard Charger & Battery Telemetry Breakdown */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}>
            <Battery size={15} color="var(--accent-emerald)" />
            <span>Battery & Charging Signals:</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {status.battery.voltageMv ? `${(status.battery.voltageMv / 1000).toFixed(2)} V` : 'ADC uncalibrated'}
          </span>
        </div>

        {/* Battery percentage presets */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => handleBatteryChange('84')}
            className={`btn ${status.battery.percentage === 84 ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
          >
            84% (Good)
          </button>
          <button
            onClick={() => handleBatteryChange('14')}
            className={`btn ${status.battery.percentage === 14 ? 'btn-danger' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
          >
            14% (Low)
          </button>
          <button
            onClick={() => handleBatteryChange('uncalibrated')}
            className={`btn ${status.battery.percentage === null ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
            title="Simulate uncalibrated ADC without voltage lookup table"
          >
            <HelpCircle size={12} /> Uncalibrated
          </button>
        </div>

        {/* Charging Status Signal Selector */}
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          Onboard Charger STAT Signal:
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            onClick={() => handleChargingSignalChange('charging')}
            className={`btn ${status.battery.chargingStatusSignal === 'charging' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 4px', fontSize: '0.68rem' }}
          >
            <BatteryCharging size={11} /> Charging
          </button>
          <button
            onClick={() => handleChargingSignalChange('charged')}
            className={`btn ${status.battery.chargingStatusSignal === 'charged' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 4px', fontSize: '0.68rem' }}
          >
            Charged
          </button>
          <button
            onClick={() => handleChargingSignalChange('not_charging')}
            className={`btn ${status.battery.chargingStatusSignal === 'not_charging' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 4px', fontSize: '0.68rem' }}
          >
            Discharging
          </button>
          <button
            onClick={() => handleChargingSignalChange('unknown')}
            className={`btn ${status.battery.chargingStatusSignal === 'unknown' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 4px', fontSize: '0.68rem' }}
          >
            Unknown
          </button>
        </div>
      </div>

      {/* Control 4: MicroSD State & Fault Injection */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}>
            <HardDrive size={15} color="var(--accent-cyan)" />
            <span>MicroSD Peripheral State:</span>
          </div>
          <span className={`badge ${status.storage.status === 'mounted' ? 'badge-cyan' : 'badge-rose'}`}>
            {status.storage.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => mockTransport.setStorageStatus('mounted')}
            className={`btn ${status.storage.status === 'mounted' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.74rem' }}
          >
            <CheckCircle2 size={12} /> Mounted
          </button>
          <button
            onClick={() => mockTransport.setStorageStatus('missing')}
            className={`btn ${status.storage.status === 'missing' ? 'btn-danger' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.74rem' }}
          >
            Missing
          </button>
        </div>

        {/* Fault Injection Button */}
        <button
          onClick={handleToggleFault}
          className={`btn ${faultActive ? 'btn-danger' : 'btn-secondary'}`}
          style={{ width: '100%', padding: '6px 10px', fontSize: '0.75rem' }}
          title="Inject bit-flip to test chunk CRC32 verification and auto-retry"
        >
          <Bug size={14} color={faultActive ? 'var(--accent-rose)' : 'var(--text-muted)'} />
          {faultActive ? 'Fault Injected (Next Chunk will fail CRC)' : 'Inject Packet Transfer Failure'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ padding: '4px 14px', fontSize: '0.76rem', borderRadius: 'var(--radius-full)' }}
        >
          Hide Simulator
        </button>
      </div>
    </div>
  );
};
