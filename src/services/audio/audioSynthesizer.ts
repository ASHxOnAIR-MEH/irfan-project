/**
 * Ambient Memory Pendant - Web Audio Synthesizer & Audio Blob Generator
 * Generates valid, playable WAV audio in-browser with authentic speech-like cadences
 * and ambient acoustic texture for offline demonstration sessions.
 */

export class AudioSynthesizer {
  private static audioCtx: AudioContext | null = null;

  private static getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Generates a realistic spoken waveform WAV Blob for a specified duration in seconds.
   * Modulates carrier frequencies (120Hz-240Hz pitch range with formant resonances)
   * to simulate spoken phrases and natural pauses between thoughts.
   */
  public static async generateSpokenAudioBlob(durationSeconds: number, topicSeed: string = 'ambient'): Promise<Blob> {
    const sampleRate = 16000; // 16kHz typical for ESP32 voice memos
    const totalSamples = Math.floor(sampleRate * durationSeconds);
    const audioCtx = this.getAudioContext();
    const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    // Seed pseudo-random generator
    let seed = 0;
    for (let i = 0; i < topicSeed.length; i++) {
      seed = (seed * 31 + topicSeed.charCodeAt(i)) & 0xffffffff;
    }
    const pseudoRand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    // Speech cadence simulation parameters
    let inPhrase = true;
    let phraseLengthSamples = Math.floor(sampleRate * (1.2 + pseudoRand() * 2.0));
    let pauseLengthSamples = Math.floor(sampleRate * (0.3 + pseudoRand() * 0.5));
    let stateCounter = 0;
    let basePitch = 135 + pseudoRand() * 40; // Pitch in Hz (natural speaking range)
    let phase = 0;

    for (let i = 0; i < totalSamples; i++) {
      stateCounter++;
      if (inPhrase && stateCounter >= phraseLengthSamples) {
        inPhrase = false;
        stateCounter = 0;
        pauseLengthSamples = Math.floor(sampleRate * (0.3 + pseudoRand() * 0.6));
      } else if (!inPhrase && stateCounter >= pauseLengthSamples) {
        inPhrase = true;
        stateCounter = 0;
        phraseLengthSamples = Math.floor(sampleRate * (1.5 + pseudoRand() * 2.5));
        basePitch = 120 + pseudoRand() * 50;
      }

      // Voice pitch micro-modulation
      const vibrato = Math.sin((i / sampleRate) * 5 * 2 * Math.PI) * 4;
      const currentPitch = basePitch + vibrato;
      phase += (currentPitch * 2 * Math.PI) / sampleRate;

      // Vocal harmonics (rich buzzy glottal source)
      let voiceSignal = 0;
      if (inPhrase) {
        // Fundamental + 2nd, 3rd, 4th harmonics (formant shaping)
        voiceSignal =
          Math.sin(phase) * 0.45 +
          Math.sin(phase * 2) * 0.25 +
          Math.sin(phase * 3) * 0.15 +
          Math.sin(phase * 4) * 0.08;

        // Syllable amplitude envelope (3-5 syllables per second)
        const syllableEnv = 0.5 + 0.5 * Math.sin((i / sampleRate) * 4.2 * 2 * Math.PI);
        voiceSignal *= syllableEnv;
      }

      // Subtle ambient room tone / microphone analog noise floor
      const noise = (pseudoRand() * 2 - 1) * 0.015;

      // Soft ceiling clamp
      channelData[i] = Math.max(-0.95, Math.min(0.95, voiceSignal * 0.65 + noise));
    }

    return this.audioBufferToWavBlob(buffer);
  }

  /**
   * Converts an AudioBuffer into standard RIFF PCM WAV binary Blob
   */
  private static audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // 1 = PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = buffer.getChannelData(0);
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // DATA sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM 16-bit samples
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, val, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private static writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Computes sample peak points (e.g. 50-100 bars) for beautiful visual audio waveforms
   */
  public static extractWaveformPeaks(bufferData: Float32Array, numBars: number = 60): number[] {
    const step = Math.floor(bufferData.length / numBars);
    const peaks: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const start = i * step;
      let max = 0;
      for (let j = 0; j < step && start + j < bufferData.length; j++) {
        const val = Math.abs(bufferData[start + j]);
        if (val > max) max = val;
      }
      peaks.push(Math.min(1, Math.max(0.12, max)));
    }

    return peaks;
  }
}
