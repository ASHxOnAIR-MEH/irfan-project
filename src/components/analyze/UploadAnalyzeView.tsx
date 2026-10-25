/**
 * Ambient Memory Pendant — Upload & Analyze View
 *
 * Provides a progressive, step-by-step UI for:
 *   1. Select audio file
 *   2. Validate format / probe audio
 *   3. Upload to local AI backend (Faster-Whisper)
 *   4. Transcribe → summarize (Ollama)
 *   5. Save session & original audio to IndexedDB
 *   6. Distinct handling for successful transcription with failed summarization
 *   7. Retry summarization without re-uploading audio
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Mic,
  Brain,
  Save,
  RefreshCw,
  AlertTriangle,
  FileAudio,
  ChevronRight,
  Sparkles,
  Server,
  Cpu,
  Clock,
  ExternalLink,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { RecordingSession } from '../../types/session';
import { probeAudioFile, createImportedSession, AudioValidationError } from '../../services/audio/audioFileService';
import {
  checkBackendHealth,
  analyzeAudioFile,
  retrySummarization,
  mapBackendResponseToSession,
  mapRetryResponseToInsights,
  BackendApiError,
  HealthResponse,
} from '../../services/ai/backendApiService';
import { localDb } from '../../services/storage/indexedDb';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'idle'
  | 'checking_backend'
  | 'file_selected'
  | 'validating'
  | 'uploading'
  | 'transcribing'
  | 'summarizing'
  | 'saving'
  | 'completed'
  | 'summary_failed'
  | 'failed';

interface AnalyzeViewProps {
  onSessionReady: (session: RecordingSession) => void;
}

interface StepInfo {
  step: Step;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
  { step: 'validating',   label: 'Validating audio',    icon: <FileAudio size={16} /> },
  { step: 'uploading',    label: 'Uploading to backend', icon: <Upload size={16} /> },
  { step: 'transcribing', label: 'Transcribing speech',  icon: <Mic size={16} /> },
  { step: 'summarizing',  label: 'Generating insights',  icon: <Brain size={16} /> },
  { step: 'saving',       label: 'Saving session',       icon: <Save size={16} /> },
  { step: 'completed',    label: 'Complete',             icon: <CheckCircle2 size={16} /> },
];

const ACTIVE_STEPS = STEPS.map((s) => s.step);

function stepIndex(step: Step): number {
  return ACTIVE_STEPS.indexOf(step);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const UploadAnalyzeView: React.FC<AnalyzeViewProps> = ({ onSessionReady }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryErrorMessage, setRetryErrorMessage] = useState<string | null>(null);
  const [completedSession, setCompletedSession] = useState<RecordingSession | null>(null);
  const [savedTranscriptText, setSavedTranscriptText] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [timings, setTimings] = useState<{ transcription?: number; summarization?: number }>({});
  const [whisperModel, setWhisperModel] = useState<string>('');
  const [ollamaModel, setOllamaModel] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [charsProcessed, setCharsProcessed] = useState<number | null>(null);

  const isProcessing = ['checking_backend', 'validating', 'uploading', 'transcribing', 'summarizing', 'saving'].includes(step);

  // ── Check backend health ───────────────────────────────────────────────────
  const checkHealth = useCallback(async (): Promise<HealthResponse | null> => {
    setStep('checking_backend');
    try {
      const h = await checkBackendHealth();
      setHealth(h);
      return h;
    } catch (err) {
      const msg = err instanceof BackendApiError
        ? err.detail
        : 'Cannot reach the local AI backend.';
      setErrorMessage(msg);
      setStep('failed');
      return null;
    }
  }, []);

  // ── Handle file pick ───────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage(null);
    setRetryErrorMessage(null);
    setCompletedSession(null);
    setSavedTranscriptText(null);
    setSavedSessionId(null);
    setTimings({});
    setCharsProcessed(null);
    setUploadProgress(0);

    // Check backend before proceeding
    const h = await checkHealth();
    if (!h) return;

    setStep('file_selected');
  }, [checkHealth]);

  // ── Start full analysis pipeline ───────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    if (!selectedFile) return;

    abortRef.current = new AbortController();
    setErrorMessage(null);
    setRetryErrorMessage(null);
    setUploadProgress(0);

    try {
      // Step 1: Validate audio
      setStep('validating');
      let probe;
      try {
        probe = await probeAudioFile(selectedFile);
      } catch (err) {
        throw new Error(
          err instanceof AudioValidationError ? err.message : `Validation failed: ${err}`
        );
      }

      // Build a draft session so we have an ID ready
      const draftSession = createImportedSession(selectedFile, probe);
      setSavedSessionId(draftSession.id);

      // Step 2: Upload & transcribe
      setStep('uploading');
      let analysisResult;
      try {
        analysisResult = await analyzeAudioFile(
          selectedFile,
          draftSession.id,
          undefined,
          (progress) => {
            setUploadProgress(progress);
            if (progress >= 0.3) setStep('transcribing');
          },
          abortRef.current.signal
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setStep('idle');
          return;
        }
        throw err;
      }

      setSavedTranscriptText(analysisResult.full_text);
      setTimings({
        transcription: analysisResult.transcription_duration_ms,
        summarization: analysisResult.summarization_duration_ms,
      });
      setWhisperModel(analysisResult.whisper_model);
      setOllamaModel(analysisResult.ollama_model);
      setCharsProcessed(analysisResult.transcript_chars_processed);

      // Step 3: Map backend response → frontend session model
      setStep('summarizing');
      const { transcript, insights, summarizationFailed } = mapBackendResponseToSession(analysisResult);

      // Step 4: Merge into session and persist audio + transcript
      setStep('saving');
      const finalSession: RecordingSession = {
        ...draftSession,
        transcript,
        insights,
        // If summarization failed, mark status as awaiting_analysis so user knows summary is pending
        processingStatus: summarizationFailed ? 'awaiting_analysis' : 'completed',
      };

      await localDb.saveSessionWithAudio(finalSession, selectedFile);
      setCompletedSession(finalSession);

      // Separate success vs summary failure:
      // If transcription succeeded but summarization failed, transition to summary_failed state.
      if (summarizationFailed) {
        setStep('summary_failed');
      } else {
        setStep('completed');
        onSessionReady(finalSession);
      }

    } catch (err) {
      const msg = err instanceof BackendApiError
        ? err.detail
        : err instanceof Error
        ? err.message
        : 'An unexpected error occurred.';
      setErrorMessage(msg);
      setStep('failed');
    }
  }, [selectedFile, onSessionReady]);

  // ── Retry summarization only (uses saved transcript without re-uploading audio) ──
  const handleRetrySummarization = useCallback(async () => {
    if (!savedTranscriptText || !savedSessionId) return;
    setIsRetrying(true);
    setRetryErrorMessage(null);

    try {
      const retryResp = await retrySummarization(savedTranscriptText, savedSessionId);

      // Fetch existing session from DB to merge
      const existing = await localDb.getSession(savedSessionId);
      if (!existing) throw new Error('Session not found in local storage.');

      // Map retry response to insights
      const updatedInsights = mapRetryResponseToInsights(
        retryResp,
        timings.transcription || existing.insights?.processingDurationMs || 0
      );

      const updated: RecordingSession = {
        ...existing,
        insights: updatedInsights,
        processingStatus: 'completed',
      };

      await localDb.saveSession(updated);
      setCompletedSession(updated);
      setCharsProcessed(retryResp.transcript_chars_processed);
      setStep('completed');
      onSessionReady(updated);

    } catch (err) {
      const msg = err instanceof BackendApiError
        ? err.detail
        : err instanceof Error
        ? err.message
        : 'Retry failed.';
      setRetryErrorMessage(msg);
    } finally {
      setIsRetrying(false);
    }
  }, [savedTranscriptText, savedSessionId, timings.transcription, onSessionReady]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setStep('idle');
    setSelectedFile(null);
    setErrorMessage(null);
    setRetryErrorMessage(null);
    setUploadProgress(0);
  };

  const handleReset = () => {
    setStep('idle');
    setSelectedFile(null);
    setErrorMessage(null);
    setRetryErrorMessage(null);
    setCompletedSession(null);
    setSavedTranscriptText(null);
    setSavedSessionId(null);
    setUploadProgress(0);
    setTimings({});
    setCharsProcessed(null);
  };

  const currentStepIdx = stepIndex(step);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 780, margin: '0 auto' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.webm"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-forest), var(--accent-emerald))',
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(5,41,30,0.25)',
        }}>
          <Brain size={30} color="#ffffff" />
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8 }}>
          Local AI Audio Analysis
        </h2>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto' }}>
          Upload an audio file to transcribe it with Faster-Whisper and generate structured insights using Ollama — entirely on your local machine.
        </p>
      </div>

      {/* ── Backend Status Card ── */}
      {health && (
        <div className="white-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: health.ollama_reachable ? 'var(--accent-emerald)' : '#f59e0b',
              boxShadow: health.ollama_reachable ? '0 0 8px rgba(52,211,153,0.6)' : undefined,
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Backend Status</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cpu size={13} /> Whisper: <strong>{health.whisper_model}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={13} />
              Ollama: <strong>{health.ollama_model}</strong>
              {health.ollama_reachable
                ? <CheckCircle2 size={13} color="var(--accent-emerald)" />
                : <AlertTriangle size={13} color="#f59e0b" />}
            </span>
            {!health.ollama_reachable && (
              <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                Ollama offline: transcription will work, but summarization will be pending
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Drop / Select Area ── */}
      {step === 'idle' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) {
              const dt = new DataTransfer();
              dt.items.add(file);
              if (fileInputRef.current) {
                Object.defineProperty(fileInputRef.current, 'files', { value: dt.files, configurable: true });
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }}
          style={{
            border: '2.5px dashed var(--border-card)',
            borderRadius: 24,
            background: '#f8fdf9',
            padding: '56px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-emerald)';
            (e.currentTarget as HTMLDivElement).style.background = '#f0fdf7';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-card)';
            (e.currentTarget as HTMLDivElement).style.background = '#f8fdf9';
          }}
        >
          <Upload size={40} color="var(--accent-forest)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Drop audio file here or click to browse
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Supported formats: WAV · MP3 · M4A · AAC · OGG · OPUS · WEBM &nbsp;|&nbsp; Max 100 MB
          </p>
          <button className="btn btn-forest" style={{ padding: '10px 28px', fontSize: '0.9rem' }}>
            <Upload size={16} /> Choose Audio File
          </button>
        </div>
      )}

      {/* ── Checking Backend ── */}
      {step === 'checking_backend' && (
        <div className="white-card" style={{ padding: 36, textAlign: 'center' }}>
          <Loader2 size={32} color="var(--accent-emerald)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Connecting to local AI backend…</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8 }}>
            Make sure the backend server is running at <code style={{ fontFamily: 'monospace' }}>http://127.0.0.1:8787</code>
          </p>
        </div>
      )}

      {/* ── File Selected — Ready to Analyze ── */}
      {step === 'file_selected' && selectedFile && (
        <div className="white-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <FileAudio size={24} color="var(--accent-forest)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {formatBytes(selectedFile.size)} · {selectedFile.type || 'audio file'}
              </div>
            </div>
          </div>

          {health && !health.ollama_reachable && (
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: '#92400e',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 20,
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Ollama not detected.</strong> Transcription will succeed and save to your library, but AI insight generation will be marked pending. You can retry summarization later when Ollama is active.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={startAnalysis} className="btn btn-forest" style={{ padding: '10px 28px', fontSize: '0.9rem', flex: 1 }}>
              <Brain size={16} /> Start AI Analysis
            </button>
            <button onClick={handleReset} className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '0.9rem' }}>
              Change File
            </button>
          </div>
        </div>
      )}

      {/* ── Processing: Step Progress Bar ── */}
      {isProcessing && (
        <div className="white-card" style={{ padding: 28 }}>
          {/* Step trail */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, overflowX: 'auto' }}>
            {STEPS.map((s, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              return (
                <React.Fragment key={s.step}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 72 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: done
                        ? 'var(--accent-emerald)'
                        : active
                        ? 'var(--accent-forest)'
                        : '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: (done || active) ? '#fff' : '#9ca3af',
                      transition: 'all 0.3s ease',
                      boxShadow: active ? '0 0 0 4px rgba(5,41,30,0.15)' : undefined,
                    }}>
                      {done ? <CheckCircle2 size={16} /> : active ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : s.icon}
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--accent-forest)' : done ? 'var(--text-secondary)' : 'var(--text-muted)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{
                      flex: 1,
                      height: 2,
                      background: i < currentStepIdx ? 'var(--accent-emerald)' : '#e5e7eb',
                      transition: 'background 0.3s ease',
                      marginBottom: 22,
                      minWidth: 12,
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Upload progress bar */}
          {(step === 'uploading' || step === 'transcribing') && uploadProgress > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ height: 6, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(uploadProgress * 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent-forest), var(--accent-emerald))',
                  borderRadius: 99,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
                {Math.round(uploadProgress * 100)}%
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={16} color="var(--accent-emerald)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              {step === 'validating'   && 'Validating audio format and decoding…'}
              {step === 'uploading'    && 'Uploading audio to local backend…'}
              {step === 'transcribing' && 'Faster-Whisper is transcribing speech — this may take a moment…'}
              {step === 'summarizing'  && 'Ollama is generating structured insights…'}
              {step === 'saving'       && 'Saving session to IndexedDB…'}
            </div>
            <button onClick={handleCancel} className="btn btn-secondary" style={{ padding: '7px 16px', fontSize: '0.8rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Summary Failed / Partial Success (Transcription OK, Ollama Unavailable) ── */}
      {step === 'summary_failed' && completedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Banner: Distinct status indicators */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 20,
            padding: '26px 30px',
            color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 4 }}>
                  Transcription Complete · AI Summary Pending
                </h3>
                <p style={{ fontSize: '0.86rem', opacity: 0.85, lineHeight: 1.5 }}>
                  {completedSession.title}
                </p>
              </div>
            </div>

            {/* Separate Status Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
              {/* Transcription Status */}
              <div style={{
                background: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: 12,
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.84rem', color: '#34d399', marginBottom: 4 }}>
                  <CheckCircle2 size={15} /> Speech Transcription: Succeeded
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                  {timings.transcription !== undefined && `Duration: ${formatMs(timings.transcription)} · `}
                  {completedSession.transcript.length} segments ({savedTranscriptText ? savedTranscriptText.split(/\s+/).length : 0} words)
                </div>
              </div>

              {/* Summarization Status */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 12,
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.84rem', color: '#fbbf24', marginBottom: 4 }}>
                  <AlertCircle size={15} /> AI Summarization: Unavailable
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                  Ollama was not reachable or returned no valid summary.
                </div>
              </div>
            </div>
          </div>

          {/* Action Card: Safe Persistence & Retry Summarization */}
          <div className="white-card" style={{ padding: 24 }}>
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #bbf7d0',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 20,
              fontSize: '0.85rem',
              color: '#166534',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2, color: '#16a34a' }} />
              <div>
                <strong>Audio and transcript are safely saved.</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#15803d', lineHeight: 1.5 }}>
                  Both the raw audio file and the word-level transcript have been saved to local IndexedDB. You can retry AI summarization now or anytime later without re-uploading the audio file.
                </p>
              </div>
            </div>

            {/* Retry Error Alert if retry failed */}
            {retryErrorMessage && (
              <div style={{
                background: '#fff1f2',
                border: '1.5px solid #fecdd3',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#9f1239',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 18,
              }}>
                <XCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{retryErrorMessage}</span>
              </div>
            )}

            {/* Transcript Preview */}
            {completedSession.transcript.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  <FileText size={15} color="var(--accent-forest)" /> Transcribed Text Preview
                </div>
                <div style={{
                  background: '#f8fdf9',
                  border: '1.5px solid var(--border-card)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  maxHeight: 160,
                  overflowY: 'auto',
                }}>
                  {savedTranscriptText || completedSession.transcript.map((s) => s.text).join(' ')}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleRetrySummarization}
                disabled={isRetrying}
                className="btn btn-forest"
                style={{ padding: '10px 24px', fontSize: '0.88rem', flex: 1, minWidth: 200 }}
              >
                {isRetrying ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Generating AI Summary with Ollama…
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Retry Summarization (Using Saved Transcript)
                  </>
                )}
              </button>
              <button
                onClick={() => onSessionReady(completedSession)}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', fontSize: '0.88rem' }}
              >
                <ExternalLink size={15} /> Open Session in Library
              </button>
              <button
                onClick={handleReset}
                className="btn btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.88rem' }}
              >
                <Upload size={14} /> Analyze Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fully Completed (Both Transcription and Real AI Summary Succeeded) ── */}
      {step === 'completed' && completedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Success Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #05291e, #0a3d2b)',
            borderRadius: 20,
            padding: '28px 32px',
            color: '#fff',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(52,211,153,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CheckCircle2 size={28} color="#34d399" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 6 }}>
                AI Analysis Complete
              </h3>
              <p style={{ fontSize: '0.84rem', opacity: 0.8, marginBottom: 16, lineHeight: 1.5 }}>
                {completedSession.title}
              </p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.78rem', opacity: 0.75 }}>
                {timings.transcription !== undefined && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Cpu size={13} /> Transcription: {formatMs(timings.transcription)}
                  </span>
                )}
                {timings.summarization !== undefined && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Brain size={13} /> Summarization: {formatMs(timings.summarization)}
                  </span>
                )}
                {whisperModel && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Server size={13} /> Whisper {whisperModel} · Ollama {ollamaModel}
                  </span>
                )}
                {charsProcessed !== null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FileText size={13} /> {charsProcessed.toLocaleString()} characters analyzed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Result Summary */}
          <div className="white-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="var(--accent-emerald)" />
                AI Summary (Ollama {ollamaModel})
              </h4>
              <span className="badge badge-emerald" style={{ fontSize: '0.72rem' }}>
                Genuine Local LLM
              </span>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              {completedSession.insights.executiveSummary}
            </p>

            {completedSession.insights.importantTopics.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {completedSession.insights.importantTopics.map((topic, i) => (
                  <span key={i} className="badge badge-emerald" style={{ fontSize: '0.74rem', textTransform: 'none' }}>
                    {topic}
                  </span>
                ))}
              </div>
            )}

            {completedSession.insights.actionItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Action Items
                </div>
                {completedSession.insights.actionItems.slice(0, 3).map((ai) => (
                  <div key={ai.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <ChevronRight size={14} color="var(--accent-emerald)" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{ai.description}</span>
                  </div>
                ))}
              </div>
            )}

            {completedSession.transcript.length > 0 && (
              <div style={{
                background: '#f8fdf9',
                border: '1.5px solid var(--border-card)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 16,
                fontStyle: 'italic',
              }}>
                <strong style={{ fontStyle: 'normal', color: 'var(--text-primary)' }}>Transcript preview:</strong>{' '}
                {completedSession.transcript.slice(0, 3).map((s) => s.text).join(' ')}
                {completedSession.transcript.length > 3 && <span style={{ opacity: 0.6 }}> …</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => onSessionReady(completedSession)}
                className="btn btn-forest"
                style={{ padding: '9px 22px', fontSize: '0.86rem', flex: 1 }}
              >
                <ExternalLink size={15} /> Open Full Session
              </button>
              <button onClick={handleReset} className="btn btn-secondary" style={{ padding: '9px 18px', fontSize: '0.86rem' }}>
                <Upload size={14} /> Analyze Another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Failed ── */}
      {step === 'failed' && (
        <div style={{
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          borderRadius: 20,
          padding: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <XCircle size={24} color="#e11d48" style={{ flexShrink: 0 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#9f1239' }}>Analysis Failed</h4>
          </div>
          <p style={{ fontSize: '0.86rem', color: '#7f1d1d', lineHeight: 1.6, marginBottom: 20 }}>
            {errorMessage}
          </p>

          {/* Show retry summarization option if transcription succeeded before failure */}
          {savedTranscriptText && (
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Transcript was saved — retry summarization only
              </div>
              <p style={{ fontSize: '0.78rem', color: '#78350f', marginBottom: 12, lineHeight: 1.5 }}>
                The audio was transcribed successfully. You can retry the Ollama summarization step once Ollama is running.
              </p>
              <button
                onClick={handleRetrySummarization}
                disabled={isRetrying}
                className="btn btn-forest"
                style={{ padding: '8px 20px', fontSize: '0.82rem' }}
              >
                {isRetrying
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Retrying…</>
                  : <><RefreshCw size={14} /> Retry Summarization</>}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {selectedFile && step === 'failed' && (
              <button onClick={startAnalysis} className="btn btn-secondary" style={{ padding: '9px 20px', fontSize: '0.84rem' }}>
                <RefreshCw size={14} /> Retry Full Analysis
              </button>
            )}
            <button onClick={handleReset} className="btn btn-secondary" style={{ padding: '9px 18px', fontSize: '0.84rem' }}>
              Start Over
            </button>
          </div>

          {/* Setup hint when backend is unreachable */}
          {errorMessage?.includes('backend') && (
            <div style={{ marginTop: 20, fontSize: '0.78rem', color: '#7f1d1d', lineHeight: 1.6 }}>
              <strong>Quick setup:</strong>
              <ol style={{ paddingLeft: 20, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>In a terminal: <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>cd backend && pip install -r requirements.txt</code></li>
                <li>Start: <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>python -m uvicorn main:app --host 127.0.0.1 --port 8787</code></li>
                <li>Install Ollama from <strong>ollama.com</strong>, then: <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>ollama pull llama3.2</code></li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── Info Cards ── */}
      {(step === 'idle' || step === 'file_selected') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { icon: <Cpu size={20} />, title: 'CPU-Only', desc: 'No GPU required. Runs on any modern laptop.' },
            { icon: <Server size={20} />, title: 'Fully Local', desc: 'No cloud. No telemetry. Audio never leaves your machine.' },
            { icon: <RefreshCw size={20} />, title: 'Retry Support', desc: 'If summarization fails, retry without re-uploading audio.' },
          ].map((card) => (
            <div key={card.title} className="white-card" style={{ padding: '18px 20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--accent-forest)', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                {card.icon}
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{card.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
