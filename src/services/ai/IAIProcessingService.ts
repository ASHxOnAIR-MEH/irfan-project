import { AIAnalysis, TranscriptSegment } from '../../types/session';

export interface AIProcessingResult {
  transcript: TranscriptSegment[];
  insights: AIAnalysis;
}

export interface IAIProcessingService {
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean;

  /**
   * Transcribes raw audio and extracts structured insights
   */
  processAudio(audioBlob: Blob, metadata: { titleHint?: string; durationSeconds: number }): Promise<AIProcessingResult>;
}
