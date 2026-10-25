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
  /**
   * Provider values:
   *   local_mock        – seeded demo data, never real audio
   *   cloud_gemini      – Gemini cloud API (not yet implemented)
   *   cloud_whisper     – OpenAI Whisper cloud API (not yet implemented)
   *   webllm_local      – reserved for future in-browser WebLLM
   *   ollama_local      – real Ollama LLM successfully generated this summary
   *   transcript_fallback – Ollama was unavailable; summary is derived from
   *                         transcript text only, NOT an LLM summary
   */
  provider: 'local_mock' | 'cloud_gemini' | 'cloud_whisper' | 'webllm_local'
          | 'ollama_local' | 'transcript_fallback';
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
  /** True when transcription succeeded but LLM summarization did not run or failed. */
  summarizationFailed?: boolean;
  /** Number of transcript characters sent to the LLM (may be less than full_text if truncated). */
  transcriptCharsSent?: number;
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
