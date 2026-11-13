/**
 * F-009: config.json loading tests.
 * Covers: defaults when missing, reading values, invalid-value
 * fallbacks (with warnings instead of crashes), env precedence.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'darkmic-config-'));
  tempDirs.push(dir);
  return dir;
}

function writeConfig(dir: string, content: string): string {
  const path = join(dir, 'config.json');
  writeFileSync(path, content);
  return path;
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe('loadConfig', () => {
  it('uses documented defaults when config.json is missing', () => {
    const cfg = loadConfig('/nonexistent-dir-darkmic', {});
    expect(cfg).toEqual({ port: 3000, audioPipeMode: 'wasapi', initialBitrate: 32000 });
  });

  it('reads values from a valid config.json', () => {
    const dir = makeTempDir();
    writeConfig(dir, JSON.stringify({ port: 8080, audioPipeMode: 'ffplay', initialBitrate: 64000 }));
    const cfg = loadConfig(dir, {});
    expect(cfg).toEqual({ port: 8080, audioPipeMode: 'ffplay', initialBitrate: 64000 });
  });

  it('falls back to defaults per-key on invalid values (no crash)', () => {
    const dir = makeTempDir();
    writeConfig(
      dir,
      JSON.stringify({ port: 99999, audioPipeMode: 'wasapi-pro-max', initialBitrate: 10 }),
    );
    const cfg = loadConfig(dir, {});
    expect(cfg).toEqual({ port: 3000, audioPipeMode: 'wasapi', initialBitrate: 32000 });
  });

  it('keeps valid keys when only some keys are invalid', () => {
    const dir = makeTempDir();
    writeConfig(dir, JSON.stringify({ port: 8080, audioPipeMode: 'not-a-mode' }));
    const cfg = loadConfig(dir, {});
    expect(cfg).toEqual({ port: 8080, audioPipeMode: 'wasapi', initialBitrate: 32000 });
  });

  it('accepts config.json with unsupported fields (forward compatible)', () => {
    const dir = makeTempDir();
    writeConfig(dir, JSON.stringify({ port: 9000, futureOption: true }));
    const cfg = loadConfig(dir, {});
    expect(cfg.port).toBe(9000);
  });

  it('falls back to defaults on malformed JSON (with warning, no crash)', () => {
    const dir = makeTempDir();
    writeConfig(dir, '{ this is not json');
    const cfg = loadConfig(dir, {});
    expect(cfg).toEqual({ port: 3000, audioPipeMode: 'wasapi', initialBitrate: 32000 });
  });

  it('env vars override config.json values', () => {
    const dir = makeTempDir();
    writeConfig(dir, JSON.stringify({ port: 8080, audioPipeMode: 'file' }));
    const cfg = loadConfig(dir, { PORT: '9001', AUDIO_PIPE_MODE: 'ffplay' });
    expect(cfg).toEqual({ port: 9001, audioPipeMode: 'ffplay', initialBitrate: 32000 });
  });

  it('invalid env values warn and keep the config.json / default value', () => {
    const dir = makeTempDir();
    writeConfig(dir, JSON.stringify({ port: 8080 }));
    const cfg = loadConfig(dir, { AUDIO_PIPE_MODE: 'warp' });
    expect(cfg.audioPipeMode).toBe('wasapi');
    expect(cfg.port).toBe(8080);
  });
});
