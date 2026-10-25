/**
 * Ambient Memory Pendant - Session, Transcript, and AI Insights Data Models
 */

export interface AudioMetadata {
  format: 'wav' | 'pcm' | 'opus' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'webm';
  sampleRateHz: number;
  channels: 1 | 2;
  bitDepth?: 16 | 24 | 32;
  durationSeconds: number;
  fileSizeBytes: number;
  checksumSha256: string;
  filename: string;
}

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptSegment {
  id: string;
  speakerLabel?: string;
  startMs: number;
  endMs: number;
  text: string;
  words?: TranscriptWord[];
}

export interface ActionItem {
  id: string;
  description: string;
  completed: boolean;
  assignedTo?: string;
  dueSuggestion?: string;
  sourceTimestampMs?: number;
}

export interface KeyConcept {
  term: string;
  explanation: string;
  contextSnippet?: string;
}

export interface StudyQuestion {
  id: string;
  question: string;
  answerSummary: string;
  sourceTimestampMs?: number;
}

export interface AIAnalysis {
  provider: 'local_mock' | 'cloud_gemini' | 'cloud_whisper' | 'webllm_local';
  isDemonstrationData: boolean;
  analyzedAtMs: number;
  executiveSummary: string;
  importantTopics: string[];
  keyConcepts: KeyConcept[];
  thingsToRemember: string[];
  actionItems: ActionItem[];
  studyQuestions: StudyQuestion[];
  sentiment?: 'reflective' | 'action_oriented' | 'analytical' | 'neutral' | 'urgent';
  processingDurationMs?: number;
}

export type SyncStatus = 'pendant_only' | 'syncing' | 'synced_local' | 'sync_failed';

export type ProcessingStatus = 'awaiting_analysis' | 'processing' | 'completed' | 'failed';

export interface RecordingSession {
  id: string;
  title: string;
  capturedAtMs: number;
  pendantDeviceId: string;
  metadata: AudioMetadata;
  transcript: TranscriptSegment[];
  insights: AIAnalysis;
  audioBlobUrl?: string; // in-memory Object URL created from IndexedDB blob
  syncStatus: SyncStatus;
  processingStatus?: ProcessingStatus;
  source?: 'pendant_mic' | 'imported_file' | 'simulation';
  hasAudioMissing?: boolean;
  transferProgressPercent?: number;
  tags: string[];
  notes?: string;
  isFavorite?: boolean;
}
