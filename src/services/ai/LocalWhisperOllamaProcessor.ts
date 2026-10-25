/**
 * Ambient Memory Pendant - Local Whisper & Ollama Real Engine Bridge
 * Connects to user's local PC Whisper / Ollama instance (e.g., http://localhost:11434)
 * Strictly local-first: Never sends audio or transcripts outside localhost.
 * Never claims a session has processed if the local daemon is offline.
 */

import { AIProcessingResult, IAIProcessingService } from './IAIProcessingService';

export interface LocalAIEndpoints {
  ollamaUrl?: string; // Default http://localhost:11434
  whisperUrl?: string; // Default http://localhost:8080/v1/audio/transcriptions
}

export class LocalWhisperOllamaProcessor implements IAIProcessingService {
  public readonly id = 'local_ollama_whisper';
  public readonly name = 'Local PC Daemon (Faster-Whisper + Ollama)';
  public readonly isLocal = true;

  private ollamaUrl: string;
  private whisperUrl: string;

  constructor(endpoints?: LocalAIEndpoints) {
    this.ollamaUrl = endpoints?.ollamaUrl || 'http://localhost:11434';
    this.whisperUrl = endpoints?.whisperUrl || 'http://localhost:8080/v1/audio/transcriptions';
  }

  /**
   * Health check to test if local Ollama or Whisper daemon is running
   */
  public async checkHealth(): Promise<{ ollamaAvailable: boolean; whisperAvailable: boolean }> {
    let ollamaAvailable = false;
    let whisperAvailable = false;

    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      ollamaAvailable = res.ok;
    } catch {
      ollamaAvailable = false;
    }

    try {
      const res = await fetch(this.whisperUrl, { method: 'GET', signal: AbortSignal.timeout(1500) });
      whisperAvailable = res.status < 500;
    } catch {
      whisperAvailable = false;
    }

    return { ollamaAvailable, whisperAvailable };
  }

  public async processAudio(
    audioBlob: Blob,
    metadata: { titleHint?: string; durationSeconds: number }
  ): Promise<AIProcessingResult> {
    const health = await this.checkHealth();

    if (!health.whisperAvailable && !health.ollamaAvailable) {
      throw new Error(
        `Local AI Daemon is unreachable at ${this.ollamaUrl} and ${this.whisperUrl}. ` +
        `Ensure Ollama ('ollama serve') or your local Whisper server is running on your machine.`
      );
    }

    // Attempt transcription via local Whisper API
    if (!health.whisperAvailable) {
      throw new Error(
        `Local Whisper speech-to-text server is not responding at ${this.whisperUrl}. ` +
        `Please launch a local Whisper HTTP server or switch to the Offline Demonstrator.`
      );
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-1');

    const whisperRes = await fetch(this.whisperUrl, {
      method: 'POST',
      body: formData,
    });

    if (!whisperRes.ok) {
      throw new Error(`Local Whisper transcription failed: HTTP ${whisperRes.status}`);
    }

    const whisperJson = await whisperRes.json();
    const rawText = whisperJson.text || '';

    // If Ollama is available, synthesize structured memory insights
    if (!health.ollamaAvailable) {
      // Return raw transcript with honest fallback message
      return {
        transcript: [
          {
            id: 'seg_1',
            speakerLabel: 'Speaker',
            startMs: 0,
            endMs: Math.round(metadata.durationSeconds * 1000),
            text: rawText,
          },
        ],
        insights: {
          provider: 'local_mock',
          isDemonstrationData: false,
          analyzedAtMs: Date.now(),
          executiveSummary: rawText.slice(0, 300) + '...',
          thingsToRemember: ['Transcription completed via local Faster-Whisper daemon.'],
          keyConcepts: [],
          actionItems: [],
          studyQuestions: [],
          importantTopics: ['voice-memo', 'local-audio'],
          sentiment: 'reflective',
        },
      };
    }

    // Call Ollama for extraction
    const prompt = `Analyze this spoken memory transcript: "${rawText}". Respond in JSON with keys: executiveSummary, thingsToRemember (array of strings), actionItems (array of {description, priority: 'urgent'|'normal'}), importantTopics (array of strings).`;

    const ollamaRes = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!ollamaRes.ok) {
      throw new Error(`Local Ollama synthesis failed: HTTP ${ollamaRes.status}`);
    }

    const ollamaJson = await ollamaRes.json();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(ollamaJson.response || '{}');
    } catch {
      parsed = {};
    }

    return {
      transcript: [
        {
          id: 'seg_1',
          speakerLabel: 'Speaker',
          startMs: 0,
          endMs: Math.round(metadata.durationSeconds * 1000),
          text: rawText,
        },
      ],
      insights: {
        provider: 'local_mock',
        isDemonstrationData: false,
        analyzedAtMs: Date.now(),
        executiveSummary: (parsed.executiveSummary as string) || rawText.slice(0, 200),
        thingsToRemember: Array.isArray(parsed.thingsToRemember) ? (parsed.thingsToRemember as string[]) : ['Processed locally with Ollama'],
        keyConcepts: [],
        actionItems: Array.isArray(parsed.actionItems)
          ? (parsed.actionItems as { description?: string; title?: string }[]).map((act, i) => ({
              id: `act_local_${i}`,
              description: act.description || act.title || 'Follow up on discussion item',
              completed: false,
            }))
          : [],
        studyQuestions: [],
        importantTopics: Array.isArray(parsed.importantTopics)
          ? (parsed.importantTopics as string[])
          : ['local-ollama'],
        sentiment: 'reflective',
      },
    };
  }
}
