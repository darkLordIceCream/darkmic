/**
 * F-009: minimal critical-path tests for the audio pipeline.
 * Runs on any platform — file mode is fully self-contained;
 * opus decode is exercised directly through opusscript.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import OpusScript from 'opusscript';
import {
  createAudioPipe,
  decodeOpusToPcm,
  type AudioPipeMode,
  type AudioPipeState,
} from '../src/audio.js';

// ── Helpers ─────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'darkmic-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

/**
 * The file pipe buffers writes; close() returns before the OS flushes.
 * Poll until the expected byte count is on disk (≤2s), then return it.
 */
async function readFlushedFile(path: string, minBytes: number): Promise<Buffer> {
  const start = Date.now();
  for (;;) {
    if (existsSync(path)) {
      const buf = readFileSync(path);
      if (buf.length >= minBytes) return buf;
    }
    if (Date.now() - start > 2000) {
      throw new Error(`file ${path} not flushed within 2s`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Encode one 20ms opus packet (960 samples of silence). */
function makeOpusPacket(): Buffer {
  const enc = new OpusScript(48000, 1);
  const pcm = Buffer.alloc(960 * 2); // s16le mono silence
  return enc.encode(pcm, 960);
}

// ── Factory dispatch ────────────────────────────────────────────────

describe('createAudioPipe factory', () => {
  it('creates a file pipe in file mode', () => {
    const dir = makeTempDir();
    const pipe = createAudioPipe({ mode: 'file', outputPath: join(dir, 'out.raw') });
    expect(pipe.mode).toBe('file');
    pipe.close();
  });

  it('falls back to file mode for an unknown mode', () => {
    const dir = makeTempDir();
    const bogus = 'bogus' as AudioPipeMode;
    const pipe = createAudioPipe({ mode: bogus, outputPath: join(dir, 'out.raw') });
    expect(pipe.mode).toBe('file');
    pipe.close();
  });

  it('file pipe writes 3-byte length-framed opus data', async () => {
    const dir = makeTempDir();
    const path = join(dir, 'out.raw');
    const packet = makeOpusPacket();

    const pipe = createAudioPipe({ mode: 'file', outputPath: path });
    pipe.write(packet);
    pipe.close();

    const written = await readFlushedFile(path, 3 + packet.length);
    // frameOpusPacket: 3-byte big-endian length prefix + payload
    expect(written.length).toBe(3 + packet.length);
    expect(written.readUIntBE(0, 3)).toBe(packet.length);
    expect(written.subarray(3)).toEqual(packet);
  });

  it('file pipe emits started → stopped state transitions', () => {
    const dir = makeTempDir();
    const states: AudioPipeState[] = [];
    const pipe = createAudioPipe({
      mode: 'file',
      outputPath: join(dir, 'out.raw'),
      onStateChange: (s) => states.push(s),
    });
    expect(states).toEqual(['started']);
    pipe.close();
    expect(states).toEqual(['started', 'stopped']);
  });

  it('file pipe ignores writes after close (closed guard)', async () => {
    const dir = makeTempDir();
    const path = join(dir, 'out.raw');
    const packet = makeOpusPacket();

    const pipe = createAudioPipe({ mode: 'file', outputPath: path });
    pipe.close();
    expect(() => pipe.write(packet)).not.toThrow();

    // Close is idempotent — must not emit a second 'stopped'
    const states: AudioPipeState[] = [];
    const pipe2 = createAudioPipe({
      mode: 'file',
      outputPath: join(dir, 'out2.raw'),
      onStateChange: (s) => states.push(s),
    });
    pipe2.close();
    pipe2.close();
    expect(states).toEqual(['started', 'stopped']);
  });
});

// ── Opus decode ─────────────────────────────────────────────────────

describe('decodeOpusToPcm', () => {
  it('decodes a valid opus packet to s16le PCM', () => {
    const packet = makeOpusPacket();
    const dec = new OpusScript(48000, 1);
    const pcm = decodeOpusToPcm(dec, packet);
    expect(pcm).not.toBeNull();
    expect(pcm!.length).toBe(960 * 2); // 960 samples, 2 bytes each
  });

  it('returns null and reports when the decoder throws', () => {
    // libopus tolerates most byte garbage (decodes to silence), so the
    // failure path is exercised with a throwing decoder mock instead.
    const boom = { decode: () => { throw new Error('boom'); } } as unknown as OpusScript;
    const errors: Error[] = [];
    const pcm = decodeOpusToPcm(boom, Buffer.from([0x01, 0x02, 0x03]), (e) => errors.push(e));
    expect(pcm).toBeNull();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('boom');
  });

  it('returns null when decoder is not ready', () => {
    const pcm = decodeOpusToPcm(null, Buffer.from([0x01, 0x02, 0x03]));
    expect(pcm).toBeNull();
  });
});
