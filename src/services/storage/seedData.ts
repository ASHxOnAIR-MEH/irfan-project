/**
 * Ambient Memory Pendant - Initial Database Seeding
 * Seeds rich demonstration data with playable synthesized audio, transcripts, and action items.
 */

import { RecordingSession } from '../../types/session';
import { AudioSynthesizer } from '../audio/audioSynthesizer';
import { localDb } from './indexedDb';

export async function ensureDemoDataSeeded(): Promise<void> {
  const existing = await localDb.getAllSessions();
  if (existing.length > 0) return; // Already seeded or user has sessions

  const durationSec = 22;
  const audioBlob = await AudioSynthesizer.generateSpokenAudioBlob(durationSec, 'wearable_design');
  const sessionId = 'REC_DEMO_LOCAL_001';

  await localDb.saveAudioBlob(sessionId, audioBlob);

  const demoSession: RecordingSession = {
    id: sessionId,
    title: 'Wearable Architecture & Acoustic Pickup Ergonomics',
    capturedAtMs: Date.now() - 7200000, // 2 hours ago
    pendantDeviceId: 'ESP32S3-MINI-8F42',
    metadata: {
      format: 'wav',
      sampleRateHz: 16000,
      channels: 1,
      bitDepth: 16,
      durationSeconds: durationSec,
      fileSizeBytes: audioBlob.size,
      checksumSha256: '9f83a4b2c1d0e8f7',
      filename: 'REC_DEMO_LOCAL_001.WAV',
    },
    transcript: [
      {
        id: 'seg_1',
        speakerLabel: 'Design Lead',
        startMs: 0,
        endMs: 4500,
        text: 'The key requirement for the memory pendant is unobtrusiveness. It should comfortably rest on a necklace or magnetic lapel without pulling on clothing.',
      },
      {
        id: 'seg_2',
        speakerLabel: 'Acoustic Engineer',
        startMs: 4800,
        endMs: 9500,
        text: 'From an audio perspective, we must place the microphone opening facing slightly upward toward the chin to capture near-field speech while rejecting wind.',
      },
      {
        id: 'seg_3',
        speakerLabel: 'Firmware Dev',
        startMs: 10000,
        endMs: 15200,
        text: 'Because we are writing to the SPI microSD card, we need double-buffering in ESP32-S3 DMA memory so SD write latencies do not drop audio frames.',
      },
      {
        id: 'seg_4',
        speakerLabel: 'Design Lead',
        startMs: 15500,
        endMs: 22000,
        text: 'Agreed. And on the software side, the PWA must allow users to review transcripts, check off action items, and listen back with instant scrubbing.',
      },
    ],
    insights: {
      provider: 'local_mock',
      isDemonstrationData: true,
      analyzedAtMs: Date.now() - 7100000,
      executiveSummary:
        'Ergonomic and acoustic design review for the wearable memory pendant. The discussion prioritizes upward-facing microphone placement, double-buffered DMA writing to prevent microSD frame drops, and an interactive PWA interface with scrubbable transcripts and action item tracking.',
      importantTopics: ['Wearable Ergonomics', 'Acoustic Directionality', 'DMA Double-Buffering', 'Local-First PWA'],
      keyConcepts: [
        {
          term: 'DMA Double-Buffering',
          explanation: 'Using two alternating ping-pong buffers in memory so audio sampling continues uninterrupted while the other buffer writes to the microSD card.',
        },
        {
          term: 'Near-Field Speech Capture',
          explanation: 'Microphone tuning optimized for picking up the wearer’s voice while minimizing background ambient reverberation.',
        },
      ],
      thingsToRemember: [
        'Place the microphone port upward-angled on the pendant enclosure.',
        'Never block audio sampling during microSD flash write cycles.',
        'All raw recordings remain local on the device until authorized by the user.',
      ],
      actionItems: [
        {
          id: 'demo_act_1',
          description: 'Model 3D enclosure with upward acoustic port angle for 3D print testing.',
          completed: false,
          assignedTo: 'Industrial Design',
          dueSuggestion: 'Monday',
          sourceTimestampMs: 4800,
        },
        {
          id: 'demo_act_2',
          description: 'Configure FreeRTOS task priorities for I2S DMA reader vs SPI SD writer.',
          completed: true,
          assignedTo: 'Firmware Team',
          dueSuggestion: 'Sprint 1',
          sourceTimestampMs: 10000,
        },
        {
          id: 'demo_act_3',
          description: 'Implement interactive transcript segment scrubbing in PWA audio player.',
          completed: true,
          assignedTo: 'Ashik',
          dueSuggestion: 'Completed',
          sourceTimestampMs: 15500,
        },
      ],
      studyQuestions: [
        {
          id: 'demo_sq_1',
          question: 'Why is DMA double-buffering critical when saving audio to microSD?',
          answerSummary: 'MicroSD flash cards experience occasional write latency spikes (up to 50-100ms); without DMA ping-pong buffers, the I2S audio stream will overflow and lose audio frames.',
          sourceTimestampMs: 10000,
        },
        {
          id: 'demo_sq_2',
          question: 'How should the microphone be physically oriented on the pendant?',
          answerSummary: 'Oriented upward toward the wearer’s chin for optimal near-field vocal pickup and natural ambient noise rejection.',
          sourceTimestampMs: 4800,
        },
      ],
      sentiment: 'action_oriented',
      processingDurationMs: 410,
    },
    syncStatus: 'synced_local',
    transferProgressPercent: 100,
    tags: ['Wearable Design', 'Acoustics', 'DMA Memory'],
    notes: 'Key architectural milestone discussion.',
    isFavorite: true,
  };

  await localDb.saveSession(demoSession);
}
