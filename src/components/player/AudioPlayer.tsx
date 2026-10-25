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
  AlertCircle,
  ArrowDownCircle,
  Upload,
  HardDriveDownload,
  AlertTriangle
} from 'lucide-react';
import { AudioMetadata } from '../../types/session';

interface AudioPlayerProps {
  audioBlobUrl: string | null;
  metadata: AudioMetadata;
  onTimeUpdate?: (currentTimeMs: number) => void;
  seekTargetMs?: number | null;
  isLoading?: boolean;
  canSyncFromPendant?: boolean;
  onAttemptSync?: () => void;
  onReimportAudio?: (file: File) => void;
}

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBlobUrl,
  metadata,
  onTimeUpdate,
  seekTargetMs,
  isLoading = false,
  canSyncFromPendant = false,
  onAttemptSync,
  onReimportAudio,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [loadedDurationSec, setLoadedDurationSec] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [prevAudioUrl, setPrevAudioUrl] = useState(audioBlobUrl);

  const durationSec = loadedDurationSec ?? (metadata.durationSeconds > 0 ? metadata.durationSeconds : 1);

  // Synchronize state when audio source changes
  if (prevAudioUrl !== audioBlobUrl) {
    setPrevAudioUrl(audioBlobUrl);
    setCurrentTimeSec(0);
    setIsPlaying(false);
    setPlaybackError(null);
    setLoadedDurationSec(null);
  }

  // Handle external seek requests (e.g. from transcript clicks)
  useEffect(() => {
    if (seekTargetMs !== undefined && seekTargetMs !== null && audioRef.current && audioBlobUrl) {
      const targetSec = seekTargetMs / 1000;
      audioRef.current.currentTime = targetSec;
      setCurrentTimeSec(targetSec);
      if (onTimeUpdate) onTimeUpdate(seekTargetMs);
    }
  }, [seekTargetMs, onTimeUpdate, audioBlobUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioBlobUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setPlaybackError(null);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((e: unknown) => {
          console.warn('Audio playback error:', e);
          setIsPlaying(false);
          setPlaybackError(
            e instanceof Error
              ? `Playback could not start: ${e.message}`
              : 'The browser could not start audio playback.'
          );
        });
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
      setLoadedDurationSec(audioRef.current.duration);
    }
    setPlaybackError(null);
  };

  const handleAudioError = () => {
    if (!audioRef.current) return;
    const err = audioRef.current.error;
    setIsPlaying(false);

    if (!err) {
      setPlaybackError('An unknown audio playback error occurred.');
      return;
    }

    switch (err.code) {
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        setPlaybackError(
          `Format '${metadata.format.toUpperCase()}' is not supported by your current browser. Try importing in standard WAV or MP3 format.`
        );
        break;
      case MediaError.MEDIA_ERR_DECODE:
        setPlaybackError('Corrupt audio stream: the browser failed to decode the audio file.');
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        setPlaybackError('Network/storage error while reading the audio blob.');
        break;
      case MediaError.MEDIA_ERR_ABORTED:
        setPlaybackError('Playback was aborted by user or system.');
        break;
      default:
        setPlaybackError(`Audio playback error: ${err.message || 'Media decode failure'}`);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioBlobUrl) return;
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
    if (!audioRef.current || !audioBlobUrl) return;
    const nextTime = Math.max(0, Math.min(durationSec, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = nextTime;
    setCurrentTimeSec(nextTime);
  };

  const cycleSpeed = () => {
    if (!audioBlobUrl) return;
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current || !audioBlobUrl) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReimportAudio) {
      onReimportAudio(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const progressPercent = durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0;
  const barCount = 48;
  const isPlayable = Boolean(audioBlobUrl) && !playbackError && !isLoading;

  return (
    <div 
      className="white-card"
      style={{
        padding: 24,
        marginBottom: 20,
      }}
    >
      {/* Hidden HTML audio element */}
      {audioBlobUrl && (
        <audio
          ref={audioRef}
          src={audioBlobUrl}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleAudioError}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Hidden file input for re-importing missing audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.webm"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Recovery State: Missing Audio Warning Banner */}
      {!audioBlobUrl && !isLoading && (
        <div style={{
          background: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            <AlertCircle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
                Audio Not Available Locally
              </h4>
              <p style={{ fontSize: '0.82rem', color: '#b45309', lineHeight: 1.5 }}>
                The raw audio binary for this session is not present in local browser IndexedDB storage.
                Metadata, timestamps, and AI insights remain fully preserved.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
            {canSyncFromPendant && onAttemptSync && (
              <button
                onClick={onAttemptSync}
                className="btn btn-forest"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                <ArrowDownCircle size={15} />
                <span>Sync Audio from Connected Pendant</span>
              </button>
            )}

            {onReimportAudio && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                <Upload size={15} />
                <span>Re-Import Audio File</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading Audio State */}
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '12px 18px',
          borderRadius: '14px',
          marginBottom: 18,
          fontSize: '0.84rem',
        }}>
          <HardDriveDownload size={18} color="var(--accent-emerald)" style={{ animation: 'pulse 1.5s infinite' }} />
          <span>Retrieving audio stream from local IndexedDB storage...</span>
        </div>
      )}

      {/* Playback Error Banner */}
      {playbackError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          color: '#9f1239',
          padding: '12px 18px',
          borderRadius: '14px',
          marginBottom: 18,
          fontSize: '0.82rem',
        }}>
          <AlertTriangle size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
          <span>{playbackError}</span>
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
          background: isPlayable ? '#eefaf3' : '#f1f5f9',
          borderRadius: '12px',
          border: `1.5px solid ${isPlayable ? 'var(--border-card)' : '#cbd5e1'}`,
          position: 'relative',
          overflow: 'hidden',
          opacity: isPlayable ? 1 : 0.55,
        }}>
          {/* Waveform Bars */}
          {Array.from({ length: barCount }).map((_, idx) => {
            const barFraction = idx / barCount;
            const isPlayed = isPlayable && barFraction <= progressPercent / 100;
            // Aesthetic deterministic height curve based on duration
            const heightMultiplier = isPlayable
              ? 0.25 + 0.75 * Math.abs(Math.sin(idx * 0.45 + (metadata.durationSeconds || 1) * 0.1))
              : 0.2;
            const barHeight = Math.max(8, Math.round(heightMultiplier * 40));

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: barHeight,
                  borderRadius: 2,
                  background: isPlayed
                    ? 'var(--accent-emerald)'
                    : isPlayable
                    ? '#bce3cf'
                    : '#cbd5e1',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}

          {/* Range Input for Scrubbing */}
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.01}
            value={currentTimeSec}
            onChange={handleSeek}
            disabled={!isPlayable}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
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
          <span className={`badge ${isPlayable ? 'badge-emerald' : 'badge-secondary'}`} style={{ fontSize: '0.72rem' }}>
            <Activity size={12} /> {metadata.sampleRateHz ? metadata.sampleRateHz / 1000 : 16} kHz {metadata.format.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {(metadata.fileSizeBytes / 1024).toFixed(0)} KB
          </span>
        </div>

        {/* Center: Main Transport Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => skipSeconds(-5)}
            disabled={!isPlayable}
            className="btn btn-secondary"
            title="Rewind 5 seconds"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: '50%',
              opacity: isPlayable ? 1 : 0.4,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isPlayable}
            className="btn btn-forest"
            title={!isPlayable ? 'Audio unavailable' : isPlaying ? 'Pause' : 'Play'}
            style={{
              width: 50,
              height: 50,
              padding: 0,
              borderRadius: '50%',
              boxShadow: isPlayable ? '0 4px 18px rgba(5, 41, 30, 0.25)' : 'none',
              opacity: isPlayable ? 1 : 0.4,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
            }}
          >
            {isPlaying ? (
              <Pause size={22} color="#ffffff" />
            ) : (
              <Play size={22} color="#ffffff" style={{ marginLeft: 3 }} />
            )}
          </button>

          <button
            onClick={() => skipSeconds(5)}
            disabled={!isPlayable}
            className="btn btn-secondary"
            title="Forward 5 seconds"
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: '50%',
              opacity: isPlayable ? 1 : 0.4,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCw size={15} />
          </button>
        </div>

        {/* Right: Speed & Mute */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={cycleSpeed}
            disabled={!isPlayable}
            className="btn btn-secondary"
            title="Cycle Playback Speed"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              opacity: isPlayable ? 1 : 0.4,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
            }}
          >
            <Gauge size={13} /> {playbackRate}x
          </button>

          <button
            onClick={toggleMute}
            disabled={!isPlayable}
            className="btn btn-secondary"
            title={isMuted ? 'Unmute' : 'Mute'}
            style={{
              width: 36,
              height: 36,
              padding: 0,
              borderRadius: '50%',
              opacity: isPlayable ? 1 : 0.4,
              cursor: isPlayable ? 'pointer' : 'not-allowed',
            }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
};
