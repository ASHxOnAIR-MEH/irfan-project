/**
 * Ambient Memory Pendant — Local AI Backend API Client
 *
 * Typed TypeScript interface to the FastAPI backend running at
 * http://127.0.0.1:8787
 *
 * All data stays local. No cloud APIs are used.
 */

export const BACKEND_BASE_URL = 'http://127.0.0.1:8787';

// ─── Response Type Definitions ────────────────────────────────────────────────

export interface BackendTranscriptWord {
  word: string;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
}

export interface BackendTranscriptSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  words: BackendTranscriptWord[];
}

export interface BackendKeyConcept {
  term: string;
  explanation: string;
}

export interface BackendActionItem {
  id: string;
  description: string;
  completed: boolean;
  due_suggestion: string | null;
  source_timestamp_ms: number | null;
}

export interface BackendStudyQuestion {
  id: string;
  question: string;
  answer_summary: string;
}

export interface BackendAIInsights {
  executive_summary: string;
  important_topics: string[];
  key_concepts: BackendKeyConcept[];
  things_to_remember: string[];
  action_items: BackendActionItem[];
  study_questions: BackendStudyQuestion[];
  sentiment: 'reflective' | 'action_oriented' | 'analytical' | 'neutral' | 'urgent' | string;
}

/**
 * "ollama_local"        – Ollama ran successfully and returned a parseable summary.
 * "transcript_fallback" – Ollama was unavailable or failed; summary is NOT AI-generated.
 */
export type SummarizationProvider = 'ollama_local' | 'transcript_fallback';

export interface AnalyzeAudioResponse {
  session_id: string;
  transcript_segments: BackendTranscriptSegment[];
  full_text: string;
  language: string;
  /** Whether Ollama successfully generated a real AI summary. */
  summarization_provider: SummarizationProvider;
  summarization_succeeded: boolean;
  /** Characters actually sent to the LLM (equals full_text length when no truncation). */
  transcript_chars_processed: number;
  insights: BackendAIInsights;
  transcription_duration_ms: number;
  summarization_duration_ms: number;
  whisper_model: string;
  ollama_model: string;
}

export interface HealthResponse {
  status: string;
  whisper_model: string;
  ollama_url: string;
  ollama_model: string;
  ollama_reachable: boolean;
  ollama_model_available: boolean;
  available_ollama_models: string[];
  chunk_char_limit: number;
}

/** Successful retry response — always represents a real Ollama summary. */
export interface RetrySummarizationResponse {
  insights: BackendAIInsights;
  summarization_provider: SummarizationProvider;
  summarization_succeeded: boolean;
  transcript_chars_processed: number;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

export class BackendApiError extends Error {
  public readonly status: number;
  public readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Backend API Error ${status}: ${detail}`);
    this.name = 'BackendApiError';
    this.status = status;
    this.detail = detail;
  }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Checks the backend health: Whisper model loaded + Ollama reachability.
 * Throws BackendApiError if the backend is not reachable.
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  let resp: Response;
  try {
    resp = await fetch(`${BACKEND_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new BackendApiError(
      0,
      'Cannot reach the local AI backend at ' + BACKEND_BASE_URL +
        '. Make sure the backend server is running (see backend/README.md).'
    );
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new BackendApiError(resp.status, body || resp.statusText);
  }

  return resp.json() as Promise<HealthResponse>;
}

/**
 * Uploads an audio file to the backend for transcription and summarization.
 * Returns the full analysis result including transcript segments, AI insights,
 * and an explicit `summarization_succeeded` flag.
 *
 * @param file        - Audio file to upload
 * @param sessionId   - Optional existing session ID to tag the result with
 * @param language    - Optional language hint (e.g. "en", "ar")
 * @param onProgress  - Optional callback for upload progress (0.0–1.0)
 * @param signal      - Optional AbortSignal for cancellation
 */
export async function analyzeAudioFile(
  file: File,
  sessionId?: string,
  language?: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<AnalyzeAudioResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionId) formData.append('session_id', sessionId);
  if (language) formData.append('language', language);

  // Use XMLHttpRequest for upload progress tracking
  return new Promise<AnalyzeAudioResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${BACKEND_BASE_URL}/api/analyze-audio`);
    xhr.timeout = 12 * 60 * 1000; // 12 minutes for large files + long transcription

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Analyze audio aborted by caller', 'AbortError'));
      });
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        // Upload progress covers 0–30%; processing (transcription + summarization) is the rest.
        onProgress(Math.min(0.3, (e.loaded / e.total) * 0.3));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as AnalyzeAudioResponse;
          resolve(data);
        } catch {
          reject(new BackendApiError(xhr.status, 'Invalid JSON response from backend.'));
        }
      } else {
        let detail = xhr.statusText;
        try {
          const errBody = JSON.parse(xhr.responseText);
          detail = errBody.detail || detail;
        } catch { /* ignore */ }
        reject(new BackendApiError(xhr.status, detail));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new BackendApiError(0, 'Network error connecting to local AI backend.'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new BackendApiError(0, 'Request to local AI backend timed out after 12 minutes.'));
    });

    xhr.send(formData);
  });
}

/**
 * Re-runs only the summarization step for an existing transcript.
 * The backend returns HTTP 503 if Ollama is not available, so this function
 * throws BackendApiError rather than silently returning a fallback.
 * The caller can display the error and keep a Retry button active.
 */
export async function retrySummarization(
  fullText: string,
  sessionId?: string
): Promise<RetrySummarizationResponse> {
  let resp: Response;
  try {
    resp = await fetch(`${BACKEND_BASE_URL}/api/retry-summarization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_text: fullText, session_id: sessionId }),
      signal: AbortSignal.timeout(180_000), // 3 minutes — long transcripts need time
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new BackendApiError(0, 'Summarization request timed out after 3 minutes.');
    }
    throw new BackendApiError(0, 'Cannot reach the local AI backend.');
  }

  if (!resp.ok) {
    const body = await resp.text();
    let detail = body;
    try {
      detail = JSON.parse(body)?.detail || body;
    } catch { /* ignore */ }
    throw new BackendApiError(resp.status, detail);
  }

  return resp.json() as Promise<RetrySummarizationResponse>;
}

// ─── Adapter: Backend → Frontend session types ────────────────────────────────

import type {
  TranscriptSegment,
  TranscriptWord,
  AIAnalysis,
  ActionItem,
  KeyConcept,
  StudyQuestion,
} from '../../types/session';

/**
 * Maps a BackendAIInsights object + metadata into the frontend AIAnalysis model.
 * Uses summarization_provider to set the correct provider string so the UI
 * can accurately label whether output is an Ollama summary or a fallback.
 */
function _mapInsights(
  insights: BackendAIInsights,
  summarizationProvider: SummarizationProvider,
  summarizationFailed: boolean,
  transcriptCharsSent: number,
  transcriptionMs: number,
  summarizationMs: number,
): AIAnalysis {
  const keyConcepts: KeyConcept[] = insights.key_concepts.map((kc) => ({
    term: kc.term,
    explanation: kc.explanation,
  }));

  const actionItems: ActionItem[] = insights.action_items.map((ai) => ({
    id: ai.id,
    description: ai.description,
    completed: ai.completed,
    dueSuggestion: ai.due_suggestion ?? undefined,
    sourceTimestampMs: ai.source_timestamp_ms ?? undefined,
  }));

  const studyQuestions: StudyQuestion[] = insights.study_questions.map((sq) => ({
    id: sq.id,
    question: sq.question,
    answerSummary: sq.answer_summary,
  }));

  const validSentiments = ['reflective', 'action_oriented', 'analytical', 'neutral', 'urgent'] as const;
  type Sentiment = (typeof validSentiments)[number];
  const sentiment: Sentiment = validSentiments.includes(insights.sentiment as Sentiment)
    ? (insights.sentiment as Sentiment)
    : 'neutral';

  return {
    // Map backend provider string to the session.ts AIAnalysis.provider type.
    // 'ollama_local' and 'transcript_fallback' are both now in the union type.
    provider: summarizationProvider === 'ollama_local' ? 'ollama_local' : 'transcript_fallback',
    isDemonstrationData: false,
    analyzedAtMs: Date.now(),
    executiveSummary: insights.executive_summary,
    importantTopics: insights.important_topics,
    keyConcepts,
    thingsToRemember: insights.things_to_remember,
    actionItems,
    studyQuestions,
    sentiment,
    processingDurationMs: transcriptionMs + summarizationMs,
    summarizationFailed,
    transcriptCharsSent,
  };
}

/**
 * Converts a full AnalyzeAudioResponse into frontend session data models.
 * Also returns `summarizationFailed` so the caller knows whether to show
 * the retry UI.
 */
export function mapBackendResponseToSession(resp: AnalyzeAudioResponse): {
  transcript: TranscriptSegment[];
  insights: AIAnalysis;
  summarizationFailed: boolean;
} {
  const transcript: TranscriptSegment[] = resp.transcript_segments.map((seg) => {
    const words: TranscriptWord[] | undefined =
      seg.words.length > 0
        ? seg.words.map((w) => ({
            word: w.word,
            startMs: w.start_ms,
            endMs: w.end_ms,
            confidence: w.confidence ?? undefined,
          }))
        : undefined;

    return {
      id: seg.id,
      startMs: seg.start_ms,
      endMs: seg.end_ms,
      text: seg.text,
      words,
    };
  });

  const summarizationFailed = !resp.summarization_succeeded;

  const insights = _mapInsights(
    resp.insights,
    resp.summarization_provider,
    summarizationFailed,
    resp.transcript_chars_processed,
    resp.transcription_duration_ms,
    resp.summarization_duration_ms,
  );

  return { transcript, insights, summarizationFailed };
}

/**
 * Maps a successful RetrySummarizationResponse into an AIAnalysis update.
 * Only call this when the retry actually succeeded (HTTP 200 + provider = ollama_local).
 */
export function mapRetryResponseToInsights(
  resp: RetrySummarizationResponse,
  existingTranscriptionMs = 0,
): AIAnalysis {
  return _mapInsights(
    resp.insights,
    resp.summarization_provider,
    false,
    resp.transcript_chars_processed,
    existingTranscriptionMs,
    0,
  );
}
