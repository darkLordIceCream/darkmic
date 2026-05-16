/**
 * Windows audio output via WinMM waveOut API.
 * Targets a specific audio device (VB-Cable) by name.
 *
 * Uses koffi (pure-JS FFI, no native build tools) to call
 * the WinMM API directly, avoiding FFmpeg WASAPI dependency.
 */

import koffi from 'koffi';
import { platform } from 'node:os';

const isWin32 = platform() === 'win32';

// ── Constants ────────────────────────────────────────────────────────

const WAVE_FORMAT_PCM = 1;
const CALLBACK_NULL = 0x00000000;
const WHDR_DONE = 0x00000001;
const MMSYSERR_NOERROR = 0;

const WAVEOUTCAPS_SIZE = 84;
const WAVEHDR_SIZE = 64;
const BUFFER_SIZE = 4800;   // 50ms at 48kHz 16-bit mono
const MAX_BUFFERS = 6;
const ACC_MAX = BUFFER_SIZE * MAX_BUFFERS; // cap accumulator to prevent unbounded growth

// ── WinMM bindings ───────────────────────────────────────────────────

let winmm: koffi.IKoffiLib | null = null;

function loadWinMM() {
  if (!isWin32) return null;
  if (winmm) return winmm;
  try {
    winmm = koffi.load('winmm.dll');
    return winmm;
  } catch {
    return null;
  }
}

// ── Device enumeration ───────────────────────────────────────────────

function waveOutGetNumDevs(): number {
  const lib = loadWinMM();
  if (!lib) return 0;
  return lib.func('waveOutGetNumDevs', 'uint', [])();
}

function getDeviceCaps(index: number): { name: string } | null {
  const lib = loadWinMM();
  if (!lib) return null;
  const caps = Buffer.alloc(WAVEOUTCAPS_SIZE);
  const fn = lib.func('waveOutGetDevCapsW', 'uint', ['uint', 'void *', 'uint']);
  const r = fn(index, caps, WAVEOUTCAPS_SIZE);
  if (r !== MMSYSERR_NOERROR) return null;
  // szPname at offset 8: 32 WCHARs, null-terminated
  let name = '';
  for (let i = 0; i < 32; i++) {
    const code = caps.readUInt16LE(8 + i * 2);
    if (code === 0) break;
    name += String.fromCharCode(code);
  }
  return { name };
}

// waveOutGetDevCapsW truncates names to 31 chars. Match against the start.
function findDeviceId(deviceName: string): { id: number; name: string } | null {
  const search = deviceName.toLowerCase();
  const count = waveOutGetNumDevs();
  for (let i = 0; i < count; i++) {
    const caps = getDeviceCaps(i);
    if (caps && search.startsWith(caps.name.toLowerCase())) {
      return { id: i, name: caps.name };
    }
  }
  return null;
}

export function checkVBCable(): boolean {
  return findDeviceId('CABLE Input (VB-Audio Virtual C') !== null;
}

// ── WAVEFORMATEX helper ──────────────────────────────────────────────

function createPcmFormat(sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const blockAlign = channels * (bitsPerSample / 8);
  const wfx = Buffer.alloc(18);
  wfx.writeUInt16LE(WAVE_FORMAT_PCM, 0);
  wfx.writeUInt16LE(channels, 2);
  wfx.writeUInt32LE(sampleRate, 4);
  wfx.writeUInt32LE(sampleRate * blockAlign, 8);
  wfx.writeUInt16LE(blockAlign, 12);
  wfx.writeUInt16LE(bitsPerSample, 14);
  return wfx;
}

// ── Types ────────────────────────────────────────────────────────────

export interface WasapiOutput {
  write(pcm: Buffer): void;
  close(): void;
}

// ── Implementation ───────────────────────────────────────────────────

export function createWasapiOutput(deviceName: string): WasapiOutput | null {
  if (!isWin32) {
    console.warn('[WasapiOutput] Only available on Windows');
    return null;
  }

  const lib = loadWinMM();
  if (!lib) {
    console.warn('[WasapiOutput] winmm.dll not available');
    return null;
  }

  const found = findDeviceId(deviceName);
  if (!found) {
    console.warn(`[WasapiOutput] Device not found: "${deviceName}"`);
    return null;
  }
  console.log(`[WasapiOutput] Found "${found.name}" (id=${found.id})`);

  // HWAVEOUT = handle value (int64), not a pointer
  const waveOutOpen = lib.func('waveOutOpen', 'uint',
    ['void *', 'uint', 'void *', 'int64', 'int64', 'uint']);
  const waveOutPrepareHeader = lib.func('waveOutPrepareHeader', 'uint',
    ['int64', 'void *', 'uint']);
  const waveOutWrite = lib.func('waveOutWrite', 'uint',
    ['int64', 'void *', 'uint']);
  const waveOutUnprepareHeader = lib.func('waveOutUnprepareHeader', 'uint',
    ['int64', 'void *', 'uint']);
  const waveOutReset = lib.func('waveOutReset', 'uint', ['int64']);
  const waveOutClose = lib.func('waveOutClose', 'uint', ['int64']);

  const wfx = createPcmFormat(48000, 1, 16);

  const hWaveOutBuf = Buffer.alloc(8);
  const result = waveOutOpen(hWaveOutBuf, found.id, wfx, 0, 0, CALLBACK_NULL);
  if (result !== MMSYSERR_NOERROR) {
    console.error(`[WasapiOutput] waveOutOpen failed: ${result}`);
    return null;
  }

  const hwo = hWaveOutBuf.readBigUInt64LE(0);

  // ── Buffer pool ──────────────────────────────────────────────────

  interface PoolEntry {
    data: Buffer;
    hdr: Buffer;
    busy: boolean;
  }

  const pool: PoolEntry[] = [];
  let closed = false;
  let byteCount = 0;
  let acc = Buffer.alloc(0);

  function recycleBuffers(): void {
    for (const entry of pool) {
      if (!entry.busy) continue;
      const flags = entry.hdr.readUInt32LE(24);
      if (flags & WHDR_DONE) {
        waveOutUnprepareHeader(hwo, entry.hdr, WAVEHDR_SIZE);
        entry.busy = false;
      }
    }
  }

  function getFreeEntry(): PoolEntry | null {
    recycleBuffers();

    for (const entry of pool) {
      if (!entry.busy) return entry;
    }

    if (pool.length < MAX_BUFFERS) {
      const data = Buffer.alloc(BUFFER_SIZE);
      const hdr = Buffer.alloc(WAVEHDR_SIZE);
      hdr.writeBigInt64LE(koffi.address(data), 0);
      hdr.writeUInt32LE(BUFFER_SIZE, 8);
      const entry: PoolEntry = { data, hdr, busy: false };
      pool.push(entry);
      return entry;
    }

    return null;
  }

  function submitEntry(entry: PoolEntry, byteLen: number): void {
    if (closed) return;
    entry.hdr.writeUInt32LE(byteLen, 8);
    entry.hdr.writeUInt32LE(0, 24);

    if (waveOutPrepareHeader(hwo, entry.hdr, WAVEHDR_SIZE) !== MMSYSERR_NOERROR) return;
    if (waveOutWrite(hwo, entry.hdr, WAVEHDR_SIZE) !== MMSYSERR_NOERROR) return;
    entry.busy = true;
    byteCount += byteLen;
  }

  function write(pcm: Buffer): void {
    if (closed) return;

    // Use growing buffer to avoid per-write Buffer.concat allocations
    const merged = Buffer.alloc(acc.length + pcm.length);
    acc.copy(merged);
    pcm.copy(merged, acc.length);
    acc = merged;

    while (acc.length >= BUFFER_SIZE) {
      const entry = getFreeEntry();
      if (!entry) {
        // Cap accumulator to prevent unbounded growth when buffers are starved
        if (acc.length > ACC_MAX) {
          acc = acc.subarray(acc.length - ACC_MAX);
        }
        return;
      }

      acc.subarray(0, BUFFER_SIZE).copy(entry.data);
      submitEntry(entry, BUFFER_SIZE);
      acc = acc.subarray(BUFFER_SIZE);
    }
  }

  function close(): void {
    if (closed) return;
    closed = true;

    if (acc.length > 0) {
      const entry = getFreeEntry();
      if (entry) {
        acc.copy(entry.data);
        submitEntry(entry, acc.length);
      }
    }

    setTimeout(() => {
      waveOutReset(hwo);
      waveOutUnprepareHeaders();
      waveOutClose(hwo);
      console.log(`[WasapiOutput] Closed — ${byteCount} bytes`);
    }, 500);
  }

  function waveOutUnprepareHeaders(): void {
    for (const entry of pool) {
      try { waveOutUnprepareHeader(hwo, entry.hdr, WAVEHDR_SIZE); } catch { /* ignore */ }
    }
  }

  return { write, close };
}
