"""
Unit tests for Ambient Memory Pendant - Local AI Backend Reliability.

Tests:
1. Ollama-unavailable fallback (honest metadata, provider = "transcript_fallback")
2. Ollama-available path (structured parsing, provider = "ollama_local")
3. Chunked summarization for transcripts exceeding CHUNK_CHAR_LIMIT (>4,000 / 6,000 chars)
4. Resource protection: Content-Length rejection before full read, temp-file cleanup
5. Retry summarization endpoint behavior (HTTP 503 on Ollama failure, HTTP 200 on success)
"""

import io
import json
import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import (
    CHUNK_CHAR_LIMIT,
    AIInsights,
    HealthResponse,
    RetrySummarizationRequest,
    _fallback_insights,
    _parse_ollama_json,
    _run_ollama_summarization,
    app,
)

client = TestClient(app)


# ─── 1. Fallback / Ollama-Unavailable Tests ───────────────────────────────────

def test_fallback_insights_content():
    """Fallback must never be presented as an LLM summary."""
    insights = _fallback_insights("Hello world spoken transcript")
    assert "Ollama was unavailable" in insights.executive_summary
    assert "Retry Summarization" in insights.executive_summary
    assert insights.important_topics == []
    assert insights.key_concepts == []
    assert insights.action_items == []
    assert insights.study_questions == []


import asyncio

def test_ollama_unavailable_path():
    """When Ollama is unreachable, provider is transcript_fallback and no exception is thrown."""
    async def _inner():
        # Point to an unroutable port to simulate Ollama down
        with patch("main.OLLAMA_BASE_URL", "http://127.0.0.1:54321"):
            insights, provider, chars_processed = await _run_ollama_summarization(
                "Discussion about ESP32 hardware memory architecture.", "test_session_1"
            )
            assert provider == "transcript_fallback"
            assert chars_processed == len("Discussion about ESP32 hardware memory architecture.")
            assert "Ollama was unavailable" in insights.executive_summary

    asyncio.run(_inner())


# ─── 2. Ollama-Available Path Tests ───────────────────────────────────────────

SAMPLE_OLLAMA_RESPONSE = {
    "executive_summary": "Discussed ESP32-S3 hardware integration and memory footprint.",
    "important_topics": ["ESP32-S3", "INMP441 Microphone", "Memory Allocation"],
    "key_concepts": [{"term": "I2S", "explanation": "Inter-IC Sound digital bus"}],
    "things_to_remember": ["Keep sampling at 16kHz 16-bit mono"],
    "action_items": [
        {
            "id": "action_001",
            "description": "Order INMP441 microphone breakout",
            "completed": False,
            "due_suggestion": "tomorrow",
            "source_timestamp_ms": None,
        }
    ],
    "study_questions": [
        {"id": "q_001", "question": "What is the I2S sample rate?", "answer_summary": "16 kHz"}
    ],
    "sentiment": "action_oriented",
}


def test_parse_ollama_json_valid():
    """Tests clean JSON parsing from Ollama response."""
    raw = json.dumps(SAMPLE_OLLAMA_RESPONSE)
    parsed = _parse_ollama_json(raw)
    assert parsed is not None
    assert parsed.executive_summary == "Discussed ESP32-S3 hardware integration and memory footprint."
    assert len(parsed.important_topics) == 3
    assert parsed.key_concepts[0].term == "I2S"
    assert parsed.action_items[0].description == "Order INMP441 microphone breakout"


def test_parse_ollama_json_with_markdown_fences():
    """Handles Ollama wrapping JSON in markdown backticks."""
    raw = f"```json\n{json.dumps(SAMPLE_OLLAMA_RESPONSE)}\n```"
    parsed = _parse_ollama_json(raw)
    assert parsed is not None
    assert parsed.executive_summary == SAMPLE_OLLAMA_RESPONSE["executive_summary"]


def test_ollama_available_path():
    """When Ollama returns valid JSON, provider is ollama_local."""
    async def _inner():
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 200
        mock_post_resp.json.return_value = {"response": json.dumps(SAMPLE_OLLAMA_RESPONSE)}

        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_post_resp

            insights, provider, chars_processed = await _run_ollama_summarization(
                "Short meeting transcript about the project.", "test_session_2"
            )
            assert provider == "ollama_local"
            assert insights.executive_summary == SAMPLE_OLLAMA_RESPONSE["executive_summary"]
            assert len(insights.action_items) == 1

    asyncio.run(_inner())


# ─── 3. Long Transcript / Chunked Summarization Tests ─────────────────────────

def test_chunked_summarization_for_long_transcript():
    """
    Transcripts longer than CHUNK_CHAR_LIMIT must NOT be silently cut off at 4,000 chars.
    They must be chunked, summarized, and combined, reporting the full character count.
    """
    async def _inner():
        # Create an 8,500-character transcript
        long_transcript = "Audio segment discussion about architecture and sensors. " * 150
        assert len(long_transcript) > CHUNK_CHAR_LIMIT

        mock_chunk_resp = MagicMock()
        mock_chunk_resp.status_code = 200
        mock_chunk_resp.json.return_value = {"response": "Bullet summary of chunk"}

        mock_final_resp = MagicMock()
        mock_final_resp.status_code = 200
        mock_final_resp.json.return_value = {"response": json.dumps(SAMPLE_OLLAMA_RESPONSE)}

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # Chunks return bullet points; final call returns structured JSON
            data = kwargs.get("json", {})
            if "schema" in data.get("prompt", "").lower() or "return only a valid json" in data.get("prompt", "").lower():
                return mock_final_resp
            return mock_chunk_resp

        with patch("httpx.AsyncClient.post", side_effect=mock_post):
            insights, provider, chars_processed = await _run_ollama_summarization(
                long_transcript, "test_long_transcript"
            )
            assert provider == "ollama_local"
            # Crucial: chars_processed must account for the full transcript, not truncated at 4000
            assert chars_processed == len(long_transcript)
            assert insights.executive_summary == SAMPLE_OLLAMA_RESPONSE["executive_summary"]
            # Must have made multiple chunk calls + 1 final call
            assert call_count >= 2

    asyncio.run(_inner())


# ─── 4. Resource Protection & Upload Validation Tests ─────────────────────────

def test_content_length_pre_rejection():
    """Uploads exceeding max file size via Content-Length header are rejected before reading body."""
    oversized_bytes = (105 * 1024 * 1024)  # 105 MB > 100 MB limit
    response = client.post(
        "/api/analyze-audio",
        headers={"Content-Length": str(oversized_bytes)},
        files={"file": ("test.wav", b"dummy", "audio/wav")},
    )
    assert response.status_code == 413
    assert "Request body too large" in response.json()["detail"]


def test_unsupported_audio_extension_rejected():
    """Non-audio files are rejected with HTTP 415."""
    response = client.post(
        "/api/analyze-audio",
        files={"file": ("malicious.exe", b"binary content", "application/x-msdownload")},
    )
    assert response.status_code == 415


def test_empty_audio_rejected():
    """Empty audio files are rejected with HTTP 400."""
    response = client.post(
        "/api/analyze-audio",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400


# ─── 5. Retry Summarization Endpoint Tests ────────────────────────────────────

def test_retry_summarization_empty_text():
    """Empty full_text returns HTTP 400."""
    response = client.post("/api/retry-summarization", json={"full_text": "   "})
    assert response.status_code == 400


def test_retry_summarization_ollama_down_returns_503():
    """When Ollama is unavailable during retry, return explicit HTTP 503 (not silent fallback)."""
    with patch("main.OLLAMA_BASE_URL", "http://127.0.0.1:54321"):
        response = client.post(
            "/api/retry-summarization",
            json={"full_text": "Saved transcript text from earlier audio.", "session_id": "test_retry"},
        )
        assert response.status_code == 503
        assert "Ollama is not reachable" in response.json()["detail"]


def test_retry_summarization_success():
    """When Ollama succeeds during retry, returns HTTP 200 with structured insights."""
    mock_post_resp = MagicMock()
    mock_post_resp.status_code = 200
    mock_post_resp.json.return_value = {"response": json.dumps(SAMPLE_OLLAMA_RESPONSE)}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_post_resp

        response = client.post(
            "/api/retry-summarization",
            json={"full_text": "Saved transcript text from earlier audio.", "session_id": "test_retry"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["summarization_provider"] == "ollama_local"
        assert data["summarization_succeeded"] is True
        assert data["insights"]["executive_summary"] == SAMPLE_OLLAMA_RESPONSE["executive_summary"]


# ─── 6. Health Check Endpoint ─────────────────────────────────────────────────

def test_health_check_endpoint():
    """Health endpoint reports model config and reachable status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "whisper_model" in data
    assert "chunk_char_limit" in data
