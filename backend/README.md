# Ambient Memory Pendant — Local AI Backend

## Overview

A FastAPI micro-service running **locally on your machine** that provides:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Check if Whisper model loaded and Ollama is reachable |
| `POST /api/analyze-audio` | Upload audio → transcribe → summarize → return JSON |
| `POST /api/retry-summarization` | Re-run summarization from saved transcript text (no re-upload) |

All processing is **100% local** — no cloud APIs, no telemetry, no data leaves your machine.

---

## Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| RAM | 4 GB | 8 GB+ |
| CPU | Any modern x64 | 4+ cores |
| GPU | **Not required** | Optional (CUDA for speed) |
| Disk (models) | ~150 MB (tiny) | ~500 MB (base) |

---

## First-Time Setup

### 1. Create a Python virtual environment

```bash
cd backend
python -m venv venv
```

**Windows:**
```powershell
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note:** On first start, `faster-whisper` will automatically download the
> Whisper model to `~/.cache/huggingface/hub/`.
> - `tiny` model: ~75 MB, fastest, less accurate
> - `base` model: ~145 MB (default), good accuracy, still CPU-fast
> - `small` model: ~480 MB, best accuracy for CPU

### 3. Install and start Ollama

Download from [https://ollama.com](https://ollama.com), then:

```bash
ollama serve          # keep running in background
ollama pull llama3.2  # downloads ~2 GB model (one time)
```

Verify Ollama is running:
```bash
curl http://localhost:11434/api/tags
```

---

## Running the Backend

```bash
cd backend
# Activate venv first (see above)
python -m uvicorn main:app --host 127.0.0.1 --port 8787 --reload
```

Backend will be available at: **http://127.0.0.1:8787**

### Environment Variables (optional overrides)

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL` | `base` | Model size: `tiny`, `base`, `small`, `medium` |
| `WHISPER_DEVICE` | `cpu` | `cpu` or `cuda` |
| `WHISPER_COMPUTE` | `int8` | `int8`, `float16`, `float32` |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Any Ollama model name |
| `MAX_AUDIO_MB` | `100` | Max upload size in megabytes |

Example:
```bash
WHISPER_MODEL=small OLLAMA_MODEL=mistral python -m uvicorn main:app --port 8787
```

---

## API Reference

### `GET /health`
```json
{
  "status": "ok",
  "whisper_model": "base",
  "ollama_url": "http://localhost:11434",
  "ollama_model": "llama3.2",
  "ollama_reachable": true,
  "ollama_model_available": true,
  "available_ollama_models": ["llama3.2:latest"]
}
```

### `POST /api/analyze-audio`

**Form data:**
- `file` (required) — Audio file (WAV, MP3, M4A, AAC, OGG, OPUS, WEBM)
- `session_id` (optional) — Your session ID to attach results to
- `language` (optional) — Language hint, e.g. `"en"`, `"ar"` (auto-detected if omitted)

**Response:**
```json
{
  "session_id": "session_import_...",
  "transcript_segments": [...],
  "full_text": "Hello world this is my recording...",
  "language": "en",
  "insights": {
    "executive_summary": "...",
    "important_topics": ["..."],
    "key_concepts": [{"term": "...", "explanation": "..."}],
    "things_to_remember": ["..."],
    "action_items": [{"id": "action_001", "description": "...", "completed": false}],
    "study_questions": [{"id": "q_001", "question": "...", "answer_summary": "..."}],
    "sentiment": "neutral"
  },
  "transcription_duration_ms": 3200,
  "summarization_duration_ms": 12500,
  "whisper_model": "base",
  "ollama_model": "llama3.2"
}
```

### `POST /api/retry-summarization`

Re-runs only the summarization step. Useful if transcription succeeded but Ollama was unavailable.

**Request body (JSON):**
```json
{
  "full_text": "Your transcript text here...",
  "session_id": "session_import_..."
}
```

---

## Graceful Degradation

- If **Ollama is not running**, transcription still completes and a minimal transcript-based summary is returned (no crash).
- If **Whisper fails** to decode the audio, a descriptive HTTP 500 error is returned.
- If **summarization fails** mid-session, the frontend preserves the transcript and shows a retry button.

---

## Interactive API Docs

With the backend running, visit:
- Swagger UI: http://127.0.0.1:8787/docs
- ReDoc: http://127.0.0.1:8787/redoc
