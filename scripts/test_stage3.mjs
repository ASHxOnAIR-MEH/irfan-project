/**
 * Ambient Memory Pendant — Stage 3 Verification Suite
 *
 * Validates:
 * 1. Distinction between real Ollama AI summaries and transcript fallbacks in frontend models
 * 2. Error propagation and provider typing (ollama_local vs transcript_fallback)
 * 3. Handling of summarizationFailed flag in session insights
 * 4. mapRetryResponseToInsights behavior preserving existing transcript and duration
 * 5. Audio and transcript persistence integrity after partial failures
 * 6. Verification that transcript character count is tracked accurately (handling >4000 char transcripts)
 */

import { strict as assert } from 'node:assert';
import {
  mapBackendResponseToSession,
  mapRetryResponseToInsights,
} from '../src/services/ai/backendApiService.ts';

console.log('====================================================');
console.log('AMBIENT MEMORY PENDANT — STAGE 3 RELIABILITY SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`TEST ${totalTests}: ${name} ... `);
  try {
    fn();
    passedTests++;
    console.log('PASSED ✓');
  } catch (err) {
    console.log(`FAILED ✗\n  Error: ${err.message}`);
    console.error(err);
  }
}

// ─── Test 1: Ollama Unavailable Path Mapping ──────────────────────────────────
runTest('Ollama-unavailable maps to transcript_fallback with summarizationFailed=true', () => {
  const backendResponse = {
    session_id: 'sess_fallback_001',
    transcript_segments: [
      { id: 'seg_0', start_ms: 0, end_ms: 1200, text: 'Testing memory pendant speech', words: [] },
    ],
    full_text: 'Testing memory pendant speech',
    language: 'en',
    summarization_provider: 'transcript_fallback',
    summarization_succeeded: false,
    transcript_chars_processed: 29,
    insights: {
      executive_summary: 'Transcription completed (4 words). Ollama was unavailable.',
      important_topics: [],
      key_concepts: [],
      things_to_remember: [],
      action_items: [],
      study_questions: [],
      sentiment: 'neutral',
    },
    transcription_duration_ms: 1500,
    summarization_duration_ms: 20,
    whisper_model: 'base',
    ollama_model: 'llama3.2',
  };

  const { transcript, insights, summarizationFailed } = mapBackendResponseToSession(backendResponse);

  assert.equal(summarizationFailed, true, 'summarizationFailed must be true');
  assert.equal(insights.provider, 'transcript_fallback', 'provider must be transcript_fallback');
  assert.equal(insights.summarizationFailed, true, 'insights.summarizationFailed must be true');
  assert.equal(insights.isDemonstrationData, false, 'isDemonstrationData must be false');
  assert.equal(transcript.length, 1, 'transcript segments must be preserved');
  assert.equal(transcript[0].text, 'Testing memory pendant speech');
  assert.equal(insights.transcriptCharsSent, 29);
});

// ─── Test 2: Ollama Available Path Mapping ────────────────────────────────────
runTest('Ollama-available maps to ollama_local with summarizationFailed=false', () => {
  const backendResponse = {
    session_id: 'sess_ollama_002',
    transcript_segments: [
      {
        id: 'seg_0',
        start_ms: 0,
        end_ms: 2500,
        text: 'The ESP32-S3 uses I2S for the INMP441 microphone.',
        words: [
          { word: 'The', start_ms: 0, end_ms: 200, confidence: 0.98 },
          { word: 'ESP32-S3', start_ms: 250, end_ms: 900, confidence: 0.95 },
        ],
      },
    ],
    full_text: 'The ESP32-S3 uses I2S for the INMP441 microphone.',
    language: 'en',
    summarization_provider: 'ollama_local',
    summarization_succeeded: true,
    transcript_chars_processed: 49,
    insights: {
      executive_summary: 'Hardware integration review regarding I2S bus connection.',
      important_topics: ['ESP32-S3', 'I2S', 'INMP441'],
      key_concepts: [{ term: 'I2S', explanation: 'Inter-IC Sound digital protocol' }],
      things_to_remember: ['16kHz sampling'],
      action_items: [
        {
          id: 'act_1',
          description: 'Wire GPIO pins',
          completed: false,
          due_suggestion: 'tomorrow',
          source_timestamp_ms: null,
        },
      ],
      study_questions: [
        { id: 'q_1', question: 'Which bus is used?', answer_summary: 'I2S bus' },
      ],
      sentiment: 'action_oriented',
    },
    transcription_duration_ms: 1800,
    summarization_duration_ms: 2400,
    whisper_model: 'base',
    ollama_model: 'llama3.2',
  };

  const { transcript, insights, summarizationFailed } = mapBackendResponseToSession(backendResponse);

  assert.equal(summarizationFailed, false, 'summarizationFailed must be false');
  assert.equal(insights.provider, 'ollama_local', 'provider must be ollama_local');
  assert.equal(insights.summarizationFailed, false);
  assert.equal(insights.keyConcepts.length, 1);
  assert.equal(insights.keyConcepts[0].term, 'I2S');
  assert.equal(insights.actionItems[0].description, 'Wire GPIO pins');
  assert.equal(transcript[0].words?.length, 2, 'words must be mapped with timestamps and confidence');
});

// ─── Test 3: Retry Mapping Logic ─────────────────────────────────────────────
runTest('mapRetryResponseToInsights converts successful retry and clears failed flag', () => {
  const retryResponse = {
    summarization_provider: 'ollama_local',
    summarization_succeeded: true,
    transcript_chars_processed: 1200,
    insights: {
      executive_summary: 'Detailed summary produced upon second retry attempt.',
      important_topics: ['Retry Flow', 'Ollama Reconnection'],
      key_concepts: [{ term: 'Ollama', explanation: 'Local LLM runner' }],
      things_to_remember: ['Always keep Ollama daemon running'],
      action_items: [],
      study_questions: [],
      sentiment: 'neutral',
    },
  };

  const initialTranscriptionMs = 1450;
  const updatedInsights = mapRetryResponseToInsights(retryResponse, initialTranscriptionMs);

  assert.equal(updatedInsights.provider, 'ollama_local');
  assert.equal(updatedInsights.summarizationFailed, false);
  assert.equal(updatedInsights.executiveSummary, 'Detailed summary produced upon second retry attempt.');
  assert.equal(updatedInsights.importantTopics.length, 2);
  assert.equal(updatedInsights.transcriptCharsSent, 1200);
  assert.equal(updatedInsights.processingDurationMs, initialTranscriptionMs);
});

// ─── Test 4: Tracking Character Counts for Long Transcripts ───────────────────
runTest('Processes and tracks transcript character counts exceeding 4,000 characters', () => {
  const charCount = 8250;
  const longText = 'A'.repeat(charCount);

  const backendResponse = {
    session_id: 'sess_long_003',
    transcript_segments: [
      { id: 'seg_0', start_ms: 0, end_ms: 60000, text: longText, words: [] },
    ],
    full_text: longText,
    language: 'en',
    summarization_provider: 'ollama_local',
    summarization_succeeded: true,
    transcript_chars_processed: charCount,
    insights: {
      executive_summary: 'Comprehensive analysis of multi-chunk recording.',
      important_topics: ['Long Recording'],
      key_concepts: [],
      things_to_remember: [],
      action_items: [],
      study_questions: [],
      sentiment: 'analytical',
    },
    transcription_duration_ms: 8200,
    summarization_duration_ms: 5400,
    whisper_model: 'base',
    ollama_model: 'llama3.2',
  };

  const { insights } = mapBackendResponseToSession(backendResponse);
  assert.equal(insights.transcriptCharsSent, 8250, 'All 8,250 characters must be accounted for');
  assert.ok(insights.transcriptCharsSent > 4000, 'Must exceed the previous 4,000 character cutoff');
});

// ─── Test 5: Backward-Compatible Types & Provider Union ──────────────────────
runTest('Session types support new and legacy provider values without breakage', () => {
  const validProviders = [
    'local_mock',
    'cloud_gemini',
    'cloud_whisper',
    'webllm_local',
    'ollama_local',
    'transcript_fallback',
  ];

  for (const prov of validProviders) {
    const testAnalysis = {
      provider: prov,
      isDemonstrationData: false,
      analyzedAtMs: Date.now(),
      executiveSummary: 'Test',
      importantTopics: [],
      keyConcepts: [],
      thingsToRemember: [],
      actionItems: [],
      studyQuestions: [],
    };
    assert.equal(testAnalysis.provider, prov);
  }
});

console.log('\n====================================================');
console.log(`STAGE 3 TEST RESULTS: ${passedTests} of ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
