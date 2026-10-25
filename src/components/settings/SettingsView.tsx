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
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Database,
  ShieldAlert,
  Info
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS, StorageQuotaInfo, localDb } from '../../services/storage/indexedDb';
import { pendantManager } from '../../services/pendantManager';
import { TransportType } from '../../types/device';

interface SettingsViewProps {
  onClearData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onClearData }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTransport, setActiveTransport] = useState<TransportType>('mock');
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const refreshQuota = async () => {
    setIsRefreshingQuota(true);
    try {
      const q = await localDb.getStorageQuota();
      setStorageQuota(q);
    } finally {
      setIsRefreshingQuota(false);
    }
  };

  useEffect(() => {
    localDb.getSettings().then((s) => {
      setSettings(s);
      setActiveTransport(pendantManager.getActiveTransportType());
    });
    localDb.getStorageQuota().then((q) => {
      setStorageQuota(q);
    });
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

  const handleRequestPersistence = async () => {
    setPersistMessage('Requesting persistent storage from browser...');
    const result = await localDb.requestPersistentStorage();
    setPersistMessage(result.message);
    await refreshQuota();
    setTimeout(() => setPersistMessage(null), 6000);
  };

  const handleConfirmPurge = async () => {
    setShowPurgeConfirm(false);
    onClearData();
    await refreshQuota();
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
                  Cloud Whisper
                </button>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  API Key (Stored locally in IndexedDB)
                </div>
                <input
                  type="password"
                  placeholder="Enter your private API key..."
                  value={settings.byokApiKey || ''}
                  onChange={(e) => handleSave({ ...settings, byokApiKey: e.target.value })}
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
            </div>
          )}
        </div>
      </div>

      {/* 2. MicroSD Card Data Management */}
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
            <HardDrive size={24} color="var(--accent-forest)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>MicroSD Card & Hardware Retention</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Configure whether raw WAV recordings stay on physical microSD media after PWA synchronization.
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

      {/* 4. Local Storage Quota & Reliability Monitor (TASK 2) */}
      <div className="white-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Database size={22} color="var(--accent-forest)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem' }}>Local Storage Quota & Reliability</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Monitors browser IndexedDB capacity for raw audio blobs, transcripts, and embeddings.
              </p>
            </div>
          </div>

          <button
            onClick={refreshQuota}
            disabled={isRefreshingQuota}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            title="Refresh storage estimate from browser"
          >
            <RefreshCw size={14} style={{ animation: isRefreshingQuota ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh Stats</span>
          </button>
        </div>

        {/* High Quota Warning Alert */}
        {storageQuota?.warningLevel === 'critical' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fff1f2',
            border: '1.5px solid #fecdd3',
            color: '#9f1239',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: 18,
            fontSize: '0.82rem',
          }}>
            <ShieldAlert size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
            <span>
              <strong>Storage Critical ({storageQuota.percentUsed}% used):</strong> Your browser disk space is nearly exhausted.
              New audio recordings may be rejected. Export and delete older sessions.
            </span>
          </div>
        )}

        {storageQuota?.warningLevel === 'moderate' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            color: '#92400e',
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: 18,
            fontSize: '0.82rem',
          }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Storage Warning ({storageQuota.percentUsed}% used):</strong> Approaching browser quota limit.
            </span>
          </div>
        )}

        {/* Persistence Status Message */}
        {persistMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#ecfdf5',
            border: '1.5px solid #a7f3d0',
            color: '#065f46',
            padding: '10px 16px',
            borderRadius: '12px',
            marginBottom: 16,
            fontSize: '0.82rem',
          }}>
            <Info size={16} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
            <span>{persistMessage}</span>
          </div>
        )}

        {/* Quota Details Card */}
        {storageQuota && storageQuota.isSupported ? (
          <div style={{
            background: '#f8faf9',
            borderRadius: '16px',
            padding: 20,
            border: '1.5px solid var(--border-card)',
            marginBottom: 20,
          }}>
            {/* Usage Progress Bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: 'var(--accent-forest)' }}>
                  Storage Allocation:
                </span>
                <span style={{ fontWeight: 700, color: storageQuota.warningLevel === 'critical' ? 'var(--accent-rose)' : 'var(--accent-forest)' }}>
                  {storageQuota.percentUsed}% Used
                </span>
              </div>

              <div style={{
                height: 10,
                borderRadius: 'var(--radius-full)',
                background: '#e2f5ec',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(1, Math.min(100, storageQuota.percentUsed))}%`,
                  background: storageQuota.warningLevel === 'critical'
                    ? 'var(--accent-rose)'
                    : storageQuota.warningLevel === 'moderate'
                    ? 'var(--accent-amber)'
                    : 'var(--accent-emerald)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}>
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Used Space</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
                  {(storageQuota.usageBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Available Space</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
                  {(storageQuota.availableBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Estimated Quota</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-forest)' }}>
                  {(storageQuota.quotaBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                </div>
              </div>
            </div>

            {/* Persistent Storage Control */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 14,
            }}>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Browser Persistent Storage Status:
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {storageQuota.isPersisted === true
                    ? 'Protected: Browser will not evict offline memories under storage pressure.'
                    : storageQuota.isPersisted === false
                    ? 'Best-effort: Browser may evict local cache if device disk space is low.'
                    : 'Persistence check unsupported by browser.'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`badge ${storageQuota.isPersisted ? 'badge-emerald' : 'badge-secondary'}`}>
                  {storageQuota.isPersisted ? 'Granted / Protected' : 'Best-Effort'}
                </span>

                {!storageQuota.isPersisted && (
                  <button
                    onClick={handleRequestPersistence}
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                  >
                    Request Protection
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#f8faf9',
            borderRadius: '16px',
            padding: 16,
            border: '1.5px solid var(--border-card)',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            marginBottom: 20,
          }}>
            Browser Storage Estimation API (`navigator.storage.estimate`) is not supported or is restricted in your current browser context.
          </div>
        )}

        {/* Purge Client Storage Section */}
        <div style={{
          borderTop: '1.5px solid var(--border-card)',
          paddingTop: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          <div>
            <h4 style={{ fontSize: '0.98rem', color: '#b91c1c', fontWeight: 800 }}>Purge Local Client Storage</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Atomically clears browser IndexedDB sessions and restores default demo sessions. Physical MicroSD remains untouched.
            </p>
          </div>

          <button
            onClick={() => setShowPurgeConfirm(true)}
            className="btn btn-danger"
            style={{ padding: '8px 18px', fontSize: '0.82rem' }}
          >
            <Trash2 size={15} /> Clear IndexedDB
          </button>
        </div>

        {/* Purge Confirmation Card */}
        {showPurgeConfirm && (
          <div style={{
            marginTop: 16,
            background: '#fff1f2',
            border: '1.5px solid #fca5a5',
            borderRadius: '16px',
            padding: 18,
          }}>
            <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
              Confirm IndexedDB Purge
            </h4>
            <p style={{ fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: 14 }}>
              Are you sure? This will remove all local audio blobs and sessions from this browser.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleConfirmPurge}
                className="btn btn-danger"
                style={{ padding: '7px 16px', fontSize: '0.8rem' }}
              >
                Yes, Purge Database
              </button>
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="btn btn-secondary"
                style={{ padding: '7px 16px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
