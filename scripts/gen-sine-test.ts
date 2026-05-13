#!/usr/bin/env tsx
/**
 * Generate a 1-second sine wave, encode to opus via opusscript,
 * pipe through AudioPipe in ffplay mode.
 *
 * This validates the full encode→decode→playback chain with real data
 * (no phone needed).
 *
 * Usage:
 *   pnpm tsx scripts/gen-sine-test.ts --ffmpeg-path "path\to\ffmpeg.exe"
 */

import { argv } from 'node:process';
import OpusScript from 'opusscript';

// Parse --ffmpeg-path
let ffmpegPath: string | undefined;
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === '--ffmpeg-path' && i + 1 < argv.length) {
    ffmpegPath = argv[++i];
  }
}

// 1. Generate 1-second sine wave: 440Hz, 48kHz, s16le, mono
const SAMPLE_RATE = 48000;
const DURATION_SEC = 1;
const NUM_SAMPLES = SAMPLE_RATE * DURATION_SEC;
const FREQ = 440; // A4

const pcmSamples = new Int16Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  // 440Hz sine, 30% volume to avoid clipping
  pcmSamples[i] = Math.round(32767 * 0.3 * Math.sin(2 * Math.PI * FREQ * t));
}
const pcmBuf = Buffer.from(pcmSamples.buffer);

console.log(`Generated ${(pcmBuf.length / 1024).toFixed(1)} KB of sine wave PCM`);

// 2. Encode with opusscript (20ms frames, 960 samples each)
const encoder = new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.AUDIO);
const FRAME_SIZE = 960; // 20ms
const opusChunks: Buffer[] = [];

for (let offset = 0; offset + FRAME_SIZE * 2 <= pcmBuf.length; offset += FRAME_SIZE * 2) {
  const frame = pcmBuf.subarray(offset, offset + FRAME_SIZE * 2);
  const encoded = encoder.encode(frame, FRAME_SIZE);
  opusChunks.push(Buffer.from(encoded));
}
encoder.delete();

console.log(`Encoded ${opusChunks.length} opus frames (${(opusChunks.length * 20)}ms audio)`);

// 3. Play through AudioPipe ffplay mode
const { createAudioPipe } = await import('../src/audio.js');

console.log(`Starting ffplay pipeline...\n`);
const pipe = createAudioPipe({
  mode: 'ffplay',
  ffmpegPath,
});

for (const chunk of opusChunks) {
  pipe.write(chunk);
  // Simulate real-time-ish pacing: wait 20ms between frames
  await new Promise((r) => setTimeout(r, 20));
}

pipe.close();
console.log(`\nPlayback complete. You should have heard a 440Hz tone for ~1 second.`);
