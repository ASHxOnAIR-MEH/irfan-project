import React, { useState } from 'react';
import { 
  Search, 
  Star, 
  Trash2, 
  Play, 
  FileAudio, 
  ArrowDownCircle, 
  CheckCircle2, 
  Tag,
  ArrowUpDown
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

  type SortOption = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'title_asc';
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Extract all unique tags
  const allTags = Array.from(new Set(sessions.flatMap((s) => s.tags || [])));

  // Filtered & Sorted sessions
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

  filteredSessions.sort((a, b) => {
    switch (sortBy) {
      case 'date_desc':
        return b.capturedAtMs - a.capturedAtMs;
      case 'date_asc':
        return a.capturedAtMs - b.capturedAtMs;
      case 'duration_desc':
        return b.metadata.durationSeconds - a.metadata.durationSeconds;
      case 'duration_asc':
        return a.metadata.durationSeconds - b.metadata.durationSeconds;
      case 'title_asc':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Search & Filter Bar */}
      <div 
        className="white-card"
        style={{ padding: 20 }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{
            flex: 1,
            minWidth: 260,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#f8faf9',
            border: '1.5px solid var(--border-card)',
            borderRadius: 'var(--radius-full)',
            padding: '8px 16px',
          }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search title, spoken words, topics, tasks..."
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
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Favorites Filter Toggle */}
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`btn ${filterFavorites ? 'btn-forest' : 'btn-secondary'}`}
            style={{ padding: '8px 16px' }}
          >
            <Star size={15} fill={filterFavorites ? 'currentColor' : 'none'} />
            <span>Favorites</span>
          </button>

          {/* Sorting Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#ffffff',
            border: '1.5px solid var(--border-card)',
            borderRadius: 'var(--radius-full)',
            padding: '0 14px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <ArrowUpDown size={14} color="var(--accent-forest)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                padding: '10px 0',
              }}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="duration_desc">Longest Duration</option>
              <option value="duration_asc">Shortest Duration</option>
              <option value="title_asc">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Tag Pills Filter */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={13} /> Tags:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`badge ${selectedTag === null ? 'badge-forest' : 'badge-secondary'}`}
              style={{ cursor: 'pointer' }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`badge ${selectedTag === tag ? 'badge-forest' : 'badge-emerald'}`}
                style={{
                  cursor: 'pointer',
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
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: '16px',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowDownCircle size={18} color="#d97706" />
            <span style={{ fontSize: '0.86rem', color: '#92400e' }}>
              <strong>{pendingManifest.length} recording(s)</strong> waiting on MicroSD card.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pendingManifest.map((item) => (
              <button
                key={item.sessionId}
                onClick={() => onSyncSession(item)}
                className="btn btn-forest"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                Sync {item.filename}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className="white-card"
            style={{
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div 
                onClick={() => onSelectSession(session)}
                style={{ cursor: 'pointer', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {session.title}
                  </h3>
                  {session.isFavorite && (
                    <Star size={16} fill="var(--accent-amber)" color="var(--accent-amber)" />
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                fontSize: '0.88rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
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
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {session.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="badge badge-emerald"
                    style={{
                      fontSize: '0.72rem',
                      textTransform: 'none',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-emerald" style={{ fontSize: '0.7rem' }}>
                  <CheckCircle2 size={11} /> Synced Local
                </span>
                <button
                  onClick={() => onSelectSession(session)}
                  className="btn btn-forest"
                  style={{ padding: '7px 18px', fontSize: '0.82rem' }}
                >
                  <Play size={13} fill="currentColor" /> Play & Review
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredSessions.length === 0 && (
          <div className="white-card" style={{ padding: 48, textAlign: 'center' }}>
            <FileAudio size={42} color="var(--accent-forest)" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: '1.2rem', marginBottom: 6 }}>No recording sessions found</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
              Try adjusting your search query, clearing filters, or record a new voice memo using the Ambient Pendant.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
