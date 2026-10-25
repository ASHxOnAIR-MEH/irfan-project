"""
Ambient Memory Pendant — Local AI Backend
FastAPI service providing speech-to-text (Faster-Whisper) and
structured insight generation (Ollama) for uploaded audio files.

Endpoints:
  GET  /health                   — liveness + capability check
  POST /api/analyze-audio        — upload audio, transcribe, summarize
  POST /api/retry-summarization  — re-summarize from saved transcript text

Requirements: See requirements.txt
First run will download the Whisper model (~150 MB for 'base', CPU-friendly).
Ollama must be running at http://localhost:11434 with a model pulled,
e.g.:  ollama pull llama3.2

Start with:
  python -m uvicorn main:app --host 127.0.0.1 --port 8787 --reload
"""

from __future__ import annotations

import json
import logging
import math
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("pendant_backend")

# ─── Config ───────────────────────────────────────────────────────────────────
WHISPER_MODEL_SIZE  = os.environ.get("WHISPER_MODEL",   "base")    # tiny|base|small
WHISPER_DEVICE      = os.environ.get("WHISPER_DEVICE",  "cpu")     # cpu (no GPU needed)
WHISPER_COMPUTE     = os.environ.get("WHISPER_COMPUTE", "int8")    # int8 = fastest on CPU
OLLAMA_BASE_URL     = os.environ.get("OLLAMA_URL",      "http://localhost:11434")
OLLAMA_MODEL        = os.environ.get("OLLAMA_MODEL",    "llama3.2")
MAX_AUDIO_MB        = int(os.environ.get("MAX_AUDIO_MB",  "100"))
# Maximum characters per chunk sent to the LLM. Keeping at 6 000 gives ~1 500 tokens
# of breathing room before typical 8K-context models truncate further.
CHUNK_CHAR_LIMIT    = int(os.environ.get("CHUNK_CHAR_LIMIT", "6000"))
ALLOWED_ORIGINS_ENV = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS     = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
] + [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]

# ─── PyAV compatibility shim for PyAV >= 14 ──────────────────────────────────
try:
    import av
    _orig_av_open = av.open

    def _safe_av_open(*args: Any, **kwargs: Any) -> Any:
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)

    av.open = _safe_av_open
except Exception:
    pass

# ─── Lazy Whisper model loading ────────────────────────────────────────────────
_whisper_model: Any = None


def get_whisper() -> Any:
    global _whisper_model
    if _whisper_model is None:
        log.info(
            f"Loading Faster-Whisper model '{WHISPER_MODEL_SIZE}' "
            f"on {WHISPER_DEVICE}/{WHISPER_COMPUTE} …"
        )
        from faster_whisper import WhisperModel  # type: ignore
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE,
        )
        log.info("Whisper model loaded and ready.")
    return _whisper_model


# ─── Pydantic schemas ──────────────────────────────────────────────────────────

class TranscriptWord(BaseModel):
    word: str
    start_ms: int
    end_ms: int
    confidence: float | None = None


class TranscriptSegment(BaseModel):
    id: str
    start_ms: int
    end_ms: int
    text: str
    words: list[TranscriptWord] = Field(default_factory=list)


class KeyConcept(BaseModel):
    term: str
    explanation: str


class ActionItem(BaseModel):
    id: str
    description: str
    completed: bool = False
    due_suggestion: str | None = None
    source_timestamp_ms: int | None = None


class StudyQuestion(BaseModel):
    id: str
    question: str
    answer_summary: str


class AIInsights(BaseModel):
    executive_summary: str
    important_topics: list[str]
    key_concepts: list[KeyConcept]
    things_to_remember: list[str]
    action_items: list[ActionItem]
    study_questions: list[StudyQuestion]
    sentiment: str = "neutral"


SummarizationProvider = Literal["ollama_local", "transcript_fallback"]


class AnalyzeAudioResponse(BaseModel):
    session_id: str
    transcript_segments: list[TranscriptSegment]
    full_text: str
    language: str
    # ── Summarization status ──────────────────────────────────────────────────
    # summarization_provider distinguishes a genuine Ollama result from a
    # transcript-only fallback.  The frontend must use this to label output.
    #   "ollama_local"        – Ollama ran and returned a parseable JSON response
    #   "transcript_fallback" – Ollama was unavailable or returned unparseable
    #                           output; the insights are NOT an LLM summary
    summarization_provider: SummarizationProvider
    summarization_succeeded: bool
    # If the transcript was longer than CHUNK_CHAR_LIMIT chars and chunked
    # summarization was used, this reports how many characters were actually
    # processed.  Equals len(full_text) when no truncation occurred.
    transcript_chars_processed: int
    insights: AIInsights
    transcription_duration_ms: int
    summarization_duration_ms: int
    whisper_model: str
    ollama_model: str


class HealthResponse(BaseModel):
    status: str
    whisper_model: str
    ollama_url: str
    ollama_model: str
    ollama_reachable: bool
    ollama_model_available: bool
    available_ollama_models: list[str]
    chunk_char_limit: int


# ─── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ambient Memory Pendant — Local AI Backend",
    description="Speech-to-text and insight generation for locally recorded audio.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    ollama_reachable = False
    ollama_model_available = False
    available_models: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if r.status_code == 200:
                ollama_reachable = True
                data = r.json()
                available_models = [m.get("name", "") for m in data.get("models", [])]
                ollama_model_available = any(
                    m.startswith(OLLAMA_MODEL) for m in available_models
                )
    except Exception as exc:
        log.warning(f"Ollama health check failed: {exc}")

    return HealthResponse(
        status="ok",
        whisper_model=WHISPER_MODEL_SIZE,
        ollama_url=OLLAMA_BASE_URL,
        ollama_model=OLLAMA_MODEL,
        ollama_reachable=ollama_reachable,
        ollama_model_available=ollama_model_available,
        available_ollama_models=available_models,
        chunk_char_limit=CHUNK_CHAR_LIMIT,
    )


# ─── Audio validation constants ────────────────────────────────────────────────
ALLOWED_AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3",
    "audio/aac", "audio/x-aac",
    "audio/mp4", "audio/x-m4a",
    "audio/ogg", "audio/opus",
    "audio/webm",
    "application/octet-stream",   # generic fallback (e.g. .wav without content-type)
}
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".aac", ".m4a", ".ogg", ".opus", ".webm"}
MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024


# ─── Audio analysis endpoint ───────────────────────────────────────────────────
@app.post("/api/analyze-audio", response_model=AnalyzeAudioResponse)
async def analyze_audio(
    request: Request,
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    language: str | None = Form(default=None),
) -> AnalyzeAudioResponse:
    # ── 1. Reject oversized uploads using Content-Length before reading body ──
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            cl = int(content_length)
            if cl > MAX_AUDIO_BYTES + 1024 * 512:    # 512 KB form-field overhead
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"Request body too large ({cl / (1024**2):.1f} MB). "
                        f"Maximum audio size is {MAX_AUDIO_MB} MB."
                    ),
                )
        except ValueError:
            pass   # non-integer Content-Length header — will validate after read

    # ── 2. Extension + MIME type check ────────────────────────────────────────
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS and file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported audio format '{file.content_type}' / extension '{ext}'. "
                f"Supported: WAV, MP3, M4A, AAC, OGG, OPUS, WEBM."
            ),
        )

    # ── 3. Read body and enforce byte limit ───────────────────────────────────
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty (0 bytes).")
    size_mb = len(raw) / (1024 * 1024)
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum is {MAX_AUDIO_MB} MB.",
        )

    sid = session_id or f"backend_{uuid.uuid4().hex[:8]}"

    # ── 4. Write to temp file — deleted in finally block ─────────────────────
    suffix = ext if ext else ".wav"
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(tmp_fd, raw)
        os.close(tmp_fd)
        raw = b""   # free memory now; we have the temp file

        # ── Step A: Transcription via Faster-Whisper ──────────────────────────
        log.info(f"[{sid}] Transcribing {size_mb:.2f} MB audio via Faster-Whisper …")
        t0 = time.perf_counter()
        model = get_whisper()

        transcribe_kwargs: dict[str, Any] = {"beam_size": 5, "word_timestamps": True}
        if language:
            transcribe_kwargs["language"] = language

        segments_iter, info = model.transcribe(tmp_path, **transcribe_kwargs)

        transcript_segments: list[TranscriptSegment] = []
        full_text_parts: list[str] = []

        for i, seg in enumerate(segments_iter):
            words: list[TranscriptWord] = []
            if seg.words:
                for w in seg.words:
                    words.append(TranscriptWord(
                        word=w.word,
                        start_ms=int(w.start * 1000),
                        end_ms=int(w.end * 1000),
                        confidence=round(float(w.probability), 4) if w.probability is not None else None,
                    ))
            seg_text = seg.text.strip()
            full_text_parts.append(seg_text)
            transcript_segments.append(TranscriptSegment(
                id=f"seg_{i:04d}",
                start_ms=int(seg.start * 1000),
                end_ms=int(seg.end * 1000),
                text=seg_text,
                words=words,
            ))

        full_text = " ".join(full_text_parts)
        detected_lang = info.language or (language or "unknown")
        transcription_ms = int((time.perf_counter() - t0) * 1000)
        log.info(
            f"[{sid}] Transcription done in {transcription_ms} ms — "
            f"language: {detected_lang}, {len(transcript_segments)} segments, "
            f"{len(full_text)} chars."
        )

        # ── Step B: AI Insight Generation via Ollama ──────────────────────────
        log.info(f"[{sid}] Generating insights via Ollama ({OLLAMA_MODEL}) …")
        t1 = time.perf_counter()

        insights, summarization_provider, chars_processed = await _run_ollama_summarization(
            full_text, sid
        )

        summarization_ms = int((time.perf_counter() - t1) * 1000)
        summarization_succeeded = summarization_provider == "ollama_local"
        log.info(
            f"[{sid}] Summarization done in {summarization_ms} ms — "
            f"provider: {summarization_provider}, chars processed: {chars_processed}."
        )

        return AnalyzeAudioResponse(
            session_id=sid,
            transcript_segments=transcript_segments,
            full_text=full_text,
            language=detected_lang,
            summarization_provider=summarization_provider,
            summarization_succeeded=summarization_succeeded,
            transcript_chars_processed=chars_processed,
            insights=insights,
            transcription_duration_ms=transcription_ms,
            summarization_duration_ms=summarization_ms,
            whisper_model=WHISPER_MODEL_SIZE,
            ollama_model=OLLAMA_MODEL,
        )

    finally:
        # Always clean up the temp file, regardless of success or failure.
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── Retry summarization endpoint ─────────────────────────────────────────────

class RetrySummarizationRequest(BaseModel):
    full_text: str
    session_id: str | None = None


class RetrySummarizationResponse(BaseModel):
    insights: AIInsights
    summarization_provider: SummarizationProvider
    summarization_succeeded: bool
    transcript_chars_processed: int


@app.post("/api/retry-summarization", response_model=RetrySummarizationResponse)
async def retry_summarization(req: RetrySummarizationRequest) -> RetrySummarizationResponse:
    """Re-run only the summarization step without re-uploading audio."""
    if not req.full_text.strip():
        raise HTTPException(status_code=400, detail="full_text is empty.")

    sid = req.session_id or "retry"
    log.info(f"[{sid}] Retry summarization requested ({len(req.full_text)} chars).")

    insights, provider, chars_processed = await _run_ollama_summarization(req.full_text, sid)

    if provider != "ollama_local":
        # Don't silently return a fallback — the caller can decide what to do.
        raise HTTPException(
            status_code=503,
            detail=(
                "Ollama is not reachable or returned an unparseable response. "
                f"Make sure Ollama is running at {OLLAMA_BASE_URL} and that "
                f"model '{OLLAMA_MODEL}' is available (ollama pull {OLLAMA_MODEL})."
            ),
        )

    return RetrySummarizationResponse(
        insights=insights,
        summarization_provider=provider,
        summarization_succeeded=True,
        transcript_chars_processed=chars_processed,
    )


# ─── Chunked Ollama summarization helper ──────────────────────────────────────

async def _run_ollama_summarization(
    full_text: str, sid: str
) -> tuple[AIInsights, SummarizationProvider, int]:
    """
    Sends the transcript to Ollama in chunks if it exceeds CHUNK_CHAR_LIMIT.

    For short transcripts  (≤ CHUNK_CHAR_LIMIT chars):
        One-shot prompt → structured JSON.

    For longer transcripts (> CHUNK_CHAR_LIMIT chars):
        1. Split into chunks; summarize each into bullet points.
        2. Combine bullet summaries into a single final structured prompt.

    Returns (AIInsights, provider_string, chars_actually_processed).
    chars_actually_processed == len(full_text) when no truncation occurred.
    """
    if not full_text.strip():
        return _fallback_insights(""), "transcript_fallback", 0

    total_chars = len(full_text)

    try:
        if total_chars <= CHUNK_CHAR_LIMIT:
            # ── Single-chunk path ─────────────────────────────────────────────
            result = await _ollama_structured_summary(full_text)
            if result is None:
                return _fallback_insights(full_text), "transcript_fallback", total_chars
            return result, "ollama_local", total_chars

        else:
            # ── Multi-chunk path ──────────────────────────────────────────────
            n_chunks = math.ceil(total_chars / CHUNK_CHAR_LIMIT)
            log.info(
                f"[{sid}] Transcript is {total_chars} chars — splitting into "
                f"{n_chunks} chunk(s) of ≤ {CHUNK_CHAR_LIMIT} chars each."
            )
            chunk_summaries: list[str] = []
            for i in range(n_chunks):
                chunk = full_text[i * CHUNK_CHAR_LIMIT:(i + 1) * CHUNK_CHAR_LIMIT]
                summary = await _ollama_chunk_summary(chunk, i + 1, n_chunks)
                if summary:
                    chunk_summaries.append(summary)
                else:
                    # If any chunk fails, fall back on the whole text
                    log.warning(f"[{sid}] Chunk {i + 1}/{n_chunks} summarization failed.")
                    return _fallback_insights(full_text), "transcript_fallback", total_chars

            combined = "\n\n".join(chunk_summaries)
            result = await _ollama_structured_summary(combined)
            if result is None:
                return _fallback_insights(full_text), "transcript_fallback", total_chars
            return result, "ollama_local", total_chars

    except httpx.ConnectError:
        log.warning(f"[{sid}] Ollama not reachable at {OLLAMA_BASE_URL}.")
        return _fallback_insights(full_text), "transcript_fallback", total_chars
    except Exception as exc:
        log.warning(f"[{sid}] Unexpected Ollama error: {exc}")
        return _fallback_insights(full_text), "transcript_fallback", total_chars


async def _ollama_chunk_summary(chunk: str, chunk_num: int, total_chunks: int) -> str | None:
    """Summarise one chunk into concise bullet points."""
    prompt = (
        f"You are summarizing part {chunk_num} of {total_chunks} of a spoken audio transcript.\n"
        "Extract the key points as concise bullet points (plain text, no JSON, no markdown headers).\n\n"
        f"TRANSCRIPT SEGMENT:\n\"\"\"\n{chunk}\n\"\"\""
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 800},
                },
            )
            if resp.status_code == 200:
                return resp.json().get("response", "").strip() or None
    except Exception:
        pass
    return None


async def _ollama_structured_summary(text: str) -> AIInsights | None:
    """Send text to Ollama and parse the response into AIInsights."""
    prompt = (
        "You are an expert assistant that analyzes spoken audio transcripts.\n"
        "Return ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:\n"
        "{\n"
        '  "executive_summary": "<2-4 sentence summary of the main content>",\n'
        '  "important_topics": ["<topic1>", "<topic2>"],\n'
        '  "key_concepts": [{"term": "<concept>", "explanation": "<brief explanation>"}],\n'
        '  "things_to_remember": ["<item1>", "<item2>"],\n'
        '  "action_items": [\n'
        '    {"id": "action_001", "description": "<task>", "completed": false,\n'
        '     "due_suggestion": "<optional>", "source_timestamp_ms": null}\n'
        "  ],\n"
        '  "study_questions": [\n'
        '    {"id": "q_001", "question": "<question>", "answer_summary": "<answer>"}\n'
        "  ],\n"
        '  "sentiment": "<reflective|action_oriented|analytical|neutral|urgent>"\n'
        "}\n\n"
        "Rules:\n"
        "- Respond ONLY with the JSON object. No code fences, no preamble.\n"
        "- important_topics: max 6 items.\n"
        "- things_to_remember: max 5 items.\n"
        "- If no action items exist, return an empty array.\n"
        "- If no study questions exist, return an empty array.\n\n"
        f'TRANSCRIPT:\n"""\n{text}\n"""'
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.2, "num_predict": 1500},
                },
            )
            if resp.status_code == 200:
                raw_json = resp.json().get("response", "")
                return _parse_ollama_json(raw_json)
    except Exception:
        pass
    return None


# ─── JSON parser ───────────────────────────────────────────────────────────────

def _parse_ollama_json(raw: str) -> AIInsights | None:
    """Attempt to parse Ollama's response string into an AIInsights object."""
    raw = raw.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        raw = raw.rsplit("```", 1)[0].strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end == 0:
            return None
        try:
            data = json.loads(raw[start:end])
        except json.JSONDecodeError:
            return None

    try:
        key_concepts = [
            KeyConcept(term=kc.get("term", ""), explanation=kc.get("explanation", ""))
            for kc in data.get("key_concepts", [])
        ]
        action_items = [
            ActionItem(
                id=ai_item.get("id", f"action_{i:03d}"),
                description=ai_item.get("description", ""),
                completed=bool(ai_item.get("completed", False)),
                due_suggestion=ai_item.get("due_suggestion"),
                source_timestamp_ms=ai_item.get("source_timestamp_ms"),
            )
            for i, ai_item in enumerate(data.get("action_items", []))
        ]
        study_questions = [
            StudyQuestion(
                id=sq.get("id", f"q_{i:03d}"),
                question=sq.get("question", ""),
                answer_summary=sq.get("answer_summary", ""),
            )
            for i, sq in enumerate(data.get("study_questions", []))
        ]
        return AIInsights(
            executive_summary=data.get("executive_summary", ""),
            important_topics=data.get("important_topics", [])[:6],
            key_concepts=key_concepts,
            things_to_remember=data.get("things_to_remember", [])[:5],
            action_items=action_items,
            study_questions=study_questions,
            sentiment=data.get("sentiment", "neutral"),
        )
    except Exception as exc:
        log.warning(f"Failed to map Ollama response to AIInsights schema: {exc}")
        return None


# ─── Fallback insights ─────────────────────────────────────────────────────────

def _fallback_insights(full_text: str) -> AIInsights:
    """
    Minimal insight object derived directly from transcript without any LLM.

    IMPORTANT: The executive_summary here must NOT be presented to the user
    as an AI-generated summary.  The response includes summarization_provider
    = "transcript_fallback" so the frontend can distinguish this case.
    """
    word_count = len(full_text.split()) if full_text.strip() else 0
    return AIInsights(
        executive_summary=(
            f"Transcription completed ({word_count} words). "
            "Ollama was unavailable so no AI summary was generated. "
            "Start Ollama and use Retry Summarization to generate insights."
        ),
        important_topics=[],
        key_concepts=[],
        things_to_remember=[],
        action_items=[],
        study_questions=[],
        sentiment="neutral",
    )
