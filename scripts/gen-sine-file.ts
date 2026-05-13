#!/usr/bin/env tsx
// Generate sine wave PCM file for external playback testing
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rate = 48000;
const sec = 2;
const samples = new Int16Array(rate * sec);
for (let i = 0; i < samples.length; i++) {
  samples[i] = Math.round(32767 * 0.3 * Math.sin(2 * Math.PI * 440 * i / rate));
}
const out = resolve('sine-test.pcm');
writeFileSync(out, Buffer.from(samples.buffer));
console.log(`Wrote ${(samples.length * 2 / 1024).toFixed(1)} KB PCM to ${out}`);
