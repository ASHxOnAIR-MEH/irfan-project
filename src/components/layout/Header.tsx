import React, { useEffect, useState } from 'react';
import { 
  Radio, 
  Battery, 
  BatteryCharging, 
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
  activeTab,
  onTabChange,
  onToggleSimulator,
  simulatorOpen,
}) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
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
    if (status.connectionState !== 'connected') {
      onTabChange('device');
    } else {
      try {
        await pendantManager.disconnect();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Disconnect error');
      }
    }
  };

  const isRecording = status.operatingMode === 'recording';
  const isConnected = status.connectionState === 'connected';

  const navLinks = [
    { id: 'dashboard', label: 'Home' },
    { id: 'device', label: 'Device' },
    { id: 'sessions', label: 'Recordings' },
    { id: 'analyze', label: 'AI Analyze' },
    { id: 'insights', label: 'Insights' },
    { id: 'actions', label: 'Tasks' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255, 255, 255, 0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '12px 20px',
      boxShadow: '0 2px 12px rgba(5, 41, 30, 0.03)',
    }}>
      <div style={{
        maxWidth: 1240,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Brand & Logo (Reference style minimalist brand mark) */}
        <div 
          onClick={() => onTabChange('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: '12px',
            background: 'var(--accent-forest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(5, 41, 30, 0.2)',
          }}>
            <Sparkles size={18} color="#34d399" />
            {isRecording && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--accent-rose)',
                border: '2px solid #ffffff',
              }} className="recording-pulse" />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                AMBIENT PENDANT
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                {status.transportType === 'mock' ? 'Emulator' : status.transportType === 'web_ble' ? 'BLE' : 'WiFi'}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ESP32-S3 Super Mini • Onboard Charger
            </div>
          </div>
        </div>

        {/* Center Pill Nav Bar (Exact aesthetic from Reference Image) */}
        <nav 
          className="desktop-header-nav"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 6px',
            boxShadow: '0 2px 8px rgba(5, 41, 30, 0.04)',
          }}
        >
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onTabChange(link.id)}
                style={{
                  background: isActive ? 'var(--accent-forest)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '7px 18px',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Telemetry Pills + Connect CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Privacy Mute Alert */}
          {status.privacyMuteActive && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: 'var(--accent-rose)',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              <AlertCircle size={14} />
              <span>Mic Muted</span>
            </div>
          )}

          {/* MicroSD Storage Pill (Desktop) */}
          <div 
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 6,
              background: '#f8faf9',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
            className="header-storage-pill"
          >
            <HardDrive size={14} color="var(--accent-forest)" />
            <span>
              {status.storage.freeBytes ? `${Math.round(status.storage.freeBytes / (1024**3))}GB Free` : 'SD Ready'}
            </span>
          </div>

          {/* Battery Pill */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8faf9',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            {status.battery.isCharging ? (
              <BatteryCharging size={14} color="var(--accent-emerald)" />
            ) : (
              <Battery size={14} color="var(--accent-forest)" />
            )}
            <span>
              {status.battery.percentage !== null ? `${status.battery.percentage}%` : 'Uncalibrated'}
            </span>
          </div>

          {/* Primary Action Button (Matches Reference Image Pill CTA Button) */}
          <button
            onClick={handleConnectToggle}
            className={`btn ${isConnected ? 'btn-secondary' : 'btn-forest'}`}
            style={{
              padding: '8px 18px',
              fontSize: '0.82rem',
            }}
          >
            <Radio 
              size={14} 
              color={isConnected ? 'var(--accent-emerald)' : '#ffffff'} 
            />
            <span>
              {isConnected ? 'Connected' : 'Connect'}
            </span>
          </button>

          {/* PWA Install Button */}
          {installPrompt && !isInstalled && (
            <button
              onClick={handleInstallClick}
              className="btn btn-secondary"
              title="Install Ambient Pendant App"
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            >
              <Download size={14} />
            </button>
          )}

          {/* Hardware Simulator Toggle Button */}
          <button
            onClick={onToggleSimulator}
            title="Toggle Hardware Emulator Testbed"
            style={{
              background: simulatorOpen ? '#05291e' : '#ffffff',
              border: `1px solid ${simulatorOpen ? '#05291e' : 'var(--border-subtle)'}`,
              color: simulatorOpen ? '#ffffff' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-full)',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Sliders size={15} />
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .desktop-header-nav {
            display: flex !important;
          }
        }
        @media (min-width: 640px) {
          .header-storage-pill {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
