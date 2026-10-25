"""
Ambient Memory Pendant — Local AI Backend
FastAPI service providing speech-to-text (Faster-Whisper) and
structured insight generation (Ollama) for uploaded audio files.

Endpoints:
  GET  /health              — liveness + capability check
  POST /api/analyze-audio   — upload audio, transcribe, summarize

Requirements: See requirements.txt
First run will download the Whisper model (~500 MB for 'base', CPU-friendly).
Ollama must be running at http://localhost:11434 with a model pulled,
e.g.:  ollama pull llama3.2

Start with:
  python -m uvicorn main:app --host 127.0.0.1 --port 8787 --reload
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("pendant_backend")

# ─── Config ───────────────────────────────────────────────────────────────────
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")   # tiny|base|small
WHISPER_DEVICE     = os.environ.get("WHISPER_DEVICE", "cpu")    # cpu (no GPU needed)
WHISPER_COMPUTE    = os.environ.get("WHISPER_COMPUTE", "int8")  # int8 = fastest on CPU
OLLAMA_BASE_URL    = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL       = os.environ.get("OLLAMA_MODEL", "llama3.2")
MAX_AUDIO_MB       = int(os.environ.get("MAX_AUDIO_MB", "100"))
ALLOWED_ORIGINS    = ["http://localhost:5173", "http://127.0.0.1:5173",
                       "http://localhost:4173", "http://127.0.0.1:4173"]

# ─── Lazy Whisper model loading ────────────────────────────────────────────────
_whisper_model: Any = None

def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        log.info(f"Loading Faster-Whisper model '{WHISPER_MODEL_SIZE}' on {WHISPER_DEVICE}/{WHISPER_COMPUTE} …")
        from faster_whisper import WhisperModel  # type: ignore
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE,
        )
        log.info("Whisper model loaded and ready.")
    return _whisper_model

# ─── Pydantic response schemas ─────────────────────────────────────────────────
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

class AnalyzeAudioResponse(BaseModel):
    session_id: str
    transcript_segments: list[TranscriptSegment]
    full_text: str
    language: str
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

# ─── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ambient Memory Pendant — Local AI Backend",
    description="Speech-to-text and insight generation for locally recorded audio.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health_check():
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
    )

# ─── Audio analysis endpoint ───────────────────────────────────────────────────
ALLOWED_AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3",
    "audio/aac", "audio/x-aac",
    "audio/mp4", "audio/x-m4a",
    "audio/ogg", "audio/opus",
    "audio/webm",
    "application/octet-stream",  # generic fallback for .wav etc.
}
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".aac", ".m4a", ".ogg", ".opus", ".webm"}


@app.post("/api/analyze-audio", response_model=AnalyzeAudioResponse)
async def analyze_audio(
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    language: str | None = Form(default=None),  # hint e.g. "en"
):
    # ── Validate ──────────────────────────────────────────────────────────────
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS and file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type '{file.content_type}' / extension '{ext}'. "
                   f"Supported: WAV, MP3, M4A, AAC, OGG, OPUS, WEBM.",
        )

    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_AUDIO_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Maximum is {MAX_AUDIO_MB} MB.",
        )
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    sid = session_id or f"backend_{uuid.uuid4().hex[:8]}"

    # ── Write to temp file ────────────────────────────────────────────────────
    suffix = ext if ext else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        # ── Step 1: Transcription via Faster-Whisper ──────────────────────────
        log.info(f"[{sid}] Transcribing {size_mb:.2f} MB audio…")
        t0 = time.perf_counter()
        model = get_whisper()

        transcribe_kwargs: dict[str, Any] = {
            "beam_size": 5,
            "word_timestamps": True,
        }
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
        log.info(f"[{sid}] Transcription done in {transcription_ms} ms — language: {detected_lang}, {len(transcript_segments)} segments.")

        # ── Step 2: AI Insight Generation via Ollama ──────────────────────────
        log.info(f"[{sid}] Generating insights via Ollama ({OLLAMA_MODEL})…")
        t1 = time.perf_counter()

        # Strict JSON schema prompt — Ollama must return pure JSON
        INSIGHT_PROMPT = f"""You are an expert assistant that analyzes spoken audio transcripts and produces structured summaries.

Given this transcript, return ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:
{{
  "executive_summary": "<2-4 sentence summary of the main content>",
  "important_topics": ["<topic1>", "<topic2>", "..."],
  "key_concepts": [
    {{"term": "<concept>", "explanation": "<brief explanation>"}}
  ],
  "things_to_remember": ["<item1>", "<item2>", "..."],
  "action_items": [
    {{
      "id": "action_001",
      "description": "<task>",
      "completed": false,
      "due_suggestion": "<optional date or timeframe>",
      "source_timestamp_ms": <ms from start or null>
    }}
  ],
  "study_questions": [
    {{
      "id": "q_001",
      "question": "<question>",
      "answer_summary": "<concise answer from the transcript>"
    }}
  ],
  "sentiment": "<one of: reflective | action_oriented | analytical | neutral | urgent>"
}}

Rules:
- Respond ONLY with the JSON object. No markdown code blocks, no preamble, no explanation.
- If no action items exist, return an empty array.
- If no study questions exist, return an empty array.
- Limit important_topics to 6 items maximum.
- Limit things_to_remember to 5 items maximum.

TRANSCRIPT:
\"\"\"
{full_text[:4000]}
\"\"\"
"""

        insights = _fallback_insights(full_text)  # safe default if Ollama fails

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": INSIGHT_PROMPT,
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.2, "num_predict": 1500},
                    },
                )
                if resp.status_code == 200:
                    ollama_data = resp.json()
                    raw_json = ollama_data.get("response", "")
                    parsed = _parse_ollama_json(raw_json)
                    if parsed:
                        insights = parsed
                        log.info(f"[{sid}] Ollama insights parsed successfully.")
                    else:
                        log.warning(f"[{sid}] Could not parse Ollama JSON response — using fallback insights.")
                else:
                    log.warning(f"[{sid}] Ollama returned {resp.status_code} — using fallback insights.")
        except httpx.ConnectError:
            log.warning(f"[{sid}] Ollama not reachable — using transcript-based fallback insights.")
        except Exception as exc:
            log.warning(f"[{sid}] Ollama error ({exc}) — using fallback insights.")

        summarization_ms = int((time.perf_counter() - t1) * 1000)
        log.info(f"[{sid}] Summarization done in {summarization_ms} ms.")

        return AnalyzeAudioResponse(
            session_id=sid,
            transcript_segments=transcript_segments,
            full_text=full_text,
            language=detected_lang,
            insights=insights,
            transcription_duration_ms=transcription_ms,
            summarization_duration_ms=summarization_ms,
            whisper_model=WHISPER_MODEL_SIZE,
            ollama_model=OLLAMA_MODEL,
        )

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── Retry summarization endpoint ─────────────────────────────────────────────
class RetrySummarizationRequest(BaseModel):
    full_text: str
    session_id: str | None = None

@app.post("/api/retry-summarization", response_model=AIInsights)
async def retry_summarization(req: RetrySummarizationRequest):
    """Re-run only the summarization step without re-uploading audio."""
    if not req.full_text.strip():
        raise HTTPException(status_code=400, detail="full_text is empty.")

    sid = req.session_id or "retry"
    log.info(f"[{sid}] Retry summarization requested ({len(req.full_text)} chars).")

    INSIGHT_PROMPT = f"""You are an expert assistant that analyzes spoken audio transcripts and produces structured summaries.

Given this transcript, return ONLY a valid JSON object matching this exact schema:
{{
  "executive_summary": "<2-4 sentence summary>",
  "important_topics": ["<topic1>", ...],
  "key_concepts": [{{"term": "<concept>", "explanation": "<brief explanation>"}}],
  "things_to_remember": ["<item1>", ...],
  "action_items": [{{"id": "action_001", "description": "<task>", "completed": false, "due_suggestion": null, "source_timestamp_ms": null}}],
  "study_questions": [{{"id": "q_001", "question": "<question>", "answer_summary": "<answer>"}}],
  "sentiment": "neutral"
}}

TRANSCRIPT:
\"\"\"
{req.full_text[:4000]}
\"\"\"
"""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": INSIGHT_PROMPT,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.2, "num_predict": 1500},
                },
            )
            if resp.status_code == 200:
                parsed = _parse_ollama_json(resp.json().get("response", ""))
                if parsed:
                    return parsed
            raise HTTPException(status_code=502, detail=f"Ollama returned status {resp.status_code}.")
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Ollama is not running at " + OLLAMA_BASE_URL)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Summarization error: {exc}")


# ─── Helpers ───────────────────────────────────────────────────────────────────
def _parse_ollama_json(raw: str) -> AIInsights | None:
    """Attempt to parse Ollama's JSON response into AIInsights."""
    raw = raw.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Try to find the JSON object in the response
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
                id=ai.get("id", f"action_{i:03d}"),
                description=ai.get("description", ""),
                completed=bool(ai.get("completed", False)),
                due_suggestion=ai.get("due_suggestion"),
                source_timestamp_ms=ai.get("source_timestamp_ms"),
            )
            for i, ai in enumerate(data.get("action_items", []))
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


def _fallback_insights(full_text: str) -> AIInsights:
    """Minimal insight object derived directly from transcript (no LLM)."""
    words = full_text.split()
    snippet = " ".join(words[:40]) + ("…" if len(words) > 40 else "")
    return AIInsights(
        executive_summary=f"Transcript recorded successfully. {snippet}",
        important_topics=["transcribed-audio"],
        key_concepts=[],
        things_to_remember=[f"Audio transcribed: {len(words)} words detected."],
        action_items=[],
        study_questions=[],
        sentiment="neutral",
    )
