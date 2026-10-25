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
  searchFilter,
}) => {
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentTimeMs]);

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
              gap: 14,
              padding: '12px 16px',
              borderRadius: '14px',
              background: isActive 
                ? '#ecfdf5' 
                : '#fbfdfc',
              border: `1.5px solid ${isActive ? 'var(--accent-emerald)' : '#e2f4ea'}`,
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
              minWidth: 70,
              gap: 4,
            }}>
              <span 
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: isActive ? 'var(--accent-forest)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Clock size={12} color={isActive ? 'var(--accent-emerald)' : 'currentColor'} /> 
                {formatTimestamp(seg.startMs)}
              </span>
              {seg.speakerLabel && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--accent-forest)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: '#d1fae5',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                }}>
                  <User size={10} /> {seg.speakerLabel}
                </span>
              )}
            </div>

            {/* Segment Content */}
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: '0.92rem',
                lineHeight: 1.6,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}>
                {seg.words ? (
                  seg.words.map((w, wIdx) => {
                    const isWordActive = currentTimeMs >= w.startMs && currentTimeMs <= w.endMs;
                    return (
                      <span
                        key={wIdx}
                        style={{
                          background: isWordActive ? '#a7f3d0' : 'transparent',
                          color: isWordActive ? 'var(--accent-forest)' : 'inherit',
                          borderRadius: '3px',
                          padding: '0 2px',
                          transition: 'background-color 0.1s ease',
                        }}
                      >
                        {w.word}{' '}
                      </span>
                    );
                  })
                ) : (
                  seg.text
                )}
              </p>
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
          No transcript segments matching "{searchFilter}"
        </div>
      )}
    </div>
  );
};
