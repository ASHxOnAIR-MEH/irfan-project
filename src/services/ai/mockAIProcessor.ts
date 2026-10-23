/**
 * Ambient Memory Pendant - Mock Offline AI & Transcription Engine
 * Generates structured memory insights and timestamped transcripts without network calls.
 * Explicitly marked as Demonstration Data.
 */

import { AIAnalysis, ActionItem, KeyConcept, StudyQuestion, TranscriptSegment } from '../../types/session';
import { AIProcessingResult, IAIProcessingService } from './IAIProcessingService';

export class MockAIProcessor implements IAIProcessingService {
  public readonly id = 'mock_offline';
  public readonly name = 'Offline Demonstrator (Local Simulated AI)';
  public readonly isLocal = true;

  public async processAudio(
    _audioBlob: Blob,
    metadata: { titleHint?: string; durationSeconds: number }
  ): Promise<AIProcessingResult> {
    // Simulate processing latency (e.g. 800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    const durationMs = Math.round(metadata.durationSeconds * 1000);
    const hint = (metadata.titleHint || '').toLowerCase();

    if (hint.includes('pinout') || hint.includes('hardware') || hint.includes('microphone')) {
      return this.generateHardwareInsight(durationMs);
    } else if (hint.includes('crc') || hint.includes('protocol') || hint.includes('resumption')) {
      return this.generateProtocolInsight(durationMs);
    } else if (hint.includes('privacy') || hint.includes('cloud')) {
      return this.generatePrivacyInsight(durationMs);
    }

    return this.generateGeneralMemoInsight(durationMs);
  }

  private generateHardwareInsight(durationMs: number): AIProcessingResult {
    const step = Math.floor(durationMs / 4);

    const transcript: TranscriptSegment[] = [
      {
        id: 'seg_1',
        speakerLabel: 'Hardware Engineer',
        startMs: 0,
        endMs: Math.min(durationMs, step),
        text: 'Reviewing the updated ESP32-S3 board with onboard battery charging circuitry. The dual-core Xtensa architecture gives us dedicated processing power for audio DMA without starving the wireless stack.',
      },
      {
        id: 'seg_2',
        speakerLabel: 'Embedded Dev',
        startMs: Math.min(durationMs, step + 200),
        endMs: Math.min(durationMs, step * 2),
        text: 'With the S3, we have ample GPIOs. The microphone and microSD card are peripherals, so we can route I2S cleanly and keep dedicated lines for the privacy switch and status LEDs.',
      },
      {
        id: 'seg_3',
        speakerLabel: 'Hardware Engineer',
        startMs: Math.min(durationMs, step * 2 + 200),
        endMs: Math.min(durationMs, step * 3),
        text: 'For battery telemetry, the board features integrated charging circuitry. We must distinguish hardware charging capability, actual charging signals, and raw ADC voltage before estimating battery life.',
      },
      {
        id: 'seg_4',
        speakerLabel: 'Product Lead',
        startMs: Math.min(durationMs, step * 3 + 200),
        endMs: durationMs,
        text: 'The UI must never fabricate battery percentage. If uncalibrated, label it unknown until physical curve testing on the S3 circuit is complete.',
      },
    ];

    const actionItems: ActionItem[] = [
      {
        id: 'act_hw_1',
        description: 'Verify schematic and pinouts for ESP32-S3 board with onboard battery charger.',
        completed: false,
        assignedTo: 'Hardware Team',
        dueSuggestion: 'Friday',
        sourceTimestampMs: Math.min(durationMs, step),
      },
      {
        id: 'act_hw_2',
        description: 'Check whether charging IC STAT pin is routed to a readable GPIO for charge state telemetry.',
        completed: false,
        assignedTo: 'Embedded Firmware',
        dueSuggestion: 'Next Sprint',
        sourceTimestampMs: Math.min(durationMs, step * 2),
      },
      {
        id: 'act_hw_3',
        description: 'Benchmark I2S microphone peripheral and microSD SPI/SDMMC write latency on dual-core ESP32-S3.',
        completed: true,
        assignedTo: 'Audio DSP',
        dueSuggestion: 'Completed',
        sourceTimestampMs: Math.min(durationMs, step * 3),
      },
    ];

    const keyConcepts: KeyConcept[] = [
      {
        term: 'ESP32-S3 Dual-Core Architecture',
        explanation: 'Dual-core 32-bit Xtensa LX7 up to 240MHz with vector instructions, separating I2S DMA recording from BLE/WiFi transport tasks.',
      },
      {
        term: 'Onboard Charging Telemetry',
        explanation: 'Distinguishing hardware charging circuit presence, actual charging status signals (STAT pin), battery ADC voltage, and calibrated percentage.',
      },
    ];

    const studyQuestions: StudyQuestion[] = [
      {
        id: 'sq_1',
        question: 'Why must battery percentage be treated as unknown if uncalibrated on the ESP32-S3 board?',
        answerSummary: 'LiPo discharge curves are non-linear; without lookup tables or calibration points, linear approximations produce false telemetry readings.',
        sourceTimestampMs: Math.min(durationMs, step * 3),
      },
    ];

    const insights: AIAnalysis = {
      provider: 'local_mock',
      isDemonstrationData: true,
      analyzedAtMs: Date.now(),
      executiveSummary:
        'Discussion focusing on the ESP32-S3 board with onboard battery charging circuitry. The team aligned on peripheral I2S microphone and microSD routing, hardware privacy button integration, and strictly requiring verified charging and battery calibration telemetry.',
      importantTopics: ['ESP32-S3 Architecture', 'Onboard Charging Circuit', 'Peripheral I2S & MicroSD', 'Battery Telemetry Breakdown'],
      keyConcepts,
      thingsToRemember: [
        'ESP32-S3 dual-core LX7 provides abundant GPIOs and vector processing capability.',
        'Microphone and microSD card are treated as peripherals until schematic confirmation.',
        'Distinguish hardware charging capability, actual charging signals, ADC voltage, and calibrated percentages.',
      ],
      actionItems,
      studyQuestions,
      sentiment: 'analytical',
      processingDurationMs: 420,
    };

    return { transcript, insights };
  }

  private generateProtocolInsight(durationMs: number): AIProcessingResult {
    const step = Math.floor(durationMs / 3);

    const transcript: TranscriptSegment[] = [
      {
        id: 'seg_p1',
        speakerLabel: 'Firmware Dev',
        startMs: 0,
        endMs: Math.min(durationMs, step),
        text: 'Binary streaming over Bluetooth LE or SoftAP needs to be chunked into four-kilobyte packets with IEEE 802.3 CRC32 verification.',
      },
      {
        id: 'seg_p2',
        speakerLabel: 'App Engineer',
        startMs: Math.min(durationMs, step + 150),
        endMs: Math.min(durationMs, step * 2),
        text: 'The PWA stores received chunks in IndexedDB. If the user walks out of range, the transfer pauses and resumes from the exact chunk offset.',
      },
      {
        id: 'seg_p3',
        speakerLabel: 'Firmware Dev',
        startMs: Math.min(durationMs, step * 2 + 150),
        endMs: durationMs,
        text: 'Crucially, the ESP32 will retain the WAV file on the microSD card until the PWA responds with an explicit signed confirmation ACK.',
      },
    ];

    const actionItems: ActionItem[] = [
      {
        id: 'act_proto_1',
        description: 'Implement chunk resumption state machine in the PWA IndexedDB sync engine.',
        completed: true,
        assignedTo: 'Web Lead',
        dueSuggestion: 'Today',
        sourceTimestampMs: Math.min(durationMs, step),
      },
      {
        id: 'act_proto_2',
        description: 'Verify CRC32 integrity check catches corrupted bit flips in simulation.',
        completed: false,
        assignedTo: 'QA',
        dueSuggestion: 'Tomorrow',
        sourceTimestampMs: Math.min(durationMs, step * 2),
      },
    ];

    const keyConcepts: KeyConcept[] = [
      {
        term: 'CRC32 Checksum',
        explanation: 'Cyclic Redundancy Check verifying that binary audio data transferred over wireless channels matches the exact file stored on the SD card.',
      },
      {
        term: 'Two-Way Sync Handshake',
        explanation: 'Ensures files are only marked synchronized or deleted from the pendant once safely committed to client-side storage.',
      },
    ];

    const studyQuestions: StudyQuestion[] = [
      {
        id: 'sq_p1',
        question: 'What prevents partial audio file corruption during Bluetooth disconnections?',
        answerSummary: 'Chunk index tracking and per-packet CRC validation ensure missing packets are requested without re-downloading the entire session.',
        sourceTimestampMs: Math.min(durationMs, step * 2),
      },
    ];

    const insights: AIAnalysis = {
      provider: 'local_mock',
      isDemonstrationData: true,
      analyzedAtMs: Date.now(),
      executiveSummary:
        'Specification of the resilient binary transfer protocol. Highlights chunked 4KB payloads, resumable state machines across wireless disconnects, and microSD data preservation guarantees.',
      importantTopics: ['Binary Chunking', 'CRC32 Verification', 'Resumable Downloads', 'MicroSD Data Safety'],
      keyConcepts,
      thingsToRemember: [
        'Never delete microSD recordings automatically without user opt-in and verified ACK.',
        'Support chunk resumption to tolerate flaky Bluetooth connections.',
      ],
      actionItems,
      studyQuestions,
      sentiment: 'action_oriented',
      processingDurationMs: 380,
    };

    return { transcript, insights };
  }

  private generatePrivacyInsight(durationMs: number): AIProcessingResult {
    const step = Math.floor(durationMs / 3);

    const transcript: TranscriptSegment[] = [
      {
        id: 'seg_pr1',
        speakerLabel: 'Privacy Architect',
        startMs: 0,
        endMs: Math.min(durationMs, step),
        text: 'The Ambient Memory Pendant must be local-first by default. Audio captures contain sensitive interpersonal dialogue.',
      },
      {
        id: 'seg_pr2',
        speakerLabel: 'Frontend Lead',
        startMs: Math.min(durationMs, step + 200),
        endMs: Math.min(durationMs, step * 2),
        text: 'All raw audio files and transcripts stay encrypted inside IndexedDB. If users want external AI models, they must provide their own API key.',
      },
      {
        id: 'seg_pr3',
        speakerLabel: 'Privacy Architect',
        startMs: Math.min(durationMs, step * 2 + 200),
        endMs: durationMs,
        text: 'Every screen should prominently display whether insights were processed locally or through an external provider.',
      },
    ];

    const actionItems: ActionItem[] = [
      {
        id: 'act_pr_1',
        description: 'Add prominent privacy badge and local-only processing toggles to the main settings view.',
        completed: true,
        assignedTo: 'UI Engineer',
        dueSuggestion: 'Sprint Goal',
        sourceTimestampMs: Math.min(durationMs, step),
      },
    ];

    const keyConcepts: KeyConcept[] = [
      {
        term: 'Local-First Architecture',
        explanation: 'Data is written to and processed on the local device, ensuring complete user autonomy and zero unauthorized cloud transfers.',
      },
    ];

    const studyQuestions: StudyQuestion[] = [
      {
        id: 'sq_pr1',
        question: 'How does the Ambient Memory Pendant protect sensitive conversational privacy?',
        answerSummary: 'By storing recordings on physical microSD, transferring over local Bluetooth/SoftAP, keeping data in browser IndexedDB, and requiring explicit opt-in for cloud APIs.',
        sourceTimestampMs: 0,
      },
    ];

    const insights: AIAnalysis = {
      provider: 'local_mock',
      isDemonstrationData: true,
      analyzedAtMs: Date.now(),
      executiveSummary:
        'Review of user privacy tenets. Mandates local-first architecture, zero automatic cloud telemetry, explicit user consent for external model transcription, and clear provenance badges.',
      importantTopics: ['Privacy First', 'Local Storage', 'BYOK AI Keys', 'Explicit Consent'],
      keyConcepts,
      thingsToRemember: [
        'Raw audio must never be uploaded without explicit user confirmation.',
        'Display clear processing indicators on every session detail view.',
      ],
      actionItems,
      studyQuestions,
      sentiment: 'reflective',
      processingDurationMs: 310,
    };

    return { transcript, insights };
  }

  private generateGeneralMemoInsight(durationMs: number): AIProcessingResult {
    const step = Math.floor(durationMs / 2);

    const transcript: TranscriptSegment[] = [
      {
        id: 'seg_g1',
        speakerLabel: 'User',
        startMs: 0,
        endMs: Math.min(durationMs, step),
        text: 'Quick ambient voice memo. Testing background recording clarity on the pendant while walking outdoors.',
      },
      {
        id: 'seg_g2',
        speakerLabel: 'User',
        startMs: Math.min(durationMs, step + 200),
        endMs: durationMs,
        text: 'Microphone pickup is crisp. Need to remember to order extra CR2032 or small 3.7V 300mAh LiPo cells for prototyping the enclosure.',
      },
    ];

    const actionItems: ActionItem[] = [
      {
        id: 'act_gen_1',
        description: 'Order 3.7V 300mAh LiPo batteries with JST PH2.0 connectors.',
        completed: false,
        assignedTo: 'Ashik',
        dueSuggestion: 'Soon',
        sourceTimestampMs: Math.min(durationMs, step + 200),
      },
    ];

    const keyConcepts: KeyConcept[] = [
      {
        term: 'Ambient Audio Capture',
        explanation: 'Passive or push-to-record voice memo recording in wearable form factors.',
      },
    ];

    const studyQuestions: StudyQuestion[] = [
      {
        id: 'sq_g1',
        question: 'What battery chemistry is recommended for the wearable pendant?',
        answerSummary: 'Single-cell 3.7V Lithium-Polymer (LiPo) with integrated PCM protection circuit.',
        sourceTimestampMs: Math.min(durationMs, step + 200),
      },
    ];

    const insights: AIAnalysis = {
      provider: 'local_mock',
      isDemonstrationData: true,
      analyzedAtMs: Date.now(),
      executiveSummary: 'Ambient voice memo testing audio pickup quality and noting battery component procurement.',
      importantTopics: ['Voice Memo', 'Acoustic Quality', 'Battery Sourcing'],
      keyConcepts,
      thingsToRemember: ['Procure 3.7V 300mAh LiPo cells with PCM protection.'],
      actionItems,
      studyQuestions,
      sentiment: 'reflective',
      processingDurationMs: 250,
    };

    return { transcript, insights };
  }
}
