import React, { useEffect, useState, useCallback } from 'react';
import { PendantDeviceStatus } from './types/device';
import { SyncManifestItem, TransferState } from './types/protocol';
import { RecordingSession } from './types/session';
import { pendantManager } from './services/pendantManager';
import { localDb } from './services/storage/indexedDb';
import { ensureDemoDataSeeded } from './services/storage/seedData';

import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { SessionListView } from './components/sessions/SessionListView';
import { SessionDetailView } from './components/sessions/SessionDetailView';
import { GlobalActionItemsView } from './components/actions/GlobalActionItemsView';
import { SettingsView } from './components/settings/SettingsView';
import { TransferModal } from './components/sync/TransferModal';
import { MockHardwareControls } from './components/simulator/MockHardwareControls';
import { Sparkles, Brain, HelpCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [deviceStatus, setDeviceStatus] = useState<PendantDeviceStatus>(pendantManager.getStatus());
  const [activeTransfer, setActiveTransfer] = useState<TransferState | null>(null);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<RecordingSession | null>(null);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [pendingManifest, setPendingManifest] = useState<SyncManifestItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load local sessions from IndexedDB
  const refreshSessions = useCallback(async () => {
    const list = await localDb.getAllSessions();
    setSessions(list);

    // Also check pending items on pendant
    if (pendantManager.getStatus().connectionState === 'connected') {
      try {
        const manifest = await pendantManager.getPendantManifest();
        const existingIds = new Set(list.map((s) => s.id));
        const unsynced = manifest.filter((m) => !existingIds.has(m.sessionId) && !m.isSyncedToApp);
        setPendingManifest(unsynced);
      } catch {
        // Soft fail
      }
    } else {
      setPendingManifest([]);
    }
  }, []);

  // Initialize DB and subscriptions
  useEffect(() => {
    let unmounted = false;

    async function init() {
      await ensureDemoDataSeeded();
      if (!unmounted) {
        await refreshSessions();
        setIsLoading(false);
      }
    }

    init();

    const unsubStatus = pendantManager.subscribeStatus((st) => {
      setDeviceStatus(st);
      refreshSessions();
    });

    const unsubTransfer = pendantManager.subscribeTransfer((tr) => {
      setActiveTransfer(tr);
    });

    const unsubSessions = pendantManager.subscribeSessionUpdates(() => {
      refreshSessions();
    });

    return () => {
      unmounted = true;
      unsubStatus();
      unsubTransfer();
      unsubSessions();
    };
  }, [refreshSessions]);

  // Load audio blob URL when a session is selected
  const handleSelectSession = async (session: RecordingSession, _seekMs?: number) => {
    setSelectedSession(session);
    setActiveTab('session_detail');

    // Revoke previous blob URL if needed
    if (selectedAudioUrl) {
      URL.revokeObjectURL(selectedAudioUrl);
    }

    const blob = await localDb.getAudioBlob(session.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setSelectedAudioUrl(url);
    } else {
      setSelectedAudioUrl(null);
    }
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
    if (selectedAudioUrl) {
      URL.revokeObjectURL(selectedAudioUrl);
      setSelectedAudioUrl(null);
    }
    setActiveTab('sessions');
  };

  // Sync a single session from MicroSD
  const handleSyncSession = async (item: SyncManifestItem) => {
    try {
      const settings = await localDb.getSettings();
      const syncedSession = await pendantManager.syncRecording(item, settings.autoDeleteFromSdAfterSync);
      await refreshSessions();
      handleSelectSession(syncedSession);
    } catch (err: unknown) {
      alert(`Sync Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (session: RecordingSession) => {
    const updated = { ...session, isFavorite: !session.isFavorite };
    await localDb.saveSession(updated);
    if (selectedSession && selectedSession.id === session.id) {
      setSelectedSession(updated);
    }
    await refreshSessions();
  };

  // Toggle action item completion
  const handleToggleActionItem = async (sessionId: string, actionId: string) => {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;

    const updatedActions = targetSession.insights.actionItems.map((act) => {
      if (act.id === actionId) {
        return { ...act, completed: !act.completed };
      }
      return act;
    });

    const updatedSession: RecordingSession = {
      ...targetSession,
      insights: {
        ...targetSession.insights,
        actionItems: updatedActions,
      },
    };

    await localDb.saveSession(updatedSession);
    if (selectedSession && selectedSession.id === sessionId) {
      setSelectedSession(updatedSession);
    }
    await refreshSessions();
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session from local storage?')) return;
    await localDb.deleteSession(sessionId);
    if (selectedSession && selectedSession.id === sessionId) {
      setSelectedSession(null);
    }
    await refreshSessions();
  };

  // Clear all data
  const handleClearAll = async () => {
    await localDb.clearAll();
    await ensureDemoDataSeeded();
    await refreshSessions();
    setSelectedSession(null);
    setActiveTab('dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Header */}
      <Header
        status={deviceStatus}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedSession(null);
          setActiveTab(tab);
        }}
        onToggleSimulator={() => setSimulatorOpen(!simulatorOpen)}
        simulatorOpen={simulatorOpen}
      />

      {/* Navigation Sub-bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedSession(null);
          setActiveTab(tab);
        }}
        pendingSyncCount={pendingManifest.length}
      />

      {/* Main Content Area */}
      <main className="app-container" style={{ flex: 1 }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Sparkles size={28} color="var(--accent-cyan)" style={{ animation: 'spin 2s linear infinite' }} />
            <div style={{ marginTop: 12, fontSize: '0.9rem' }}>Initializing Local Storage...</div>
          </div>
        ) : (
          <>
            {/* Tab: Dashboard */}
            {activeTab === 'dashboard' && (
              <DashboardView
                status={deviceStatus}
                recentSessions={sessions}
                pendingManifest={pendingManifest}
                onSelectSession={handleSelectSession}
                onSyncSession={handleSyncSession}
                onViewAllSessions={() => setActiveTab('sessions')}
              />
            )}

            {/* Tab: Sessions List */}
            {activeTab === 'sessions' && (
              <SessionListView
                sessions={sessions}
                pendingManifest={pendingManifest}
                onSelectSession={handleSelectSession}
                onSyncSession={handleSyncSession}
                onDeleteSession={handleDeleteSession}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {/* Tab: Session Detail (Player & Insights) */}
            {activeTab === 'session_detail' && selectedSession && (
              <SessionDetailView
                session={selectedSession}
                audioBlobUrl={selectedAudioUrl}
                onBack={handleBackToSessions}
                onToggleFavorite={handleToggleFavorite}
                onToggleActionItem={handleToggleActionItem}
              />
            )}

            {/* Tab: Global Insights & Topic Browser */}
            {activeTab === 'insights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="glass-card" style={{ padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Brain size={22} color="var(--accent-purple)" />
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Memory Synthesis & Topics</h2>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    High-level conceptual maps across all recorded ambient memory sessions.
                  </p>
                </div>

                {sessions.map((s) => (
                  <div 
                    key={s.id} 
                    className="glass-card" 
                    style={{ padding: 20, cursor: 'pointer' }}
                    onClick={() => handleSelectSession(s)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{s.title}</h3>
                      <span className="badge badge-purple" style={{ textTransform: 'none' }}>
                        {s.insights.sentiment || 'reflective'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                      {s.insights.executiveSummary}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {s.insights.importantTopics.map((topic, i) => (
                        <span key={i} className="badge" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#c4b5fd' }}>
                          #{topic}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Global Action Items */}
            {activeTab === 'actions' && (
              <GlobalActionItemsView
                sessions={sessions}
                onToggleActionItem={handleToggleActionItem}
                onOpenSession={handleSelectSession}
              />
            )}

            {/* Tab: Settings & Privacy */}
            {activeTab === 'settings' && (
              <SettingsView onClearData={handleClearAll} />
            )}
          </>
        )}
      </main>

      {/* Chunked Transfer Modal */}
      <TransferModal
        transfer={activeTransfer}
        sessionTitle={activeTransfer ? activeTransfer.sessionId : undefined}
        onClose={() => setActiveTransfer(null)}
      />

      {/* Floating Mock Hardware Testbed Simulator */}
      <MockHardwareControls
        status={deviceStatus}
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
      />
    </div>
  );
};

export default App;
