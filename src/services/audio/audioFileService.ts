/**
 * Ambient Memory Pendant - Audio File Management Service
 * Handles audio file validation, format detection, browser decoding probes,
 * SHA-256 calculation, and safe audio blob export.
 */

import { AudioMetadata, RecordingSession } from '../../types/session';

export const MAX_IMPORT_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB default max import

export interface AudioProbeResult {
  format: 'wav' | 'pcm' | 'opus' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'webm';
  sampleRateHz: number;
  channels: 1 | 2;
  bitDepth?: 16 | 24 | 32;
  durationSeconds: number;
  fileSizeBytes: number;
  checksumSha256: string;
}

export class AudioValidationError extends Error {
  public readonly code: 'UNSUPPORTED_FORMAT' | 'FILE_TOO_LARGE' | 'DECODE_FAILED' | 'EMPTY_FILE';

  constructor(code: 'UNSUPPORTED_FORMAT' | 'FILE_TOO_LARGE' | 'DECODE_FAILED' | 'EMPTY_FILE', message: string) {
    super(message);
    this.name = 'AudioValidationError';
    this.code = code;
  }
}

/**
 * Detects supported audio format by extension and MIME type
 */
export function detectAudioFormat(filename: string, mimeType: string): 'wav' | 'pcm' | 'opus' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'webm' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (ext === 'wav' || mime.includes('wav')) return 'wav';
  if (ext === 'mp3' || mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (ext === 'aac' || mime.includes('aac')) return 'aac';
  if (ext === 'm4a' || mime.includes('m4a') || mime.includes('mp4')) return 'm4a';
  if (ext === 'ogg' || mime.includes('ogg')) return 'ogg';
  if (ext === 'opus' || mime.includes('opus')) return 'opus';
  if (ext === 'webm' || mime.includes('webm')) return 'webm';
  if (ext === 'pcm') return 'pcm';

  return null;
}

/**
 * Sanitizes a filename so it is safe for all OS filesystems (Windows, macOS, Linux).
 */
export function sanitizeFilename(filename: string, fallbackBase = 'recording', extension = 'wav'): string {
  // Replace forbidden filename characters: / \ : * ? " < > | with _ and filter non-printable control chars
  const forbiddenChars = new Set(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);
  const cleaned = Array.from(filename)
    .map((ch) => (forbiddenChars.has(ch) ? '_' : ch))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();

  if (!cleaned || cleaned.replace(/_/g, '').trim().length === 0) {
    return `${fallbackBase}.${extension}`;
  }

  // Ensure it has an extension
  if (!cleaned.includes('.')) {
    return `${cleaned}.${extension}`;
  }

  return cleaned;
}

/**
 * Calculates SHA-256 hex digest of an ArrayBuffer via Web Crypto API
 */
export async function calculateSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }

  // Simple deterministic fallback hash if SubtleCrypto is unavailable
  let hash = 0;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i += 64) {
    hash = ((hash << 5) - hash + view[i]) | 0;
  }
  return `fallback_sha256_${Math.abs(hash).toString(16)}`;
}

/**
 * Probes audio data using browser's AudioContext or HTMLAudioElement
 * to measure duration and verify the audio is decodable without errors.
 */
export async function probeAudioFile(file: File): Promise<AudioProbeResult> {
  if (file.size === 0) {
    throw new AudioValidationError('EMPTY_FILE', 'The selected file is empty (0 bytes).');
  }

  if (file.size > MAX_IMPORT_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const maxMb = (MAX_IMPORT_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    throw new AudioValidationError(
      'FILE_TOO_LARGE',
      `File size (${sizeMb} MB) exceeds maximum allowed import size of ${maxMb} MB.`
    );
  }

  const format = detectAudioFormat(file.name, file.type);
  if (!format) {
    throw new AudioValidationError(
      'UNSUPPORTED_FORMAT',
      `Unsupported audio format. Supported file formats: WAV, MP3, M4A, AAC, OGG, OPUS, and WEBM.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const checksum = await calculateSha256(arrayBuffer);

  // Attempt decoding via Web Audio API AudioContext
  let duration = 0;
  let sampleRate = 16000;
  let channels: 1 | 2 = 1;

  let decodedViaAudioContext = false;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (AudioCtx) {
    try {
      const ctx = new AudioCtx();
      // Use slice to avoid neutering buffer in some browser implementations
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      duration = audioBuffer.duration;
      sampleRate = audioBuffer.sampleRate;
      channels = audioBuffer.numberOfChannels >= 2 ? 2 : 1;
      decodedViaAudioContext = true;
      await ctx.close().catch(() => {});
    } catch {
      // AudioContext may fail on certain valid containers (e.g. some webm/m4a encoders)
      decodedViaAudioContext = false;
    }
  }

  // Fallback probe via HTMLAudioElement if AudioContext failed
  if (!decodedViaAudioContext) {
    duration = await new Promise<number>((resolve, reject) => {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio();
      let cleanedUp = false;

      const cleanup = () => {
        if (!cleanedUp) {
          cleanedUp = true;
          URL.revokeObjectURL(audioUrl);
          audio.removeAttribute('src');
          audio.load();
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new AudioValidationError(
            'DECODE_FAILED',
            `Could not decode audio file "${file.name}". The file may be corrupt or encoded in an unsupported audio codec.`
          )
        );
      }, 7000);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = audio.duration;
        cleanup();
        if (isNaN(dur) || dur <= 0) {
          reject(
            new AudioValidationError(
              'DECODE_FAILED',
              `The audio file "${file.name}" has invalid or zero duration.`
            )
          );
        } else {
          resolve(dur);
        }
      };

      audio.onerror = () => {
        clearTimeout(timer);
        cleanup();
        reject(
          new AudioValidationError(
            'DECODE_FAILED',
            `The browser failed to decode "${file.name}". Ensure it is a valid, uncorrupted audio recording.`
          )
        );
      };

      audio.src = audioUrl;
    });
  }

  return {
    format,
    sampleRateHz: sampleRate,
    channels,
    bitDepth: 16,
    durationSeconds: Math.max(0.1, duration),
    fileSizeBytes: file.size,
    checksumSha256: checksum,
  };
}

/**
 * Constructs a fully initialized, un-analyzed RecordingSession model for an imported file.
 * Explicitly marks it with 'awaiting_analysis' status without fabricating AI insights.
 */
export function createImportedSession(file: File, probe: AudioProbeResult): RecordingSession {
  const sessionId = `session_import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  const metadata: AudioMetadata = {
    format: probe.format,
    sampleRateHz: probe.sampleRateHz,
    channels: probe.channels,
    bitDepth: probe.bitDepth || 16,
    durationSeconds: Math.round(probe.durationSeconds * 10) / 10,
    fileSizeBytes: probe.fileSizeBytes,
    checksumSha256: probe.checksumSha256,
    filename: sanitizeFilename(file.name, 'imported_audio', probe.format),
  };

  return {
    id: sessionId,
    title: cleanTitle.length > 0 ? cleanTitle : 'Imported Recording',
    capturedAtMs: file.lastModified || Date.now(),
    pendantDeviceId: 'LOCAL_IMPORT',
    metadata,
    transcript: [],
    insights: {
      provider: 'local_mock',
      isDemonstrationData: false,
      analyzedAtMs: Date.now(),
      executiveSummary: 'Audio imported from local file. Ready for local speech-to-text processing and insight generation.',
      importantTopics: ['imported-recording', probe.format],
      keyConcepts: [],
      thingsToRemember: [
        `Original file: ${file.name}`,
        `Size: ${(file.size / 1024).toFixed(1)} KB`,
        `Format: ${probe.format.toUpperCase()} (${probe.sampleRateHz} Hz)`,
      ],
      actionItems: [],
      studyQuestions: [],
      sentiment: 'neutral',
    },
    syncStatus: 'synced_local',
    processingStatus: 'awaiting_analysis',
    source: 'imported_file',
    tags: ['imported', probe.format],
  };
}

/**
 * Safely downloads an audio Blob with sanitized filename and guarantees
 * revocation of the temporary Object URL after the browser trigger.
 */
export function exportAudioBlob(blob: Blob, filename: string): void {
  if (!blob || blob.size === 0) {
    throw new Error('Cannot export empty audio data.');
  }

  const safeFilename = sanitizeFilename(filename, 'pendant_audio', 'wav');
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = safeFilename;

  document.body.appendChild(anchor);
  anchor.click();

  // Defer removal and revocation to allow browser download to start
  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}
