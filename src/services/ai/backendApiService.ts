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

export interface AnalyzeAudioResponse {
  session_id: string;
  transcript_segments: BackendTranscriptSegment[];
  full_text: string;
  language: string;
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
}

export interface RetrySummarizationResponse extends BackendAIInsights {}

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
  } catch (err) {
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
 * Returns the full analysis result including transcript segments and AI insights.
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
    xhr.timeout = 10 * 60 * 1000; // 10 minutes for large files

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Analyze audio aborted by caller', 'AbortError'));
      });
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        // Upload progress covers 0–30%, the rest is processing time
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
      reject(new BackendApiError(0, 'Request to local AI backend timed out after 10 minutes.'));
    });

    xhr.send(formData);
  });
}

/**
 * Re-runs only the summarization step for an existing transcript.
 * Useful when transcription succeeded but Ollama was unavailable.
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
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new BackendApiError(0, 'Summarization request timed out.');
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
 * Converts a backend AnalyzeAudioResponse into the frontend session data models.
 */
export function mapBackendResponseToSession(resp: AnalyzeAudioResponse): {
  transcript: TranscriptSegment[];
  insights: AIAnalysis;
} {
  const transcript: TranscriptSegment[] = resp.transcript_segments.map((seg) => {
    const words: TranscriptWord[] | undefined = seg.words.length > 0
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

  const keyConcepts: KeyConcept[] = resp.insights.key_concepts.map((kc) => ({
    term: kc.term,
    explanation: kc.explanation,
  }));

  const actionItems: ActionItem[] = resp.insights.action_items.map((ai) => ({
    id: ai.id,
    description: ai.description,
    completed: ai.completed,
    dueSuggestion: ai.due_suggestion ?? undefined,
    sourceTimestampMs: ai.source_timestamp_ms ?? undefined,
  }));

  const studyQuestions: StudyQuestion[] = resp.insights.study_questions.map((sq) => ({
    id: sq.id,
    question: sq.question,
    answerSummary: sq.answer_summary,
  }));

  const validSentiments = ['reflective', 'action_oriented', 'analytical', 'neutral', 'urgent'] as const;
  type Sentiment = (typeof validSentiments)[number];
  const sentiment: Sentiment = validSentiments.includes(resp.insights.sentiment as Sentiment)
    ? (resp.insights.sentiment as Sentiment)
    : 'neutral';

  const totalProcessingMs = resp.transcription_duration_ms + resp.summarization_duration_ms;

  const insights: AIAnalysis = {
    provider: 'webllm_local',
    isDemonstrationData: false,
    analyzedAtMs: Date.now(),
    executiveSummary: resp.insights.executive_summary,
    importantTopics: resp.insights.important_topics,
    keyConcepts,
    thingsToRemember: resp.insights.things_to_remember,
    actionItems,
    studyQuestions,
    sentiment,
    processingDurationMs: totalProcessingMs,
  };

  return { transcript, insights };
}
