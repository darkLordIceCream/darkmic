/**
 * Optional config.json support (F-009).
 *
 * Loads configuration from config.json located next to the executable
 * (project root in dev). Environment variables take precedence over
 * config.json values. Invalid values produce a clear warning and fall
 * back to the documented default — the server always starts.
 *
 * Schema (all keys optional):
 * {
 *   "port": 3000,
 *   "audioPipeMode": "wasapi" | "ffplay" | "file",
 *   "initialBitrate": 32000
 * }
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AudioPipeMode } from './audio.js';

// ── Defaults & bounds ───────────────────────────────────────────────

const DEFAULT_PORT = 3000;
const DEFAULT_AUDIO_PIPE_MODE: AudioPipeMode = 'wasapi';
const DEFAULT_INITIAL_BITRATE = 32000;

const AUDIO_PIPE_MODES: readonly AudioPipeMode[] = ['file', 'ffplay', 'wasapi'];

const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_BITRATE = 16000;
const MAX_BITRATE = 128000;

export interface DarkmicConfig {
  port: number;
  audioPipeMode: AudioPipeMode;
  /** Starting opus bitrate for the phone encoder, in bps */
  initialBitrate: number;
}

// ── Validation helpers ──────────────────────────────────────────────

function isAudioPipeMode(value: unknown): value is AudioPipeMode {
  return typeof value === 'string' && (AUDIO_PIPE_MODES as readonly string[]).includes(value);
}

function parsePort(value: unknown, source: string): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < MIN_PORT || n > MAX_PORT) {
    console.warn(
      `[Config] Invalid port ${JSON.stringify(value)} in ${source} — must be an integer ${MIN_PORT}-${MAX_PORT}, ignoring`,
    );
    return null;
  }
  return n;
}

function parseBitrate(value: unknown, source: string): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_BITRATE || value > MAX_BITRATE) {
    console.warn(
      `[Config] Invalid initialBitrate ${JSON.stringify(value)} in ${source} — must be ${MIN_BITRATE}-${MAX_BITRATE} bps, ignoring`,
    );
    return null;
  }
  return Math.round(value);
}

// ── Loader ──────────────────────────────────────────────────────────

/**
 * Load config.json (optional file), apply env overrides, validate.
 * Never throws: a missing file is silent (config is optional); a
 * malformed or invalid value warns and falls back to the default.
 *
 * Precedence: defaults ← config.json ← environment variables.
 */
export function loadConfig(appRootDir: string, env: NodeJS.ProcessEnv = process.env): DarkmicConfig {
  let port = DEFAULT_PORT;
  let audioPipeMode = DEFAULT_AUDIO_PIPE_MODE;
  let initialBitrate = DEFAULT_INITIAL_BITRATE;

  // 1. config.json (optional)
  const configPath = join(appRootDir, 'config.json');
  let raw: Record<string, unknown> | null = null;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch (err: unknown) {
    // Missing file is normal; anything else (bad JSON, permissions) warns.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Config] Failed to read ${configPath}: ${msg} — using defaults`);
    }
  }

  if (raw) {
    console.log(`[Config] Loaded ${configPath}`);
    const p = parsePort(raw['port'], 'config.json');
    if (p !== null) port = p;
    if (raw['audioPipeMode'] !== undefined) {
      if (isAudioPipeMode(raw['audioPipeMode'])) {
        audioPipeMode = raw['audioPipeMode'];
      } else {
        console.warn(
          `[Config] Invalid audioPipeMode ${JSON.stringify(raw['audioPipeMode'])} in config.json — must be one of ${AUDIO_PIPE_MODES.join('|')}, using default "${DEFAULT_AUDIO_PIPE_MODE}"`,
        );
      }
    }
    const b = parseBitrate(raw['initialBitrate'], 'config.json');
    if (b !== null) initialBitrate = b;
  }

  // 2. Environment overrides
  if (env.PORT !== undefined) {
    const p = parsePort(env.PORT, 'PORT env');
    if (p !== null) port = p;
  }
  if (env.AUDIO_PIPE_MODE !== undefined) {
    if (isAudioPipeMode(env.AUDIO_PIPE_MODE)) {
      audioPipeMode = env.AUDIO_PIPE_MODE;
    } else {
      console.warn(
        `[Config] Invalid AUDIO_PIPE_MODE "${env.AUDIO_PIPE_MODE}" — must be one of ${AUDIO_PIPE_MODES.join('|')}, using "${audioPipeMode}"`,
      );
    }
  }

  return { port, audioPipeMode, initialBitrate };
}
