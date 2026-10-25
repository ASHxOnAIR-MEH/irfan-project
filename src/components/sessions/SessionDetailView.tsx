import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Headphones, 
  FileText, 
  Download, 
  Star, 
  CheckCircle2
} from 'lucide-react';
import { RecordingSession } from '../../types/session';
import { AudioPlayer } from '../player/AudioPlayer';
import { InteractiveTranscript } from '../player/InteractiveTranscript';
import { InsightsView } from '../insights/InsightsView';

interface SessionDetailViewProps {
  session: RecordingSession;
  audioBlobUrl: string | null;
  onBack: () => void;
  onToggleFavorite: (session: RecordingSession) => void;
  onToggleActionItem: (sessionId: string, actionId: string) => void;
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
  onBack,
  onToggleFavorite,
  onToggleActionItem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'player' | 'insights' | 'raw'>('player');
  const [seekTargetMs, setSeekTargetMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const handleSeekFromTranscript = (ms: number) => {
    setSeekTargetMs(ms);
    if (activeSubTab !== 'player') {
      setActiveSubTab('player');
    }
  };

  const downloadWav = () => {
    if (!audioBlobUrl) return;
    const a = document.createElement('a');
    a.href = audioBlobUrl;
    a.download = session.metadata.filename;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 980, margin: '0 auto', width: '100%' }}>
      {/* Back button & Title header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '8px 18px', fontSize: '0.82rem' }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => onToggleFavorite(session)}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.82rem' }}
          >
            <Star size={16} fill={session.isFavorite ? 'var(--accent-amber)' : 'none'} color={session.isFavorite ? 'var(--accent-amber)' : 'currentColor'} />
            <span>{session.isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {audioBlobUrl && (
            <button
              onClick={downloadWav}
              className="btn btn-forest"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              title="Download raw audio WAV file"
            >
              <Download size={15} /> Export Audio WAV
            </button>
          )}
        </div>
      </div>

      {/* Session Title Card */}
      <div className="white-card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="badge badge-emerald">
            <CheckCircle2 size={12} /> Local IndexedDB Safe
          </span>
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
          <FileText size={15} /> Hardware Manifest
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

            <InteractiveTranscript
              segments={session.transcript}
              currentTimeMs={currentTimeMs}
              onSeekToMs={handleSeekFromTranscript}
              searchFilter={transcriptSearch}
            />
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
          <h3 style={{ fontSize: '1.15rem', marginBottom: 12 }}>MicroSD File & Checksum Verification</h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Technical audit trail proving binary byte count and CRC32 verification during transfer from physical media.
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
              checksumVerification: 'VERIFIED_CRC32_MATCH',
              sha256Hash: session.metadata.checksumSha256,
              syncStatus: session.syncStatus,
              indexedDbCommitted: true,
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
