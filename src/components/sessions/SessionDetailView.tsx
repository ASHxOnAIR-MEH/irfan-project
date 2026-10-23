import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  Headphones, 
  FileText, 
  Download, 
  Star, 
  Share2, 
  ShieldCheck,
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
    // Switch to player tab if on another tab
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back button & Title header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={16} /> Back to Sessions
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onToggleFavorite(session)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <Star size={16} fill={session.isFavorite ? 'var(--accent-amber)' : 'none'} color={session.isFavorite ? 'var(--accent-amber)' : 'currentColor'} />
            <span>{session.isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {audioBlobUrl && (
            <button
              onClick={downloadWav}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              title="Download raw audio WAV file"
            >
              <Download size={15} /> Export Audio
            </button>
          )}
        </div>
      </div>

      {/* Session Title Card */}
      <div className="glass-card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-emerald">
            <CheckCircle2 size={12} /> Local IndexedDB Safe
          </span>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Captured: {formatDate(session.capturedAtMs)}
          </span>
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
          {session.title}
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {session.tags.map((tag, i) => (
            <span
              key={i}
              className="badge"
              style={{
                background: 'rgba(0, 242, 254, 0.08)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                color: 'var(--accent-cyan)',
                fontSize: '0.72rem',
                textTransform: 'none',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: 6,
      }}>
        <button
          onClick={() => setActiveSubTab('player')}
          className={`btn ${activeSubTab === 'player' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 18px', fontSize: '0.84rem' }}
        >
          <Headphones size={15} /> Audio & Transcript
        </button>

        <button
          onClick={() => setActiveSubTab('insights')}
          className={`btn ${activeSubTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 18px', fontSize: '0.84rem' }}
        >
          <Sparkles size={15} /> AI Insights & Tasks
        </button>

        <button
          onClick={() => setActiveSubTab('raw')}
          className={`btn ${activeSubTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 18px', fontSize: '0.84rem' }}
        >
          <FileText size={15} /> Hardware & Specs
        </button>
      </div>

      {/* Tab 1: Audio Player & Synchronized Transcript */}
      {activeSubTab === 'player' && (
        <div>
          <AudioPlayer
            audioBlobUrl={audioBlobUrl}
            metadata={session.metadata}
            seekTargetMs={seekTargetMs}
            onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
          />

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Interactive Timestamped Transcript</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Click any spoken phrase to jump playback to that timestamp.
                </p>
              </div>

              <input
                type="text"
                placeholder="Filter transcript..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 12px',
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

      {/* Tab 2: AI Insights & Action Items */}
      {activeSubTab === 'insights' && (
        <InsightsView
          insights={session.insights}
          onSeekToMs={handleSeekFromTranscript}
          onToggleActionItem={(actionId) => onToggleActionItem(session.id, actionId)}
        />
      )}

      {/* Tab 3: Hardware Specs & Raw Manifest */}
      {activeSubTab === 'raw' && (
        <div className="glass-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: 14 }}>Hardware & File Integrity Telemetry</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Filename on MicroSD</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{session.metadata.filename}</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Audio Format & Rate</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                {session.metadata.sampleRateHz} Hz • {session.metadata.channels === 1 ? 'Mono' : 'Stereo'} • {session.metadata.bitDepth || 16}-bit PCM
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>File Size & Duration</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                {(session.metadata.fileSizeBytes / 1024).toFixed(1)} KB ({session.metadata.durationSeconds}s)
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CRC32 / Checksum</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>
                {session.metadata.checksumSha256}
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 8,
            padding: 14,
            fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            overflowX: 'auto',
          }}>
            <pre>{JSON.stringify({
              sessionId: session.id,
              deviceId: session.pendantDeviceId,
              capturedAt: new Date(session.capturedAtMs).toISOString(),
              syncStatus: session.syncStatus,
              metadata: session.metadata,
              insightsProvenance: session.insights.provider,
            }, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
