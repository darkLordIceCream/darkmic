/**
 * Audio pipeline — receives raw opus chunks from WebSocket,
 * decodes them to PCM, and outputs to the target device.
 *
 * F-003: Multiple output modes with progressive verification:
 *   - file:    Write framed opus to disk (Phase 1 — data integrity)
 *   - ffplay:  Opusscript decode → PCM → ffplay speaker output (Phase 2)
 *   - wasapi:  Opusscript decode → PCM → WinMM waveOut → VB-Cable (Phase 3)
 *
 * Phase 4 hardening:
 *   - ffplay auto-restart on crash (up to 3 attempts)
 *   - State change callbacks for connection feedback
 *
 * Decoding strategy:
 *   Node.js `opusscript` decodes opus → s16le PCM in-process
 *   (avoids FFmpeg raw opus demuxer compatibility issues).
 *   ffplay handles PCM → audio device output (speakers).
 *   WinMM waveOut API (via koffi) handles PCM → VB-Cable (no FFmpeg needed).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { resolve } from 'node:path';
import OpusScript from 'opusscript';
import { createWasapiOutput } from './wasapi.js';

// ── Types ──────────────────────────────────────────────────────────

export type AudioPipeMode = 'file' | 'ffplay' | 'wasapi';

export type AudioPipeState = 'started' | 'restarting' | 'error' | 'stopped';

export interface AudioPipeOptions {
  mode?: AudioPipeMode;
  /** Output file path (file mode only). Default: ./darkmic-audio.raw */
  outputPath?: string;
  /** FFmpeg executable path (ffplay mode). Default: 'ffmpeg' (via PATH) */
  ffmpegPath?: string;
  /** VB-Cable device name (wasapi mode only) */
  cableDevice?: string;
  /** Called when pipe state changes (for UI feedback) */
  onStateChange?: (state: AudioPipeState) => void;
}

export interface AudioPipe {
  readonly mode: AudioPipeMode;
  write(chunk: Buffer): void;
  close(): void;
}

// ── Opus framing (for file mode) ───────────────────────────────────

/**
 * Prepend a 24-bit big-endian length prefix to a raw opus packet.
 * This is the format expected by FFmpeg's raw opus demuxer
 * when using ffprobe or later batch analysis.
 */
function frameOpusPacket(data: Buffer): Buffer {
  const header = Buffer.alloc(3);
  header.writeUIntBE(data.length, 0, 3);
  return Buffer.concat([header, data]);
}

// ── Opus decoder helper ────────────────────────────────────────────

/**
 * OpusScript decoder instance (48000 Hz, mono).
 * Instantiated once per audio pipe session.
 */
function createOpusDecoder(): OpusScript | null {
  try {
    return new OpusScript(48000, 1);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AudioPipe] OpusScript init failed: ${msg}`);
    return null;
  }
}

/**
 * Decode a raw opus packet to s16le PCM.
 * Returns null if decoding fails (malformed packet, decoder not ready).
 */
function decodeOpusToPcm(decoder: OpusScript | null, chunk: Buffer): Buffer | null {
  if (!decoder) return null;
  try {
    return Buffer.from(decoder.decode(chunk));
  } catch {
    return null;
  }
}

// ── Mode implementations ───────────────────────────────────────────

/** Phase 1: Write framed raw opus chunks to a file on disk. */
function createFilePipe(outputPath: string, onStateChange?: (s: AudioPipeState) => void): AudioPipe {
  const resolvedPath = resolve(outputPath);
  const stream: WriteStream = createWriteStream(resolvedPath, { flags: 'a' });
  let byteCount = 0;

  stream.on('error', (err) => {
    console.error(`[AudioPipe:file] Write error: ${err.message}`);
  });

  console.log(`[AudioPipe:file] Writing to ${resolvedPath}`);
  onStateChange?.('started');

  return {
    mode: 'file',
    write(chunk: Buffer) {
      const framed = frameOpusPacket(chunk);
      stream.write(framed);
      byteCount += chunk.length;
    },
    close() {
      stream.end();
      onStateChange?.('stopped');
      console.log(
        `[AudioPipe:file] Saved ${byteCount} bytes of opus data to ${resolvedPath}`,
      );
    },
  };
}

/** Phase 2: Opusscript decode → s16le PCM → ffplay speaker output. */
function createFfplayPipe(ffmpegPath: string, onStateChange?: (s: AudioPipeState) => void): AudioPipe {
  let byteCount = 0;
  let proc: ChildProcess | null = null;
  let closed = false;
  let restarting = false;
  let restartCount = 0;
  const MAX_RESTARTS = 3;
  const decoder = createOpusDecoder();

  const sep = ffmpegPath.includes('\\') ? '\\' : '/';
  const idx = ffmpegPath.lastIndexOf(sep);
  const binDir = idx >= 0 ? ffmpegPath.substring(0, idx) : '.';
  const fplay = `${binDir}${sep}ffplay${process.platform === 'win32' ? '.exe' : ''}`;

  function spawnFfplay(): ChildProcess | null {
    try {
      const child = spawn(fplay, [
        '-f', 's16le',
        '-ar', '48000',
        '-nodisp',
        '-autoexit',
        '-loglevel', 'quiet',
        'pipe:0',
      ], {
        stdio: ['pipe', 'inherit', 'inherit'],
      });

      child.on('error', (err) => {
        console.error(`[AudioPipe:ffplay] error: ${err.message}`);
      });

      child.on('exit', (code) => {
        if (closed) return;
        if (code !== 0 && restartCount < MAX_RESTARTS) {
          restartCount++;
          restarting = true;
          console.warn(
            `[AudioPipe:ffplay] exited code=${code}, restarting (${restartCount}/${MAX_RESTARTS})...`,
          );
          onStateChange?.('restarting');
          proc = spawnFfplay();
          restarting = false;
        } else if (code !== 0) {
          console.error(
            `[AudioPipe:ffplay] exited code=${code}, max restarts reached`,
          );
          onStateChange?.('error');
        }
      });

      return child;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AudioPipe:ffplay] spawn failed: ${msg}`);
      return null;
    }
  }

  proc = spawnFfplay();

  if (!proc) {
    console.warn('[AudioPipe:ffplay] not available — audio will be discarded');
    onStateChange?.('error');
  } else {
    console.log('[AudioPipe:ffplay] started (OpusScript → ffplay)');
    onStateChange?.('started');
  }

  return {
    mode: 'ffplay',
    write(chunk: Buffer) {
      if (closed || restarting) return;
      const pcm = decodeOpusToPcm(decoder, chunk);
      if (!pcm) return;
      const target = proc;
      if (target?.stdin?.writable) {
        try {
          target.stdin.write(pcm);
          byteCount += chunk.length;
        } catch {
          // process stdin closed between check and write
        }
      }
    },
    close() {
      closed = true;
      if (proc?.stdin?.writable) {
        proc.stdin.end();
      }
      setTimeout(() => {
        if (decoder) {
          try { decoder.delete(); } catch { /* ignore */ }
        }
        proc?.kill('SIGTERM');
      }, 300);
      onStateChange?.('stopped');
      console.log(
        `[AudioPipe:ffplay] Closed — ${byteCount} bytes processed`,
      );
    },
  };
}

/** Phase 3: Opusscript decode → s16le PCM → WinMM waveOut → VB-Cable. */
function createWasapiPipe(cableDevice: string, onStateChange?: (s: AudioPipeState) => void): AudioPipe {
  let byteCount = 0;
  let closed = false;
  const decoder = createOpusDecoder();
  const wasapi = createWasapiOutput(cableDevice);

  if (!wasapi) {
    console.warn('[AudioPipe:wasapi] VB-Cable not available');
    onStateChange?.('error');
  } else {
    console.log('[AudioPipe:wasapi] started (OpusScript → WinMM → VB-Cable)');
    onStateChange?.('started');
  }

  return {
    mode: 'wasapi',
    write(chunk: Buffer) {
      if (closed || !wasapi) return;
      const pcm = decodeOpusToPcm(decoder, chunk);
      if (pcm) {
        wasapi.write(pcm);
        byteCount += chunk.length;
      }
    },
    close() {
      closed = true;
      wasapi?.close();
      if (decoder) {
        try { decoder.delete(); } catch { /* ignore */ }
      }
      onStateChange?.('stopped');
      console.log(
        `[AudioPipe:wasapi] Closed — ${byteCount} bytes processed`,
      );
    },
  };
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Create an AudioPipe for the given mode.
 *
 * Mode auto-detection:
 *   - 'file' always works (default)
 *   - 'ffplay' works anywhere ffplay is available
 *   - 'wasapi' requires Windows + VB-Cable driver
 */
export function createAudioPipe(options: AudioPipeOptions = {}): AudioPipe {
  const mode = options.mode || 'file';
  const ffmpegPath = options.ffmpegPath || 'ffmpeg';
  const cableDevice = options.cableDevice || 'CABLE Input (VB-Audio Virtual Cable)';
  const onStateChange = options.onStateChange;

  switch (mode) {
    case 'file':
      return createFilePipe(options.outputPath || './darkmic-audio.raw', onStateChange);
    case 'ffplay':
      return createFfplayPipe(ffmpegPath, onStateChange);
    case 'wasapi':
      return createWasapiPipe(cableDevice, onStateChange);
    default: {
      console.warn(`[AudioPipe] Unknown mode "${mode}", falling back to file`);
      return createFilePipe(options.outputPath || './darkmic-audio.raw', onStateChange);
    }
  }
}
