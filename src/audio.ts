/**
 * Audio pipeline — receives raw opus chunks from WebSocket,
 * decodes them to PCM, and outputs to the target device.
 *
 * F-003: Multiple output modes with progressive verification:
 *   - file:    Write framed opus to disk (Phase 1 — data integrity)
 *   - ffplay:  Opusscript decode → PCM → ffplay speaker output (Phase 2)
 *   - wasapi:  Opusscript decode → PCM → FFmpeg → VB-Cable (Phase 3)
 *
 * Decoding strategy:
 *   Node.js `opusscript` decodes opus → s16le PCM in-process
 *   (avoids FFmpeg raw opus demuxer compatibility issues).
 *   FFmpeg/ffplay handles PCM → audio device output.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { resolve } from 'node:path';
import OpusScript from 'opusscript';

// ── Types ──────────────────────────────────────────────────────────

export type AudioPipeMode = 'file' | 'ffplay' | 'wasapi';

export interface AudioPipeOptions {
  mode?: AudioPipeMode;
  /** Output file path (file mode only). Default: ./darkmic-audio.raw */
  outputPath?: string;
  /** FFmpeg executable path (ffplay/wasapi modes). Default: 'ffmpeg' (via PATH) */
  ffmpegPath?: string;
  /** VB-Cable device name (wasapi mode only) */
  cableDevice?: string;
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
function createFilePipe(outputPath: string): AudioPipe {
  const resolvedPath = resolve(outputPath);
  const stream: WriteStream = createWriteStream(resolvedPath, { flags: 'a' });
  let byteCount = 0;

  stream.on('error', (err) => {
    console.error(`[AudioPipe:file] Write error: ${err.message}`);
  });

  return {
    mode: 'file',
    write(chunk: Buffer) {
      const framed = frameOpusPacket(chunk);
      stream.write(framed);
      byteCount += chunk.length;
    },
    close() {
      stream.end();
      console.log(
        `[AudioPipe:file] Saved ${byteCount} bytes of opus data to ${resolvedPath}`,
      );
    },
  };
}

/** Phase 2: Opusscript decode → s16le PCM → FFmpeg DirectSound playback. */
function createFfplayPipe(ffmpegPath: string): AudioPipe {
  let byteCount = 0;
  let proc: ChildProcess | null = null;
  let closed = false;
  let decoder = createOpusDecoder();

  // Derive ffplay path from ffmpeg location
  const sep = ffmpegPath.includes('\\') ? '\\' : '/';
  const idx = ffmpegPath.lastIndexOf(sep);
  const binDir = idx >= 0 ? ffmpegPath.substring(0, idx) : '.';
  const fplay = `${binDir}${sep}ffplay${process.platform === 'win32' ? '.exe' : ''}`;

  try {
    // ffplay reads s16le PCM from stdin, plays through default audio device
    proc = spawn(fplay, [
      '-f', 's16le',
      '-ar', '48000',
      '-nodisp',
      '-autoexit',
      '-loglevel', 'quiet',
      'pipe:0',
    ], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AudioPipe:ffplay] Failed to spawn FFmpeg: ${msg}`);
  }

  const pipeProcess = proc;

  if (!pipeProcess) {
    console.warn('[AudioPipe:ffplay] FFmpeg not available — audio will be discarded');
  } else {
    pipeProcess.on('error', (err) => {
      console.error(`[AudioPipe:ffplay] FFmpeg error: ${err.message}`);
    });
    pipeProcess.on('exit', (code) => {
      if (code !== 0 && !closed) {
        console.warn(`[AudioPipe:ffplay] FFmpeg exited with code ${code}`);
      }
    });
    console.log('[AudioPipe:ffplay] Pipeline started (OpusScript → ffplay)');
  }

  return {
    mode: 'ffplay',
    write(chunk: Buffer) {
      if (closed || !pipeProcess) return;
      const pcm = decodeOpusToPcm(decoder, chunk);
      if (pcm && pipeProcess.stdin?.writable) {
        pipeProcess.stdin.write(pcm);
        byteCount += chunk.length;
      }
    },
    close() {
      closed = true;
      if (pipeProcess?.stdin?.writable) {
        pipeProcess.stdin.end();
      }
      if (decoder) {
        try { decoder.delete(); } catch { /* ignore */ }
        decoder = null;
      }
      setTimeout(() => {
        pipeProcess?.kill('SIGTERM');
      }, 300);
      console.log(
        `[AudioPipe:ffplay] Closed — ${byteCount} bytes processed`,
      );
    },
  };
}

/** Phase 3: Opusscript decode → s16le PCM → FFmpeg WASAPI → VB-Cable. */
function createWasapiPipe(ffmpegPath: string, cableDevice: string): AudioPipe {
  let byteCount = 0;
  let proc: ChildProcess | null = null;
  let closed = false;
  let decoder = createOpusDecoder();

  try {
    proc = spawn(ffmpegPath, [
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '1',
      '-i', 'pipe:0',
      '-f', 'wasapi',
      '-bufsize', '120ms',
      cableDevice,
    ], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AudioPipe:wasapi] Failed to spawn FFmpeg: ${msg}`);
  }

  const pipeProcess = proc;

  if (!pipeProcess) {
    console.warn('[AudioPipe:wasapi] FFmpeg not available — audio will be discarded');
  } else {
    pipeProcess.on('error', (err) => {
      console.error(`[AudioPipe:wasapi] FFmpeg error: ${err.message}`);
    });
    pipeProcess.on('exit', (code) => {
      if (code !== 0 && !closed) {
        console.warn(`[AudioPipe:wasapi] FFmpeg exited with code ${code}`);
        // Auto-restart in Phase 4
      }
    });
    console.log(`[AudioPipe:wasapi] Pipeline started (OpusScript → ${cableDevice})`);
  }

  return {
    mode: 'wasapi',
    write(chunk: Buffer) {
      if (closed || !pipeProcess) return;
      const pcm = decodeOpusToPcm(decoder, chunk);
      if (pcm && pipeProcess.stdin?.writable) {
        pipeProcess.stdin.write(pcm);
        byteCount += chunk.length;
      }
    },
    close() {
      closed = true;
      if (pipeProcess?.stdin?.writable) {
        pipeProcess.stdin.end();
      }
      if (decoder) {
        try { decoder.delete(); } catch { /* ignore */ }
        decoder = null;
      }
      setTimeout(() => {
        pipeProcess?.kill('SIGTERM');
      }, 500);
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

  switch (mode) {
    case 'file':
      return createFilePipe(options.outputPath || './darkmic-audio.raw');
    case 'ffplay':
      return createFfplayPipe(ffmpegPath);
    case 'wasapi':
      return createWasapiPipe(ffmpegPath, cableDevice);
    default: {
      console.warn(`[AudioPipe] Unknown mode "${mode}", falling back to file`);
      return createFilePipe(options.outputPath || './darkmic-audio.raw');
    }
  }
}
