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

export interface WasapiStats {
  /** Bytes successfully written to the device so far */
  submittedBytes: number;
  /** Bytes held in the accumulator, not yet submitted */
  pendingBytes: number;
  /** Bytes dropped by the starvation cap (oldest audio first) */
  starvedBytes: number;
}

export interface WasapiOutput {
  write(pcm: Buffer): void;
  close(): void;
  /** Buffer telemetry for dashboards/tests (no WinMM calls). */
  stats(): WasapiStats;
}

// ── PCM chunking (pure logic, unit-testable on any platform) ─────────

/**
 * Accumulates incoming PCM and slices it into fixed-size buffers ready
 * for waveOut submission. Extracted from createWasapiOutput (F-009) so
 * the buffer behavior (watermark, starvation cap) is unit-testable
 * without Windows/WinMM.
 *
 * Starvation policy: when the device has no free pool slots and the
 * accumulator exceeds ACC_MAX bytes, the OLDEST audio is dropped first —
 * latency stays bounded instead of growing without limit. Accepted risk
 * (progress.md 2026-05-16): the drop can cause an audible pop.
 */
export class PcmChunker {
  private acc = Buffer.alloc(0);
  private droppedBytes = 0;

  /**
   * Append PCM and extract up to `freeSlots` full buffers.
   * Returns zero-copy views into an internal buffer that stay valid
   * until the next push() — callers must copy synchronously (as
   * createWasapiOutput does into its pool entries).
   */
  push(pcm: Buffer, freeSlots: number): Buffer[] {
    const merged = Buffer.alloc(this.acc.length + pcm.length);
    this.acc.copy(merged);
    pcm.copy(merged, this.acc.length);
    this.acc = merged;

    const chunks: Buffer[] = [];
    while (this.acc.length >= BUFFER_SIZE && chunks.length < freeSlots) {
      chunks.push(this.acc.subarray(0, BUFFER_SIZE));
      this.acc = this.acc.subarray(BUFFER_SIZE);
    }

    // Starved (no free slots) with audio still pending: cap the
    // accumulator by dropping the oldest bytes.
    if (this.acc.length > ACC_MAX) {
      const drop = this.acc.length - ACC_MAX;
      this.droppedBytes += drop;
      this.acc = this.acc.subarray(this.acc.length - ACC_MAX);
    }

    return chunks;
  }

  /** Bytes currently held in the accumulator (partial buffer awaiting more PCM). */
  get pendingBytes(): number {
    return this.acc.length;
  }

  /** Total bytes dropped by the starvation cap since creation. */
  get starvedBytes(): number {
    return this.droppedBytes;
  }

  /** Take the pending partial buffer (for flushing on close). */
  flush(): Buffer | null {
    if (this.acc.length === 0) return null;
    const rest = this.acc;
    this.acc = Buffer.alloc(0);
    return rest;
  }
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
  const chunker = new PcmChunker();
  let closed = false;
  let byteCount = 0;

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

    // Failures here used to be silent returns (accepted risk, F-009 review):
    // a device in a bad state made audio vanish with no trace in the log.
    let r = waveOutPrepareHeader(hwo, entry.hdr, WAVEHDR_SIZE);
    if (r !== MMSYSERR_NOERROR) {
      console.error(`[WasapiOutput] waveOutPrepareHeader failed: MMRESULT=${r} — buffer dropped`);
      return;
    }
    r = waveOutWrite(hwo, entry.hdr, WAVEHDR_SIZE);
    if (r !== MMSYSERR_NOERROR) {
      console.error(`[WasapiOutput] waveOutWrite failed: MMRESULT=${r} — buffer dropped`);
      return;
    }
    entry.busy = true;
    byteCount += byteLen;
  }

  function freeSlotCount(): number {
    recycleBuffers();
    let free = pool.filter((e) => !e.busy).length;
    if (pool.length < MAX_BUFFERS) free += MAX_BUFFERS - pool.length;
    return free;
  }

  function write(pcm: Buffer): void {
    if (closed) return;

    // Chunker owns the accumulator: merge, slice into fixed buffers,
    // cap growth when the pool is starved (drops oldest audio).
    const chunks = chunker.push(pcm, freeSlotCount());
    for (const chunk of chunks) {
      const entry = getFreeEntry();
      if (!entry) break; // defensive — slots were counted this same tick
      chunk.copy(entry.data);
      submitEntry(entry, chunk.length);
    }
  }

  function stats(): WasapiStats {
    return {
      submittedBytes: byteCount,
      pendingBytes: chunker.pendingBytes,
      starvedBytes: chunker.starvedBytes,
    };
  }

  function close(): void {
    if (closed) return;
    closed = true;

    const rest = chunker.flush();
    if (rest) {
      const entry = getFreeEntry();
      if (entry) {
        rest.copy(entry.data);
        submitEntry(entry, rest.length);
      }
    }

    setTimeout(() => {
      waveOutReset(hwo);
      waveOutUnprepareHeaders();
      waveOutClose(hwo);
      console.log(
        `[WasapiOutput] Closed — ${byteCount} bytes` +
          (chunker.starvedBytes > 0 ? `, ${chunker.starvedBytes} dropped by starvation cap` : ''),
      );
    }, 500);
  }

  function waveOutUnprepareHeaders(): void {
    for (const entry of pool) {
      try { waveOutUnprepareHeader(hwo, entry.hdr, WAVEHDR_SIZE); } catch { /* ignore */ }
    }
  }

  return { write, close, stats };
}
