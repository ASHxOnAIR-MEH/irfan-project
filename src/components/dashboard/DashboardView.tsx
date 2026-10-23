import React from 'react';
import { 
  Battery, 
  BatteryCharging, 
  BatteryWarning, 
  HardDrive, 
  Mic, 
  Square, 
  ArrowDownCircle, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  AlertCircle,
  FileAudio,
  Radio,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { PendantDeviceStatus } from '../../types/device';
import { SyncManifestItem } from '../../types/protocol';
import { RecordingSession } from '../../types/session';
import { pendantManager } from '../../services/pendantManager';

interface DashboardViewProps {
  status: PendantDeviceStatus;
  recentSessions: RecordingSession[];
  pendingManifest: SyncManifestItem[];
  onSelectSession: (session: RecordingSession) => void;
  onSyncSession: (item: SyncManifestItem) => void;
  onViewAllSessions: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  status,
  recentSessions,
  pendingManifest,
  onSelectSession,
  onSyncSession,
  onViewAllSessions,
}) => {
  const isRecording = status.operatingMode === 'recording';
  const isConnected = status.connectionState === 'connected';

  // Storage percentage calculation
  const storagePercent = status.storage.totalBytes && status.storage.usedBytes
    ? Math.min(100, Math.round((status.storage.usedBytes / status.storage.totalBytes) * 100))
    : 0;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Hero Telemetry Banner & Live Recording Bar */}
      <div 
        className="glass-card"
        style={{
          padding: 24,
          background: isRecording
            ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(13, 19, 32, 0.9) 100%)'
            : 'linear-gradient(135deg, rgba(0, 242, 254, 0.08) 0%, rgba(13, 19, 32, 0.9) 100%)',
          border: isRecording ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-card)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className={`badge ${isConnected ? 'badge-emerald' : 'badge-amber'}`}>
                {status.connectionState.toUpperCase()}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {status.hardwareRevision}
              </span>
            </div>

            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {status.privacyMuteActive ? (
                <span style={{ color: '#fda4af', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={22} color="var(--accent-rose)" />
                  Privacy Switch Engaged — Recording Muted
                </span>
              ) : isRecording ? (
                <span style={{ color: '#fda4af', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="recording-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-rose)' }} />
                  Recording Audio Memo... ({status.activeRecordingDurationSec}s)
                </span>
              ) : (
                'Ambient Memory Pendant'
              )}
            </h2>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {status.privacyMuteActive
                ? 'Hardware privacy button active on pendant. Audio capture is physically inhibited.'
                : isRecording
                ? 'Writing continuous audio stream to MicroSD storage buffer.'
                : 'Standby mode. Voice memos are captured locally on physical microSD.'}
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isConnected && (
              <button
                onClick={handleRecordToggle}
                className={`btn ${isRecording ? 'btn-danger' : 'btn-record'}`}
                style={{ padding: '10px 20px' }}
              >
                {isRecording ? (
                  <>
                    <Square size={16} fill="currentColor" /> Stop & Save to MicroSD
                  </>
                ) : (
                  <>
                    <Mic size={16} /> Record Voice Memo
                  </>
                )}
              </button>
            )}

            {!isConnected && (
              <button
                onClick={() => pendantManager.connect()}
                className="btn btn-primary"
                style={{ padding: '10px 20px' }}
              >
                <Radio size={16} /> Connect Device
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Hardware Telemetry Gauges Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {/* Battery Card */}
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {status.battery.isCharging ? (
                <BatteryCharging size={20} color="var(--accent-amber)" />
              ) : status.battery.percentage === null ? (
                <BatteryWarning size={20} color="var(--accent-amber)" />
              ) : (
                <Battery size={20} color="var(--accent-emerald)" />
              )}
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Battery Telemetry</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <span className={`badge ${status.battery.chargingStatusSignal === 'charging' ? 'badge-amber' : status.battery.chargingStatusSignal === 'charged' ? 'badge-emerald' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                {status.battery.chargingStatusSignal === 'charging' ? 'Charging' : status.battery.chargingStatusSignal === 'charged' ? 'Charged' : status.battery.chargingStatusSignal === 'not_charging' ? 'On Battery' : 'Signal Unknown'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {status.battery.percentage !== null ? `${status.battery.percentage}%` : 'Uncalibrated'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {status.battery.voltageMv ? `${(status.battery.voltageMv / 1000).toFixed(2)} V` : 'ADC unmeasured'}
            </span>
          </div>

          {status.battery.percentage !== null ? (
            <div style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              marginBottom: 6,
            }}>
              <div style={{
                height: '100%',
                width: `${status.battery.percentage}%`,
                background: status.battery.percentage < 20 ? 'var(--accent-rose)' : 'var(--grad-emerald)',
              }} />
            </div>
          ) : (
            <div style={{ fontSize: '0.74rem', color: 'var(--accent-amber)', fontStyle: 'italic', marginBottom: 6 }}>
              * Voltage divider ADC curve awaiting physical bench measurement.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span>Onboard Charger: Supported</span>
            <span>{status.battery.estimatedRunMinutesRemaining ? `~${Math.round(status.battery.estimatedRunMinutesRemaining / 60)}h run-time` : 'Run-time: TBD'}</span>
          </div>
        </div>

        {/* MicroSD Storage Card */}
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive size={20} color="var(--accent-cyan)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>MicroSD Peripheral</span>
            </div>
            <span className="badge badge-cyan">
              {status.storage.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {status.storage.freeBytes ? `${(status.storage.freeBytes / (1024**3)).toFixed(1)} GB` : 'N/A'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              free of {status.storage.totalBytes ? `${Math.round(status.storage.totalBytes / (1024**3))} GB` : 'N/A'}
            </span>
          </div>

          <div style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            marginBottom: 8,
          }}>
            <div style={{
              height: '100%',
              width: `${storagePercent}%`,
              background: 'var(--grad-pendant)',
            }} />
          </div>

          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Est. ~{status.storage.estimatedMinutesRemaining ? Math.round(status.storage.estimatedMinutesRemaining / 60) : 0} hrs voice memo capacity remaining
          </div>
        </div>

        {/* Active Transport & Controller Summary */}
        <div className="glass-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={20} color="var(--accent-purple)" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Controller & Sync</span>
            </div>
            <span className="badge badge-purple">
              ESP32-S3 Super Mini
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {pendingManifest.length}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              recordings pending on MicroSD
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            <Radio size={13} color="var(--accent-cyan)" />
            <span>Transport: {status.transportType === 'mock' ? 'Virtual Emulator' : status.transportType === 'web_ble' ? 'Bluetooth LE' : 'WiFi SoftAP'}</span>
          </div>
        </div>
      </div>

      {/* 3. MicroSD Recordings Pending Sync (if any) */}
      {pendingManifest.length > 0 && (
        <div 
          className="glass-card"
          style={{
            padding: 20,
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.05) 0%, rgba(13, 19, 32, 0.9) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowDownCircle size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '1.05rem' }}>MicroSD Recordings Ready to Synchronize</h3>
            </div>
            <span className="badge badge-amber">
              {pendingManifest.length} Pending
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingManifest.map((item) => (
              <div
                key={item.sessionId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileAudio size={18} color="var(--accent-cyan)" />
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{item.filename}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatDuration(item.durationSeconds)} • {(item.fileSizeBytes / 1024).toFixed(0)} KB • {formatDate(item.capturedAtMs)}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSyncSession(item)}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.76rem' }}
                >
                  <ArrowDownCircle size={14} /> Sync & Transcribe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Hardware Reality & Architecture Notice */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        background: 'rgba(0, 242, 254, 0.04)',
        border: '1px solid rgba(0, 242, 254, 0.2)',
        borderRadius: 12,
        fontSize: '0.82rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.55,
      }}>
        <AlertCircle size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Software-First Architecture Notice:</strong>{' '}
          All telemetry, battery readings, and session transfers simulate the physical constraints of the ESP32-S3 Super Mini board with onboard battery charging circuitry. 
          Microphone, microSD storage, status signals, and ADC battery divider curves are marked TBD pending physical schematic/bench verification without altering this application layer.
        </div>
      </div>

      {/* 5. Recent Sessions Quick Review */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.05rem' }}>Recently Synced Sessions</h3>
          </div>
          <button
            onClick={onViewAllSessions}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.76rem' }}
          >
            <span>View All</span>
            <ExternalLink size={13} />
          </button>
        </div>

        {recentSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            No sessions synchronized yet. Click "Record Voice Memo" or sync pending files above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentSessions.slice(0, 3).map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className="session-list-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(0, 242, 254, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FileAudio size={18} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {session.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                      <span>{formatDate(session.capturedAtMs)}</span>
                      <span>•</span>
                      <span>{formatDuration(session.metadata.durationSeconds)}</span>
                      <span>•</span>
                      <span>{session.insights.actionItems.length} action items</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
                    <CheckCircle2 size={11} /> Synced
                  </span>
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
                    <Sparkles size={12} color="var(--accent-cyan)" /> Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .session-list-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(0, 242, 254, 0.3) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};
