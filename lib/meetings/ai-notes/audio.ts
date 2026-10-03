/**
 * Browser-side audio helpers for AI notes (pure functions, ported from Selah's use-ai-notes):
 * join captured buffers, downsample to 16 kHz, measure loudness, encode mono 16-bit WAV.
 */

export const TARGET_SAMPLE_RATE = 16_000;
/** Below this RMS a clip is treated as silence and never uploaded. */
export const SILENCE_RMS = 0.006;
/** Loud enough to send even if LiveKit never flagged the speaker as talking. */
export const SPEECH_RMS = 0.02;

export function joinBuffers(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Box-filter downsample (good enough for speech recognition). */
export function downsample(input: Float32Array, from: number, to: number = TARGET_SAMPLE_RATE): Float32Array {
  if (from <= to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function rms(samples: Float32Array) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Upload or skip? Silence never goes; quiet audio only when LiveKit saw this person speak
 * during the clip (so a fan or faint speaker bleed doesn't cost a request).
 */
export function shouldSendClip(level: number, spoke: boolean) {
  if (level < SILENCE_RMS) return false;
  return spoke || level >= SPEECH_RMS;
}

export function encodeWav(samples: Float32Array, rate: number = TARGET_SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    o += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
