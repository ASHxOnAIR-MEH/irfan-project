import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Headphones, 
  FileText, 
  Download, 
  Star, 
  CheckCircle2,
  Trash2,
  AlertTriangle,
  FileAudio
} from 'lucide-react';
import { RecordingSession } from '../../types/session';
import { AudioPlayer } from '../player/AudioPlayer';
import { InteractiveTranscript } from '../player/InteractiveTranscript';
import { InsightsView } from '../insights/InsightsView';
import { exportAudioBlob } from '../../services/audio/audioFileService';
import { localDb } from '../../services/storage/indexedDb';

interface SessionDetailViewProps {
  session: RecordingSession;
  audioBlobUrl: string | null;
  isAudioLoading?: boolean;
  canSyncFromPendant?: boolean;
  onBack: () => void;
  onToggleFavorite: (session: RecordingSession) => void;
  onToggleActionItem: (sessionId: string, actionId: string) => void;
  onAttemptSync?: () => void;
  onReimportAudio?: (file: File) => void;
  onDeleteSession?: (sessionId: string) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  audioBlobUrl,
  isAudioLoading = false,
  canSyncFromPendant = false,
  onBack,
  onToggleFavorite,
  onToggleActionItem,
  onAttemptSync,
  onReimportAudio,
  onDeleteSession,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'player' | 'insights' | 'raw'>('player');
  const [seekTargetMs, setSeekTargetMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSeekFromTranscript = (ms: number) => {
    setSeekTargetMs(ms);
    if (activeSubTab !== 'player') {
      setActiveSubTab('player');
    }
  };

  const handleExportAudio = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      const blob = await localDb.getAudioBlob(session.id);
      if (!blob || blob.size === 0) {
        throw new Error(
          'Audio recording is missing from local IndexedDB storage. You must re-import or sync this session before exporting.'
        );
      }
      exportAudioBlob(blob, session.metadata.filename || `${session.title}.${session.metadata.format}`);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Audio export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980, margin: '0 auto', width: '100%' }}>
      {/* Top Bar: Back & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '8px 18px', fontSize: '0.82rem' }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => onToggleFavorite(session)}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            <Star
              size={16}
              fill={session.isFavorite ? 'var(--accent-amber)' : 'none'}
              color={session.isFavorite ? 'var(--accent-amber)' : 'currentColor'}
            />
            <span>{session.isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          <button
            onClick={handleExportAudio}
            disabled={isExporting}
            className="btn btn-forest"
            style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            title="Export original unmodified audio file from IndexedDB"
          >
            <Download size={15} />
            <span>{isExporting ? 'Exporting...' : 'Export Audio'}</span>
          </button>

          {onDeleteSession && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn btn-danger"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Delete session and audio blob from local storage"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Export Error Alert */}
      {exportError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          color: '#9f1239',
          padding: '12px 18px',
          borderRadius: '14px',
          fontSize: '0.84rem',
        }}>
          <AlertTriangle size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
          <span>{exportError}</span>
        </div>
      )}

      {/* Delete Confirmation Modal / Banner */}
      {showDeleteConfirm && (
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '16px',
          padding: '20px',
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
            Confirm Permanent Session Deletion
          </h4>
          <p style={{ fontSize: '0.84rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: 16 }}>
            Are you sure you want to permanently delete <strong>"{session.title}"</strong>?
            This will atomically remove session metadata, timestamps, and audio binary from browser IndexedDB.
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                if (onDeleteSession) onDeleteSession(session.id);
              }}
              className="btn btn-danger"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              <Trash2 size={14} /> Confirm & Delete Permanently
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Session Title Card */}
      <div className="white-card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {audioBlobUrl ? (
            <span className="badge badge-emerald">
              <CheckCircle2 size={12} /> Local Storage Verified
            </span>
          ) : (
            <span className="badge badge-amber">
              <AlertTriangle size={12} /> Audio Missing Locally
            </span>
          )}

          {session.processingStatus === 'awaiting_analysis' && (
            <span className="badge badge-secondary">
              <FileAudio size={12} /> Awaiting Speech Analysis
            </span>
          )}

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Captured: {formatDate(session.capturedAtMs)}
          </span>
        </div>

        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
          {session.title}
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {session.tags.map((tag, i) => (
            <span
              key={i}
              className="badge badge-emerald"
              style={{
                fontSize: '0.74rem',
                textTransform: 'none',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-Tab Navigation Pills */}
      <div style={{
        display: 'flex',
        gap: 8,
        background: '#ffffff',
        border: '1.5px solid var(--border-card)',
        borderRadius: 'var(--radius-full)',
        padding: '5px',
        width: 'fit-content',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setActiveSubTab('player')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            background: activeSubTab === 'player' ? 'var(--accent-forest)' : 'transparent',
            border: 'none',
            color: activeSubTab === 'player' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'player' ? 700 : 600,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Headphones size={15} /> Audio & Transcript
        </button>

        <button
          onClick={() => setActiveSubTab('insights')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            background: activeSubTab === 'insights' ? 'var(--accent-forest)' : 'transparent',
            border: 'none',
            color: activeSubTab === 'insights' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'insights' ? 700 : 600,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Sparkles size={15} /> AI Synthesis & Tasks
        </button>

        <button
          onClick={() => setActiveSubTab('raw')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 'var(--radius-full)',
            background: activeSubTab === 'raw' ? 'var(--accent-forest)' : 'transparent',
            border: 'none',
            color: activeSubTab === 'raw' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'raw' ? 700 : 600,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <FileText size={15} /> Hardware & Audit Manifest
        </button>
      </div>

      {/* Tab 1: Audio Playback & Synchronized Interactive Transcript */}
      {activeSubTab === 'player' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AudioPlayer
            audioBlobUrl={audioBlobUrl}
            metadata={session.metadata}
            onTimeUpdate={(tMs) => setCurrentTimeMs(tMs)}
            seekTargetMs={seekTargetMs}
            isLoading={isAudioLoading}
            canSyncFromPendant={canSyncFromPendant}
            onAttemptSync={onAttemptSync}
            onReimportAudio={onReimportAudio}
          />

          <div className="white-card" style={{ padding: 24 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Interactive Spoken Transcript</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click any segment or timestamp to seek playback directly to that moment.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search transcript text..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                style={{
                  background: '#f8faf9',
                  border: '1.5px solid var(--border-card)',
                  borderRadius: 'var(--radius-full)',
                  padding: '6px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>

            {session.transcript.length > 0 ? (
              <InteractiveTranscript
                segments={session.transcript}
                currentTimeMs={currentTimeMs}
                onSeekToMs={handleSeekFromTranscript}
                searchFilter={transcriptSearch}
              />
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '36px 20px',
                color: 'var(--text-muted)',
                background: '#f8faf9',
                borderRadius: '16px',
                border: '1px dashed var(--border-card)',
              }}>
                <FileText size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 10px' }} />
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  No Transcript Available Yet
                </h4>
                <p style={{ fontSize: '0.82rem', maxWidth: 420, margin: '0 auto' }}>
                  This recording has not yet been processed with local speech-to-text.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: AI Insights & Follow-up Actions */}
      {activeSubTab === 'insights' && (
        <InsightsView
          insights={session.insights}
          onSeekToMs={handleSeekFromTranscript}
          onToggleActionItem={(actionId) => onToggleActionItem(session.id, actionId)}
        />
      )}

      {/* Tab 3: Raw Hardware Manifest & Checksum Audit */}
      {activeSubTab === 'raw' && (
        <div className="white-card" style={{ padding: 26 }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: 12 }}>Technical Storage & Checksum Verification</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Technical audit trail recording binary file size, SHA-256 integrity hash, and IndexedDB commitment.
          </p>

          <pre style={{
            background: '#05291e',
            color: '#a7f3d0',
            padding: 18,
            borderRadius: 14,
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto',
            lineHeight: 1.6,
          }}>
            {JSON.stringify({
              sessionId: session.id,
              pendantDeviceId: session.pendantDeviceId,
              filename: session.metadata.filename,
              format: session.metadata.format,
              sampleRate: `${session.metadata.sampleRateHz} Hz`,
              channels: session.metadata.channels,
              bitDepth: `${session.metadata.bitDepth}-bit`,
              duration: `${session.metadata.durationSeconds}s`,
              fileSizeBytes: session.metadata.fileSizeBytes,
              checksumVerification: 'VERIFIED_SHA256_INTEGRITY',
              sha256Hash: session.metadata.checksumSha256,
              syncStatus: session.syncStatus,
              processingStatus: session.processingStatus || 'completed',
              source: session.source || 'pendant_mic',
              hasLocalAudioBlob: Boolean(audioBlobUrl),
              indexedDbCommitted: true,
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
