import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PendantDeviceStatus } from './types/device';
import { SyncManifestItem, TransferState } from './types/protocol';
import { RecordingSession } from './types/session';
import { pendantManager } from './services/pendantManager';
import { localDb } from './services/storage/indexedDb';
import { ensureDemoDataSeeded } from './services/storage/seedData';
import { probeAudioFile, sanitizeFilename } from './services/audio/audioFileService';

import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { SessionListView } from './components/sessions/SessionListView';
import { SessionDetailView } from './components/sessions/SessionDetailView';
import { GlobalActionItemsView } from './components/actions/GlobalActionItemsView';
import { SettingsView } from './components/settings/SettingsView';
import { DeviceConnectionView } from './components/device/DeviceConnectionView';
import { TransferModal } from './components/sync/TransferModal';
import { MockHardwareControls } from './components/simulator/MockHardwareControls';
import { GlobalInsightsView } from './components/insights/GlobalInsightsView';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [deviceStatus, setDeviceStatus] = useState<PendantDeviceStatus>(pendantManager.getStatus());
  const [activeTransfer, setActiveTransfer] = useState<TransferState | null>(null);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<RecordingSession | null>(null);
  const [selectedAudioUrl, setSelectedAudioUrl] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [pendingManifest, setPendingManifest] = useState<SyncManifestItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Request tracker ref to prevent race conditions during rapid switching
  const selectionRequestIdRef = useRef<number>(0);

  // Revoke blob URL on unmount or URL replacement
  useEffect(() => {
    return () => {
      if (selectedAudioUrl) {
        URL.revokeObjectURL(selectedAudioUrl);
      }
    };
  }, [selectedAudioUrl]);

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

  // Load audio blob URL when a session is selected with race-condition prevention
  const handleSelectSession = async (session: RecordingSession, _seekMs?: number) => {
    const requestId = ++selectionRequestIdRef.current;
    setSelectedSession(session);
    setActiveTab('session_detail');

    // Revoke previous blob URL immediately
    if (selectedAudioUrl) {
      URL.revokeObjectURL(selectedAudioUrl);
      setSelectedAudioUrl(null);
    }

    setIsAudioLoading(true);

    try {
      const blob = await localDb.getAudioBlob(session.id);

      // Verify this request is still the most recent one
      if (requestId !== selectionRequestIdRef.current) {
        return;
      }

      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setSelectedAudioUrl(url);
      } else {
        setSelectedAudioUrl(null);
      }
    } catch (err) {
      if (requestId === selectionRequestIdRef.current) {
        console.warn(`Could not load audio blob for session ${session.id}:`, err);
        setSelectedAudioUrl(null);
      }
    } finally {
      if (requestId === selectionRequestIdRef.current) {
        setIsAudioLoading(false);
      }
    }
  };

  const handleBackToSessions = () => {
    selectionRequestIdRef.current += 1;
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
      alert(`Sync Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

  // Delete session atomically
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await localDb.deleteSession(sessionId);
      if (selectedSession && selectedSession.id === sessionId) {
        selectionRequestIdRef.current += 1;
        setSelectedSession(null);
        if (selectedAudioUrl) {
          URL.revokeObjectURL(selectedAudioUrl);
          setSelectedAudioUrl(null);
        }
        setActiveTab('sessions');
      }
      await refreshSessions();
    } catch (err: unknown) {
      alert(`Failed to delete session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Re-attach an imported audio file to a session whose audio is missing
  const handleReimportAudioForSession = async (file: File) => {
    if (!selectedSession) return;
    try {
      const probe = await probeAudioFile(file);
      const updated: RecordingSession = {
        ...selectedSession,
        metadata: {
          ...selectedSession.metadata,
          format: probe.format,
          sampleRateHz: probe.sampleRateHz,
          channels: probe.channels,
          durationSeconds: Math.round(probe.durationSeconds * 10) / 10,
          fileSizeBytes: probe.fileSizeBytes,
          checksumSha256: probe.checksumSha256,
          filename: sanitizeFilename(file.name, selectedSession.metadata.filename, probe.format),
        },
        hasAudioMissing: false,
      };

      await localDb.saveSessionWithAudio(updated, file);
      await refreshSessions();
      handleSelectSession(updated);
    } catch (err: unknown) {
      alert(`Re-import audio failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Callback after importing an audio file from SessionListView
  const handleSessionImported = async (newSession: RecordingSession) => {
    await refreshSessions();
    handleSelectSession(newSession);
  };

  // Clear all data
  const handleClearAll = async () => {
    await localDb.clearAll();
    await ensureDemoDataSeeded();
    await refreshSessions();
    setSelectedSession(null);
    if (selectedAudioUrl) {
      URL.revokeObjectURL(selectedAudioUrl);
      setSelectedAudioUrl(null);
    }
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
          if (selectedAudioUrl) {
            URL.revokeObjectURL(selectedAudioUrl);
            setSelectedAudioUrl(null);
          }
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
          if (selectedAudioUrl) {
            URL.revokeObjectURL(selectedAudioUrl);
            setSelectedAudioUrl(null);
          }
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

            {/* Tab: Dedicated Device Connection & Telemetry */}
            {activeTab === 'device' && (
              <DeviceConnectionView
                status={deviceStatus}
                onOpenSimulator={() => setSimulatorOpen(true)}
                onNavigateToSessions={() => setActiveTab('sessions')}
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
                onSessionImported={handleSessionImported}
              />
            )}

            {/* Tab: Session Detail (Player & Insights) */}
            {activeTab === 'session_detail' && selectedSession && (
              <SessionDetailView
                session={selectedSession}
                audioBlobUrl={selectedAudioUrl}
                isAudioLoading={isAudioLoading}
                canSyncFromPendant={
                  deviceStatus.connectionState === 'connected' &&
                  pendingManifest.some((m) => m.sessionId === selectedSession.id)
                }
                onBack={handleBackToSessions}
                onToggleFavorite={handleToggleFavorite}
                onToggleActionItem={handleToggleActionItem}
                onAttemptSync={() => {
                  const pending = pendingManifest.find((m) => m.sessionId === selectedSession.id);
                  if (pending) {
                    handleSyncSession(pending);
                  }
                }}
                onReimportAudio={handleReimportAudioForSession}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {/* Tab: Global Insights & Topic Browser */}
            {activeTab === 'insights' && (
              <GlobalInsightsView
                sessions={sessions}
                onSelectSession={handleSelectSession}
              />
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
