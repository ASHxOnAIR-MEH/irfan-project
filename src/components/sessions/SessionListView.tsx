import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  Trash2, 
  Play, 
  FileAudio, 
  ArrowDownCircle, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Tag
} from 'lucide-react';
import { RecordingSession } from '../../types/session';
import { SyncManifestItem } from '../../types/protocol';

interface SessionListViewProps {
  sessions: RecordingSession[];
  pendingManifest: SyncManifestItem[];
  onSelectSession: (session: RecordingSession) => void;
  onSyncSession: (item: SyncManifestItem) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleFavorite: (session: RecordingSession) => void;
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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const SessionListView: React.FC<SessionListViewProps> = ({
  sessions,
  pendingManifest,
  onSelectSession,
  onSyncSession,
  onDeleteSession,
  onToggleFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterFavorites, setFilterFavorites] = useState(false);

  // Extract all unique tags
  const allTags = Array.from(new Set(sessions.flatMap((s) => s.tags || [])));

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterFavorites && !s.isFavorite) return false;
    if (selectedTag && (!s.tags || !s.tags.includes(selectedTag))) return false;
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const titleMatch = s.title.toLowerCase().includes(query);
    const tagMatch = s.tags && s.tags.some((t) => t.toLowerCase().includes(query));
    const transcriptMatch = s.transcript && s.transcript.some((seg) => seg.text.toLowerCase().includes(query));
    const actionMatch = s.insights && s.insights.actionItems && s.insights.actionItems.some((a) => a.description.toLowerCase().includes(query));

    return titleMatch || tagMatch || transcriptMatch || actionMatch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Search & Filter Bar */}
      <div 
        className="glass-card"
        style={{ padding: 16 }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{
            flex: 1,
            minWidth: 240,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search title, spoken words, topics, action items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.88rem',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Favorites Filter Toggle */}
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`btn ${filterFavorites ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 14px' }}
          >
            <Star size={15} fill={filterFavorites ? 'currentColor' : 'none'} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Tag Pills Filter */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={12} /> Tags:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`badge ${selectedTag === null ? 'badge-cyan' : 'badge-secondary'}`}
              style={{
                cursor: 'pointer',
                background: selectedTag === null ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className="badge"
                style={{
                  cursor: 'pointer',
                  background: selectedTag === tag ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: selectedTag === tag ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: selectedTag === tag ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  textTransform: 'none',
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pending MicroSD Sync Banner (if items waiting) */}
      {pendingManifest.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowDownCircle size={18} color="var(--accent-amber)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              <strong>{pendingManifest.length} recording(s)</strong> waiting on MicroSD card.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {pendingManifest.map((item) => (
              <button
                key={item.sessionId}
                onClick={() => onSyncSession(item)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
              >
                Sync {item.filename}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className="glass-card"
            style={{
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div 
                onClick={() => onSelectSession(session)}
                style={{ cursor: 'pointer', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {session.title}
                  </h3>
                  {session.isFavorite && (
                    <Star size={15} fill="var(--accent-amber)" color="var(--accent-amber)" />
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{formatDate(session.capturedAtMs)}</span>
                  <span>•</span>
                  <span>{formatDuration(session.metadata.durationSeconds)}</span>
                  <span>•</span>
                  <span>{(session.metadata.fileSizeBytes / 1024).toFixed(0)} KB WAV</span>
                  <span>•</span>
                  <span>Device: {session.pendantDeviceId}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => onToggleFavorite(session)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: session.isFavorite ? 'var(--accent-amber)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                  }}
                  title={session.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
                >
                  <Star size={18} fill={session.isFavorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  onClick={() => onDeleteSession(session.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                  }}
                  title="Delete Local Copy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Quick Preview Snippet */}
            <p 
              onClick={() => onSelectSession(session)}
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                cursor: 'pointer',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {session.insights.executiveSummary}
            </p>

            {/* Footer with Tags & Open Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {session.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="badge"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      textTransform: 'none',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
                  <CheckCircle2 size={11} /> Synced
                </span>
                <button
                  onClick={() => onSelectSession(session)}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  <Play size={13} fill="currentColor" /> Play & Review
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
            <FileAudio size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ marginBottom: 6 }}>No recording sessions found</h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Try adjusting your search filters or start a recording on the pendant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
