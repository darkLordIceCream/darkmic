/**
 * F-009: PcmChunker tests — the pure accumulation/chunking logic
 * extracted from createWasapiOutput so the buffer behavior is
 * testable without Windows/WinMM.
 *
 * BUFFER_SIZE = 4800 (50ms @ 48kHz 16-bit mono), ACC_MAX = 28800.
 */

import { describe, expect, it } from 'vitest';
import { PcmChunker } from '../src/wasapi.js';

const BS = 4800; // BUFFER_SIZE — mirrored here to assert the chunking contract
const ACC_MAX = 28800; // 6 × 4800

function pcmOf(bytes: number): Buffer {
  return Buffer.alloc(bytes);
}

describe('PcmChunker', () => {
  it('holds a partial buffer below BUFFER_SIZE without emitting chunks', () => {
    const c = new PcmChunker();
    const chunks = c.push(pcmOf(BS - 100), 6);
    expect(chunks).toHaveLength(0);
    expect(c.pendingBytes).toBe(BS - 100);
  });

  it('emits exactly one chunk for an exact BUFFER_SIZE push', () => {
    const c = new PcmChunker();
    const chunks = c.push(pcmOf(BS), 6);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(BS);
    expect(c.pendingBytes).toBe(0);
  });

  it('chunks multi-buffer pushes and keeps the remainder', () => {
    const c = new PcmChunker();
    // 2.5 buffers with 6 free slots → 2 chunks + 0.5 buffer pending
    const chunks = c.push(pcmOf(BS * 2 + BS / 2), 6);
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) expect(chunk.length).toBe(BS);
    expect(c.pendingBytes).toBe(BS / 2);
  });

  it('respects freeSlots: emits no more chunks than the pool can take', () => {
    const c = new PcmChunker();
    const chunks = c.push(pcmOf(BS * 5), 2);
    expect(chunks).toHaveLength(2);
    expect(c.pendingBytes).toBe(BS * 3);
  });

  it('chunk contents match the pushed bytes in order', () => {
    const c = new PcmChunker();
    const input = Buffer.alloc(BS * 2);
    input.fill(0x11, 0, BS);
    input.fill(0x22, BS);

    const chunks = c.push(input, 6);
    expect(chunks).toHaveLength(2);
    expect(chunks[0][0]).toBe(0x11);
    expect(chunks[0][BS - 1]).toBe(0x11);
    expect(chunks[1][0]).toBe(0x22);
    expect(chunks[1][BS - 1]).toBe(0x22);
  });

  it('caps the accumulator at ACC_MAX when starved, dropping oldest audio', () => {
    const c = new PcmChunker();
    // First push with free slots: 20000 bytes stay pending (below cap)
    c.push(pcmOf(20000), 0);
    expect(c.pendingBytes).toBe(20000);
    expect(c.starvedBytes).toBe(0);

    // Second push while still starved: 40000 total > ACC_MAX → oldest 11200 dropped
    c.push(pcmOf(20000), 0);
    expect(c.pendingBytes).toBe(ACC_MAX);
    expect(c.starvedBytes).toBe(40000 - ACC_MAX);
  });

  it('flush() returns the pending remainder and empties the accumulator', () => {
    const c = new PcmChunker();
    c.push(pcmOf(1000), 6);
    const rest = c.flush();
    expect(rest).not.toBeNull();
    expect(rest!.length).toBe(1000);
    expect(c.pendingBytes).toBe(0);
    expect(c.flush()).toBeNull();
  });

  it('resumes chunking normally after starvation', () => {
    const c = new PcmChunker();
    c.push(pcmOf(ACC_MAX + 100), 0); // starved, capped to ACC_MAX
    // Two fresh buffers with 2 free slots: 28800 + 9600 = 38400 total,
    // extract 9600 → exactly ACC_MAX remains (== ACC_MAX is not > ACC_MAX,
    // so no further cap). Chunking resumes normally.
    const chunks = c.push(pcmOf(BS * 2), 2);
    expect(chunks).toHaveLength(2);
    expect(c.pendingBytes).toBe(ACC_MAX);
  });
});
