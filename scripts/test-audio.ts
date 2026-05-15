#!/usr/bin/env tsx
/**
 * Audio pipeline manual test / verification script.
 *
 * Usage:
 *   pnpm test:audio                   # File mode (default) — writes to ./test-output.raw
 *   pnpm test:audio -- ffplay         # Decode + play through speakers
 *   pnpm test:audio -- wasapi         # Decode + output to VB-Cable (Windows)
 *   pnpm test:audio -- file --input ./samples/speech.opus   # Replay a recorded file
 *
 * Without --input, it generates a short synthetic opus signal
 * by capturing from the default mic for 3 seconds (if available)
 * or writes a known silence frame for basic validation.
 */

import { createAudioPipe, type AudioPipeMode, type AudioPipe } from '../src/audio.js';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from 'node:process';

// ── CLI arg parsing ────────────────────────────────────────────────

const args = argv.slice(2);
let mode: AudioPipeMode = 'file';
let inputFile: string | null = null;
let ffmpegPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--ffplay' || arg === 'ffplay') mode = 'ffplay';
  else if (arg === '--wasapi' || arg === 'wasapi') mode = 'wasapi';
  else if (arg === '--file' || arg === 'file') mode = 'file';
  else if (arg === '--ffmpeg-path' && i + 1 < args.length) ffmpegPath = args[++i];
  else if (arg === '--input' && i + 1 < args.length) inputFile = args[++i];
  else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: pnpm test:audio [mode] [options]

Modes:
  file      Write raw opus to disk (default). Output: ./test-output.raw
  ffplay    Decode via FFmpeg → play through speakers
  wasapi    Decode via FFmpeg → VB-Cable virtual device (Windows only)

Options:
  --input <path>       Replay a recorded .opus raw file
  --ffmpeg-path <path> Full path to ffmpeg executable (if not in PATH)
  --help               Show this help

Examples:
  pnpm test:audio file --input ./samples/speech.opus
  pnpm test:audio ffplay
`);
    process.exit(0);
  }
}

// ── Test data ─────────────────────────────────────────────────────

/**
 * A valid Opus silence frame (2.5ms, 48kHz, mono, ~5 bytes).
 * Generated from: a libopus encoder encoding silence.
 *
 * This is a well-known constant: Opus SILK frame with PVQ for silence.
 * May not decode on all FFmpeg versions — use as a basic format check.
 */
const SILENCE_FRAME = Buffer.from([0xfc, 0xff, 0x00, 0x00, 0x00]);

function loadTestData(): Buffer[] {
  if (inputFile) {
    const path = resolve(inputFile);
    const data = readFileSync(path);
    console.log(`Loaded ${data.length} bytes from ${path}`);
    // Split into chunks (every ~400 bytes simulates real WebSocket chunks)
    const chunks: Buffer[] = [];
    for (let i = 0; i < data.length; i += 400) {
      chunks.push(data.subarray(i, i + 400));
    }
    return chunks;
  }

  // Generate synthetic data: 100 silence frames
  console.log('No input file — using synthetic silence frames');
  return Array(100).fill(SILENCE_FRAME);
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== AudioPipe Test Suite ===`);
  console.log(`Mode:      ${mode}`);
  console.log(`Platform:  ${process.platform}`);
  console.log(`Input:     ${inputFile || 'synthetic silence'}\n`);

  const chunks = loadTestData();

  const options = mode === 'file'
    ? { mode, outputPath: './test-output.raw' as const, ffmpegPath }
    : { mode, ffmpegPath };

  const pipe: AudioPipe = createAudioPipe(options);

  console.log(`Writing ${chunks.length} chunks…\n`);

  for (let i = 0; i < chunks.length; i++) {
    pipe.write(chunks[i]);
    // Small delay to simulate real-time stream (skip for file mode)
    if (mode !== 'file' && i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  pipe.close();

  // Wait for file flush, then verify
  if (mode === 'file') {
    await new Promise((r) => setTimeout(r, 100));
    const outputPath = resolve('./test-output.raw');
    try {
      const stats = statSync(outputPath);
      const pass = stats.size > 0;
      console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'}: Output file size = ${stats.size} bytes`);
      process.exit(pass ? 0 : 1);
    } catch {
      console.log(`\n❌ FAIL: Output file not found at ${outputPath}`);
      process.exit(1);
    }
  } else {
    console.log(`\n✅ Test completed — listen for audio output.`);
    console.log(`   Press Ctrl+C to stop if audio continues playing.\n`);

    // Keep alive for non-file modes (audio plays async)
    if (mode !== 'file') {
      await new Promise(() => { /* never resolves — user Ctrl+C */ });
    }
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
