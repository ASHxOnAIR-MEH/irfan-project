import React, { useEffect, useRef } from 'react';
import { TranscriptSegment } from '../../types/session';
import { Clock, User } from 'lucide-react';

interface InteractiveTranscriptProps {
  segments: TranscriptSegment[];
  currentTimeMs: number;
  onSeekToMs: (ms: number) => void;
  searchFilter?: string;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({
  segments,
  currentTimeMs,
  onSeekToMs,
  searchFilter = '',
}) => {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  const filtered = segments.filter((seg) => {
    if (!searchFilter) return true;
    return (
      seg.text.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (seg.speakerLabel && seg.speakerLabel.toLowerCase().includes(searchFilter.toLowerCase()))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {filtered.map((seg) => {
        const isActive = currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs;

        return (
          <div
            key={seg.id}
            ref={isActive ? activeSegmentRef : null}
            onClick={() => onSeekToMs(seg.startMs)}
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: isActive 
                ? 'rgba(0, 242, 254, 0.08)' 
                : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${isActive ? 'rgba(0, 242, 254, 0.35)' : 'var(--border-subtle)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
            className="transcript-segment-row"
          >
            {/* Timestamp Badge / Play trigger */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minWidth: 60,
              gap: 4,
            }}>
              <span 
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Clock size={11} /> {formatTimestamp(seg.startMs)}
              </span>
              {seg.speakerLabel && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  <User size={10} /> {seg.speakerLabel}
                </span>
              )}
            </div>

            {/* Spoken Text */}
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: '0.88rem',
                lineHeight: 1.55,
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                fontWeight: isActive ? 500 : 400,
              }}>
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          No transcript segments matching search.
        </div>
      )}

      <style>{`
        .transcript-segment-row:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.18) !important;
        }
      `}</style>
    </div>
  );
};
