import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Radio, 
  Smartphone, 
  HardDrive, 
  Trash2, 
  Check, 
  Cpu, 
  KeyRound
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, localDb } from '../../services/storage/indexedDb';
import { pendantManager } from '../../services/pendantManager';
import { TransportType } from '../../types/device';

interface SettingsViewProps {
  onClearData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClearData }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTransport, setActiveTransport] = useState<TransportType>('mock');
  const [storageQuota, setStorageQuota] = useState<{ usageBytes: number; quotaBytes: number; percentUsed: number } | null>(null);

  useEffect(() => {
    localDb.getSettings().then((s) => {
      setSettings(s);
      setActiveTransport(pendantManager.getActiveTransportType());
    });
    localDb.getStorageQuota().then((q) => setStorageQuota(q));
  }, []);

  const handleSave = async (updated: AppSettings) => {
    setSettings(updated);
    await localDb.saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTransportSwitch = async (type: TransportType) => {
    try {
      await pendantManager.setTransport(type, settings.wifiEndpointUrl);
      setActiveTransport(type);
      handleSave({ ...settings, preferredTransport: type });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Transport switch error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 880, margin: '0 auto', width: '100%' }}>
      {/* 1. Privacy & AI Transparency Vault */}
      <div className="white-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ShieldCheck size={24} color="var(--accent-forest)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Privacy Controls & Processing Location</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Raw audio recordings are strictly confidential. We enforce local-first storage by default.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Privacy Mode Selector */}
          <div style={{
            background: '#f8faf9',
            borderRadius: '16px',
            padding: 18,
            border: '1.5px solid var(--border-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                  Local-First Privacy Mode
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {settings.privacyMode === 'local_only'
                    ? 'Active: Zero external network transmissions. All audio remains in browser IndexedDB.'
                    : 'Opt-In Cloud: Audio is transcribed using your configured BYOK cloud model.'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleSave({ ...settings, privacyMode: 'local_only' })}
                  className={`btn ${settings.privacyMode === 'local_only' ? 'btn-forest' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  <Lock size={14} /> Local Only
                </button>
                <button
                  onClick={() => handleSave({ ...settings, privacyMode: 'opt_in_cloud' })}
                  className={`btn ${settings.privacyMode === 'opt_in_cloud' ? 'btn-forest' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                >
                  Opt-In Cloud
                </button>
              </div>
            </div>
          </div>

          {/* AI Provider & BYOK Settings */}
          {settings.privacyMode === 'opt_in_cloud' && (
            <div style={{
              background: '#ecfdf5',
              borderRadius: '16px',
              padding: 18,
              border: '1.5px solid #a7f3d0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <KeyRound size={18} color="var(--accent-forest)" />
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Bring Your Own Key (BYOK) Configuration
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button
                  onClick={() => handleSave({ ...settings, aiProvider: 'cloud_gemini' })}
                  className={`btn ${settings.aiProvider === 'cloud_gemini' ? 'btn-forest' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => handleSave({ ...settings, aiProvider: 'cloud_whisper' })}
                  className={`btn ${settings.aiProvider === 'cloud_whisper' ? 'btn-forest' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem' }}
                >
                  OpenAI Whisper
                </button>
              </div>

              <input
                type="password"
                placeholder="Enter your API Key (stored strictly in local IndexedDB)"
                value={settings.byokApiKey || ''}
                onChange={(e) => handleSave({ ...settings, byokApiKey: e.target.value })}
                style={{
                  width: '100%',
                  background: '#ffffff',
                  border: '1.5px solid var(--border-card)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. MicroSD Storage Retention Policy */}
      <div className="white-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HardDrive size={22} color="var(--accent-forest)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>MicroSD Card Retention</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Controls whether verified sessions are retained or pruned on the physical SD card.
            </p>
          </div>
        </div>

        <div style={{
          background: '#f8faf9',
          borderRadius: '16px',
          padding: 18,
          border: '1.5px solid var(--border-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.94rem' }}>MicroSD Source of Truth Preservation</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {settings.autoDeleteFromSdAfterSync
                ? 'Auto-Prune: Files on MicroSD are safely deleted only after CRC32 verification.'
                : 'Safe Retention (Recommended): Recordings remain safely on MicroSD after transfer.'}
            </div>
          </div>

          <button
            onClick={() => handleSave({ ...settings, autoDeleteFromSdAfterSync: !settings.autoDeleteFromSdAfterSync })}
            className={`btn ${settings.autoDeleteFromSdAfterSync ? 'btn-secondary' : 'btn-forest'}`}
            style={{ padding: '8px 18px', fontSize: '0.82rem' }}
          >
            {settings.autoDeleteFromSdAfterSync ? 'Enable Safe Retention' : 'Safe Retention Enabled'}
          </button>
        </div>
      </div>

      {/* 3. Transport & Local Network Configuration */}
      <div className="white-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Radio size={22} color="var(--accent-forest)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Active Hardware Transport</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Switch transport interface between Mock Emulator, Web Bluetooth, and Local Wi-Fi.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => handleTransportSwitch('mock')}
            className={`btn ${activeTransport === 'mock' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ padding: '10px 14px', fontSize: '0.84rem' }}
          >
            <Cpu size={15} /> Mock Hardware Emulator
          </button>
          <button
            onClick={() => handleTransportSwitch('web_ble')}
            className={`btn ${activeTransport === 'web_ble' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ padding: '10px 14px', fontSize: '0.84rem' }}
          >
            <Smartphone size={15} /> Web Bluetooth (BLE)
          </button>
          <button
            onClick={() => handleTransportSwitch('wifi_http')}
            className={`btn ${activeTransport === 'wifi_http' ? 'btn-forest' : 'btn-secondary'}`}
            style={{ padding: '10px 14px', fontSize: '0.84rem' }}
          >
            <Radio size={15} /> Local Wi-Fi SoftAP
          </button>
        </div>

        {/* Wi-Fi Endpoint Configuration */}
        {activeTransport === 'wifi_http' && (
          <div style={{
            background: '#ecfdf5',
            borderRadius: '16px',
            padding: 16,
            border: '1.5px solid #a7f3d0',
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>
              ESP32-S3 Wi-Fi SoftAP REST Endpoint
            </div>
            <input
              type="text"
              value={settings.wifiEndpointUrl}
              onChange={(e) => handleSave({ ...settings, wifiEndpointUrl: e.target.value })}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1.5px solid var(--border-card)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* 4. Local Storage Maintenance & Quota */}
      <div className="white-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HardDrive size={22} color="var(--accent-forest)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Local Storage Quota & Maintenance</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Browser IndexedDB persistence for offline audio, transcripts, and insights.
            </p>
          </div>
        </div>

        {/* Quota Progress Bar */}
        {storageQuota && storageQuota.quotaBytes > 0 && (
          <div style={{
            background: '#f8faf9',
            borderRadius: '16px',
            padding: 18,
            border: '1.5px solid var(--border-card)',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-forest)' }}>
                Persistent Browser Quota:
              </span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {(storageQuota.usageBytes / (1024 * 1024)).toFixed(1)} MB used of {(storageQuota.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB ({storageQuota.percentUsed}%)
              </span>
            </div>
            <div style={{
              height: 8,
              borderRadius: 'var(--radius-full)',
              background: '#e2f5ec',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max(1, Math.min(100, storageQuota.percentUsed))}%`,
                background: 'var(--accent-emerald)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h4 style={{ fontSize: '1rem', color: '#b91c1c', fontWeight: 800 }}>Purge Local Client Storage</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Clears browser IndexedDB sessions and restores default demo sessions. MicroSD on physical pendant remains untouched.
            </p>
          </div>

          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all local sessions from IndexedDB?')) {
                onClearData();
                localDb.getStorageQuota().then((q) => setStorageQuota(q));
              }
            }}
            className="btn btn-danger"
            style={{ padding: '8px 18px', fontSize: '0.82rem' }}
          >
            <Trash2 size={15} /> Clear IndexedDB
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--accent-forest)',
          color: '#ffffff',
          borderRadius: 'var(--radius-full)',
          padding: '10px 22px',
          boxShadow: '0 8px 28px rgba(5, 41, 30, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.86rem',
          fontWeight: 700,
          zIndex: 1000,
        }}>
          <Check size={16} color="#34d399" />
          <span>Preferences saved</span>
        </div>
      )}
    </div>
  );
};
