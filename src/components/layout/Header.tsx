import React, { useEffect, useState } from 'react';
import { 
  Radio, 
  Battery, 
  BatteryCharging, 
  BatteryWarning, 
  HardDrive, 
  Sparkles, 
  Sliders, 
  Download,
  AlertCircle
} from 'lucide-react';
import { PendantDeviceStatus } from '../../types/device';
import { pendantManager } from '../../services/pendantManager';

interface HeaderProps {
  status: PendantDeviceStatus;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onToggleSimulator: () => void;
  simulatorOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeTab: _activeTab,
  onTabChange,
  onToggleSimulator,
  simulatorOpen,
}) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleConnectToggle = async () => {
    try {
      if (status.connectionState === 'connected') {
        await pendantManager.disconnect();
      } else {
        await pendantManager.connect();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const isRecording = status.operatingMode === 'recording';

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(6, 8, 13, 0.82)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 16px',
    }}>
      <div style={{
        maxWidth: 1240,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        {/* Brand & Logo */}
        <div 
          onClick={() => onTabChange('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--grad-pendant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-cyan)',
          }}>
            <Sparkles size={20} color="#06080d" />
            {isRecording && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--accent-rose)',
                border: '2px solid #06080d',
              }} className="recording-pulse" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                Ambient Pendant
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                {status.transportType === 'mock' ? 'Emulator' : status.transportType === 'web_ble' ? 'BLE' : 'WiFi'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ESP32-S3 Super Mini • Onboard Charger
            </div>
          </div>
        </div>

        {/* Device Status & Telemetry Pill Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Privacy Mute Indicator if engaged */}
          {status.privacyMuteActive && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                borderRadius: 'var(--radius-full)',
                padding: '5px 10px',
                fontSize: '0.74rem',
                color: '#fda4af',
                fontWeight: 600,
              }}
              title="Hardware privacy control active - recording muted"
            >
              <AlertCircle size={14} color="var(--accent-rose)" />
              <span>Privacy Muted</span>
            </div>
          )}
          {/* Battery Status */}
          <div 
            title={status.battery.voltageMv ? `${status.battery.voltageMv} mV` : 'Battery Voltage Uncalibrated'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '5px 10px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            {status.battery.isCharging ? (
              <BatteryCharging size={16} color="var(--accent-amber)" />
            ) : status.battery.percentage === null ? (
              <BatteryWarning size={16} color="var(--accent-amber)" />
            ) : (
              <Battery size={16} color="var(--accent-emerald)" />
            )}
            <span style={{ fontWeight: 600 }}>
              {status.battery.percentage !== null ? `${status.battery.percentage}%` : 'Uncalibrated'}
            </span>
          </div>

          {/* Storage Status */}
          <div 
            title={status.storage.freeBytes ? `${(status.storage.freeBytes / (1024**3)).toFixed(1)} GB Free on MicroSD` : 'MicroSD Status'}
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '5px 10px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
            className="header-storage-pill"
          >
            <HardDrive size={16} color="var(--accent-cyan)" />
            <span>
              {status.storage.freeBytes ? `${Math.round(status.storage.freeBytes / (1024**3))}GB Free` : 'SD Ready'}
            </span>
          </div>

          {/* Connection Toggle Button */}
          <button
            onClick={handleConnectToggle}
            className={`btn ${status.connectionState === 'connected' ? 'btn-secondary' : 'btn-primary'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <Radio 
              size={15} 
              color={status.connectionState === 'connected' ? 'var(--accent-emerald)' : '#06080d'} 
            />
            <span>
              {status.connectionState === 'connected' ? 'Connected' : 'Connect'}
            </span>
          </button>

          {/* PWA Install Button (if prompt ready) */}
          {installPrompt && !isInstalled && (
            <button
              onClick={handleInstallClick}
              className="btn btn-secondary"
              title="Install Ambient Pendant PWA"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: 'var(--radius-full)',
                borderColor: 'var(--accent-cyan)',
                color: 'var(--accent-cyan)',
              }}
            >
              <Download size={14} />
              <span style={{ display: 'none' }} className="install-label">Install App</span>
            </button>
          )}

          {/* Hardware Simulator Toggle */}
          <button
            onClick={onToggleSimulator}
            title="Toggle Hardware Emulator Controls"
            style={{
              background: simulatorOpen ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${simulatorOpen ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              color: simulatorOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderRadius: 10,
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={17} />
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .header-storage-pill {
            display: flex !important;
          }
          .install-label {
            display: inline !important;
          }
        }
      `}</style>
    </header>
  );
};
