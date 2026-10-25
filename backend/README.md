# Ambient Memory Pendant — Local AI Backend

## Overview

A high-performance FastAPI micro-service running **entirely on your local machine** that provides:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health & capability check (Whisper model status, Ollama reachability, model availability) |
| `POST /api/analyze-audio` | Audio upload → speech transcription (Faster-Whisper) → structured summary (Ollama) |
| `POST /api/retry-summarization` | Re-run summarization from saved transcript text without re-uploading audio |

All speech processing and language model inference are **100% local** — no cloud APIs, no telemetry, and audio never leaves your machine.

---

## Windows PowerShell Quick-Start Guide

### 1. Install & Configure Ollama

1. Download and run the official Windows installer from:
   **[https://ollama.com/download/windows](https://ollama.com/download/windows)**
2. Open Windows PowerShell and verify the installation:
   ```powershell
   ollama --version
   # Example output: ollama version is 0.40.11
   ```
3. Pull the required `llama3.2` model (~2.0 GB):
   ```powershell
   ollama pull llama3.2
   ```
4. Verify the model is downloaded and listed:
   ```powershell
   ollama list
   # Output should show: llama3.2:latest
   ```
5. Test prompt execution in terminal:
   ```powershell
   ollama run llama3.2 "Say hello"
   ```

---

### 2. Set Up the Python Virtual Environment (`.venv`)

Open a new PowerShell terminal at the repository root:

```powershell
cd backend

# Create the virtual environment using .venv (matches project standard)
python -m venv .venv

# Activate the virtual environment in PowerShell
.\.venv\Scripts\Activate.ps1
```

> **Tip:** If PowerShell displays an `ExecutionPolicy` error when activating the script, allow local script execution in your session:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> .\.venv\Scripts\Activate.ps1
> ```

---

### 3. Install Python Dependencies

With `(.venv)` active:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

> **Note on Audio Decoding (PyAV):** The backend includes an automatic compatibility shim for `PyAV >= 14`, ensuring Faster-Whisper decodes WAV, MP3, M4A, AAC, OGG, and WebM audio without keyword argument exceptions.

---

### 4. Start the Backend Server

Start the FastAPI application with auto-reload:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8787 --reload
```

The backend server will bind to: **http://127.0.0.1:8787**

---

### 5. Verify Backend Health

In another terminal or browser tab, query the health endpoint:

```powershell
curl.exe -s http://127.0.0.1:8787/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "whisper_model": "base",
  "ollama_url": "http://localhost:11434",
  "ollama_model": "llama3.2",
  "ollama_reachable": true,
  "ollama_model_available": true,
  "available_ollama_models": ["llama3.2:latest"],
  "chunk_char_limit": 6000
}
```

---

### 6. Start the Frontend Application

In a separate terminal at the project root:

```powershell
npm run dev
```

Open the displayed Vite URL: **http://localhost:5173**

---

## Audio-Analysis Workflow

1. **Navigate to AI Analyze**: Click the **AI Analyze** tab in the top navigation.
2. **Backend Status Card**: Confirm that Faster-Whisper (`base`) and Ollama (`llama3.2`) display green status indicators.
3. **Upload Audio**: Select or drop an audio file (WAV, MP3, M4A, AAC, OGG, OPUS, or WEBM; up to 100 MB).
4. **Analysis Pipeline**:
   - Audio format and sample rate are validated in the browser.
   - File is streamed to `http://127.0.0.1:8787/api/analyze-audio`.
   - Faster-Whisper transcribes speech with word-level timestamps and confidence scores.
   - Ollama synthesizes the transcript into an executive summary, discussion topics, key concepts, and action items.
   - The session, transcript segments, and raw audio are committed to local IndexedDB.
5. **Partial Failure & Retry Support**:
   - If Ollama is offline or unparseable, transcription still succeeds and is saved safely to IndexedDB.
   - The UI displays an explicit status: "Transcription Complete · AI Summary Pending".
   - Clicking **Retry Summarization** sends the saved transcript to `/api/retry-summarization` without re-uploading the audio file.

---

## Long Recording Summarization (> 4,000 / 6,000 Characters)

Earlier versions truncated transcripts at 4,000 characters. The backend now employs chunked summarization:
- Transcripts $\le 6,000$ characters are analyzed in a single structured prompt.
- Transcripts $> 6,000$ characters are chunked into sections of $\le 6,000$ characters, summarized into intermediate key points, and synthesized into the final structured schema.
- The `transcript_chars_processed` field reports the exact character count processed to the frontend.

---

## Running Backend Reliability Tests

With `(.venv)` active inside the `backend` folder:

```powershell
python -m pytest -q test_reliability.py
```

This runs the 13-point test suite covering:
- Ollama-unavailable fallback handling (`transcript_fallback` provider)
- Ollama-available structured JSON parsing (`ollama_local` provider)
- Multi-chunk summarization for long transcripts
- `Content-Length` header rejection for oversized files before body read
- Rejection of unsupported extensions and empty files
- HTTP 503 error propagation on retry failure
- HTTP 200 on retry success

---

## Troubleshooting Guide

### 1. Ollama Not Reachable (`ollama_reachable: false`)
- Verify the Ollama service is running in Windows:
  ```powershell
  Get-Process -Name ollama -ErrorAction SilentlyContinue
  ```
- If not running, start it from the Start Menu or run `ollama serve`.
- Ensure it responds at `http://localhost:11434/api/tags`.

### 2. Missing Ollama Model (`ollama_model_available: false`)
- Run:
  ```powershell
  ollama list
  ```
- If `llama3.2:latest` is missing, download it:
  ```powershell
  ollama pull llama3.2
  ```

### 3. Python Virtual Environment Activation Error
- In PowerShell, run:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\.venv\Scripts\Activate.ps1
  ```

### 4. Upload Size or Timeout Limits
- Upload limit is configurable via the `MAX_AUDIO_MB` environment variable (default: `100`).
- Model and chunk settings can be customized:
  ```powershell
  $env:WHISPER_MODEL="base"
  $env:OLLAMA_MODEL="llama3.2"
  $env:CHUNK_CHAR_LIMIT="6000"
  python -m uvicorn main:app --host 127.0.0.1 --port 8787 --reload
  ```

---

## Interactive API Documentation

When the backend server is running:
- **Interactive Swagger UI**: [http://127.0.0.1:8787/docs](http://127.0.0.1:8787/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8787/redoc](http://127.0.0.1:8787/redoc)
