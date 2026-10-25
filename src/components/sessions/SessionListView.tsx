import React, { useRef, useState } from 'react';
import { 
  Search, 
  Star, 
  Trash2, 
  Play, 
  FileAudio, 
  ArrowDownCircle, 
  CheckCircle2, 
  Tag,
  ArrowUpDown,
  Upload,
  Download,
  AlertTriangle,
  Sparkles,
  X
} from 'lucide-react';
import { RecordingSession } from '../../types/session';
import { SyncManifestItem } from '../../types/protocol';
import { 
  MAX_IMPORT_SIZE_BYTES, 
  probeAudioFile, 
  createImportedSession, 
  AudioValidationError,
  exportAudioBlob
} from '../../services/audio/audioFileService';
import { localDb } from '../../services/storage/indexedDb';

interface SessionListViewProps {
  sessions: RecordingSession[];
  pendingManifest: SyncManifestItem[];
  onSelectSession: (session: RecordingSession) => void;
  onSyncSession: (item: SyncManifestItem) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleFavorite: (session: RecordingSession) => void;
  onSessionImported?: (newSession: RecordingSession) => void;
}

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
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
  onSessionImported,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterFavorites, setFilterFavorites] = useState(false);

  type SortOption = 'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'title_asc';
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');

  // Import State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Deletion Confirmation State
  const [sessionToDelete, setSessionToDelete] = useState<RecordingSession | null>(null);

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

  // Handle Audio File Selection & Import
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsImporting(true);
    setImportError(null);
    setImportSuccessMessage(null);
    setImportProgressText(`Analyzing audio data in "${file.name}"...`);

    try {
      // 1. Probe & validate audio file (checks size, format, decodability, calculates SHA-256)
      const probe = await probeAudioFile(file);
      setImportProgressText('Creating session metadata and committing to local IndexedDB...');

      // 2. Build imported session record (no fabricated AI results)
      const newSession = createImportedSession(file, probe);

      // 3. Atomically persist both session metadata and raw audio blob
      await localDb.saveSessionWithAudio(newSession, file);

      setImportSuccessMessage(`Successfully imported "${newSession.title}" (${formatDuration(probe.durationSeconds)}).`);
      setTimeout(() => setImportSuccessMessage(null), 4000);

      if (onSessionImported) {
        onSessionImported(newSession);
      }
    } catch (err: unknown) {
      console.error('Audio import failed:', err);
      if (err instanceof AudioValidationError) {
        setImportError(err.message);
      } else if (err instanceof Error) {
        setImportError(err.message);
      } else {
        setImportError('An unexpected error occurred while importing the audio file.');
      }
    } finally {
      setIsImporting(false);
      setImportProgressText(null);
    }
  };

  const handleExportSession = async (session: RecordingSession, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blob = await localDb.getAudioBlob(session.id);
      if (!blob || blob.size === 0) {
        alert(`Cannot export: Audio file for "${session.title}" is missing from local storage.`);
        return;
      }
      exportAudioBlob(blob, session.metadata.filename || `${session.title}.${session.metadata.format}`);
    } catch (err: unknown) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleConfirmDelete = () => {
    if (!sessionToDelete) return;
    const id = sessionToDelete.id;
    setSessionToDelete(null);
    onDeleteSession(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.webm"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Top Search, Filter & Action Bar */}
      <div 
        className="white-card"
        style={{ padding: 22 }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Import Audio Action Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="btn btn-forest"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              title={`Import local audio file (Max ${(MAX_IMPORT_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB: WAV, MP3, M4A, OGG, WEBM)`}
            >
              <Upload size={15} />
              <span>{isImporting ? 'Importing...' : 'Import Audio'}</span>
            </button>

            {/* Favorites Filter Toggle */}
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`btn ${filterFavorites ? 'btn-forest' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
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
                onChange={(e) => setSortBy(e.target.value as SortOption)}
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
        </div>

        {/* Import Format Hint */}
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>Accepted formats:</span>
          {['WAV', 'MP3', 'M4A', 'AAC', 'OGG', 'OPUS', 'WEBM'].map((fmt) => (
            <span key={fmt} className="badge badge-secondary" style={{ fontSize: '0.66rem', padding: '2px 8px' }}>
              {fmt}
            </span>
          ))}
          <span>• Max size: {(MAX_IMPORT_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB</span>
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

      {/* Import Feedback Banners */}
      {isImporting && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#ecfdf5',
          border: '1.5px solid #a7f3d0',
          color: '#065f46',
          padding: '14px 20px',
          borderRadius: '16px',
          fontSize: '0.84rem',
        }}>
          <Sparkles size={18} color="var(--accent-emerald)" style={{ animation: 'spin 2s linear infinite', flexShrink: 0 }} />
          <span>{importProgressText || 'Importing audio file into IndexedDB...'}</span>
        </div>
      )}

      {importError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          color: '#9f1239',
          padding: '14px 20px',
          borderRadius: '16px',
          fontSize: '0.84rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
            <span>{importError}</span>
          </div>
          <button
            onClick={() => setImportError(null)}
            style={{ background: 'transparent', border: 'none', color: '#9f1239', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {importSuccessMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: '#ecfdf5',
          border: '1.5px solid #a7f3d0',
          color: '#065f46',
          padding: '14px 20px',
          borderRadius: '16px',
          fontSize: '0.84rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={18} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
            <span>{importSuccessMessage}</span>
          </div>
          <button
            onClick={() => setImportSuccessMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#065f46', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal / Card */}
      {sessionToDelete && (
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fca5a5',
          borderRadius: '16px',
          padding: 20,
        }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#991b1b', marginBottom: 6 }}>
            Confirm Permanent Session Deletion
          </h4>
          <p style={{ fontSize: '0.84rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: 16 }}>
            Are you sure you want to permanently delete <strong>"{sessionToDelete.title}"</strong>?
            Both the session metadata and the audio recording will be removed from local storage.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleConfirmDelete}
              className="btn btn-danger"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              <Trash2 size={14} /> Permanently Delete
            </button>
            <button
              onClick={() => setSessionToDelete(null)}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontSize: '0.82rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {session.title}
                  </h3>
                  {session.isFavorite && (
                    <Star size={16} fill="var(--accent-amber)" color="var(--accent-amber)" />
                  )}
                  {session.processingStatus === 'awaiting_analysis' && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                      Awaiting Analysis
                    </span>
                  )}
                  {session.source === 'imported_file' && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                      Imported
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{formatDate(session.capturedAtMs)}</span>
                  <span>•</span>
                  <span>{formatDuration(session.metadata.durationSeconds)}</span>
                  <span>•</span>
                  <span>{(session.metadata.fileSizeBytes / 1024).toFixed(0)} KB {session.metadata.format.toUpperCase()}</span>
                  <span>•</span>
                  <span>Device: {session.pendantDeviceId}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={(e) => handleExportSession(session, e)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 6,
                  }}
                  title="Export raw audio file"
                >
                  <Download size={16} />
                </button>

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
                  onClick={() => setSessionToDelete(session)}
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
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 18px' }}>
              Import an audio file (WAV, MP3, M4A, OGG, WEBM) or record a new memo using your Ambient Memory Pendant.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-forest"
              style={{ padding: '8px 20px', fontSize: '0.84rem' }}
            >
              <Upload size={15} /> Import Audio File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
