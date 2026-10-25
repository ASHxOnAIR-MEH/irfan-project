import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Activity, 
  Gauge,
  AlertCircle
} from 'lucide-react';
import { AudioMetadata } from '../../types/session';

interface AudioPlayerProps {
  audioBlobUrl: string | null;
  metadata: AudioMetadata;
  onTimeUpdate?: (currentTimeMs: number) => void;
  seekTargetMs?: number | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBlobUrl,
  metadata,
  onTimeUpdate,
  seekTargetMs,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(metadata.durationSeconds || 1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (seekTargetMs !== undefined && seekTargetMs !== null && audioRef.current) {
      const targetSec = seekTargetMs / 1000;
      audioRef.current.currentTime = targetSec;
      setCurrentTimeSec(targetSec);
      if (onTimeUpdate) onTimeUpdate(seekTargetMs);
    }
  }, [seekTargetMs, onTimeUpdate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.warn('Audio play error:', e));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    setCurrentTimeSec(current);
    if (onTimeUpdate) {
      onTimeUpdate(Math.round(current * 1000));
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setDurationSec(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newSec;
      setCurrentTimeSec(newSec);
      if (onTimeUpdate) {
        onTimeUpdate(Math.round(newSec * 1000));
      }
    }
  };

  const skipSeconds = (delta: number) => {
    if (!audioRef.current) return;
    const nextTime = Math.max(0, Math.min(durationSec, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = nextTime;
    setCurrentTimeSec(nextTime);
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const progressPercent = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0;
  const barCount = 48;

  return (
    <div 
      className="white-card"
      style={{
        padding: 24,
        marginBottom: 20,
      }}
    >
      {/* Hidden audio element */}
      {audioBlobUrl ? (
        <audio
          ref={audioRef}
          src={audioBlobUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          padding: '10px 16px',
          borderRadius: '12px',
          marginBottom: 16,
          fontSize: '0.84rem',
        }}>
          <AlertCircle size={16} />
          <span>Audio blob not available in browser IndexedDB cache. Metadata and transcripts preserved.</span>
        </div>
      )}

      {/* Waveform Scrubber Visual */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          height: 52,
          padding: '0 10px',
          background: '#eefaf3',
          borderRadius: '12px',
          border: '1.5px solid var(--border-card)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Waveform Bars */}
          {Array.from({ length: barCount }).map((_, idx) => {
            const barFraction = idx / barCount;
            const isPlayed = barFraction <= (progressPercent / 100);
            const heightMultiplier = 0.25 + 0.75 * Math.abs(Math.sin((idx * 0.45) + (metadata.durationSeconds * 0.1)));
            const barHeight = Math.max(8, Math.round(heightMultiplier * 40));

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: barHeight,
                  borderRadius: 2,
                  background: isPlayed ? 'var(--accent-emerald)' : '#bce3cf',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}

          {/* Invisible Range Input for Scrubbing */}
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.01}
            value={currentTimeSec}
            onChange={handleSeek}
            disabled={!audioBlobUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: audioBlobUrl ? 'pointer' : 'default',
              margin: 0,
            }}
          />
        </div>

        {/* Timestamps */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.76rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          marginTop: 6,
          padding: '0 4px',
        }}>
          <span>{formatDuration(currentTimeSec)}</span>
          <span>{formatDuration(durationSec)}</span>
        </div>
      </div>

      {/* Playback Controls Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Left: Metadata badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
            <Activity size={12} /> {metadata.sampleRateHz / 1000} kHz {metadata.format.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {(metadata.fileSizeBytes / 1024).toFixed(0)} KB
          </span>
        </div>

        {/* Center: Main Transport Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => skipSeconds(-5)}
            disabled={!audioBlobUrl}
            className="btn btn-secondary"
            title="Rewind 5 seconds"
            style={{ width: 38, height: 38, padding: 0, borderRadius: '50%' }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={togglePlay}
            disabled={!audioBlobUrl}
            className="btn btn-forest"
            title={isPlaying ? 'Pause' : 'Play'}
            style={{
              width: 50,
              height: 50,
              padding: 0,
              borderRadius: '50%',
              boxShadow: '0 4px 18px rgba(5, 41, 30, 0.25)',
              opacity: audioBlobUrl ? 1 : 0.5,
            }}
          >
            {isPlaying ? <Pause size={22} color="#ffffff" /> : <Play size={22} color="#ffffff" style={{ marginLeft: 3 }} />}
          </button>

          <button
            onClick={() => skipSeconds(5)}
            disabled={!audioBlobUrl}
            className="btn btn-secondary"
            title="Forward 5 seconds"
            style={{ width: 38, height: 38, padding: 0, borderRadius: '50%' }}
          >
            <RotateCw size={15} />
          </button>
        </div>

        {/* Right: Speed & Mute */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={cycleSpeed}
            disabled={!audioBlobUrl}
            className="btn btn-secondary"
            title="Cycle Playback Speed"
            style={{ padding: '6px 12px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}
          >
            <Gauge size={13} /> {playbackRate}x
          </button>

          <button
            onClick={toggleMute}
            disabled={!audioBlobUrl}
            className="btn btn-secondary"
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
};
