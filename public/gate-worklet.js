/**
 * F-011: simple RMS noise gate as an AudioWorklet processor.
 *
 * k-rate `threshold` parameter (dBFS). Frames above threshold open the
 * gate immediately; after the last open frame it stays open for 250ms
 * (hold), then mutes. Mono-oriented (darkmic captures channelCount 1).
 */

class NoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'threshold',
        defaultValue: -50,
        minValue: -100,
        maxValue: 0,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.open = false;
    this.holdSamples = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const ch = input[0];
    const out = output[0];
    const n = ch.length;

    let sum = 0;
    for (let i = 0; i < n; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / n);
    const db = 20 * Math.log10(Math.max(rms, 1e-10));

    if (db > parameters.threshold[0]) {
      this.open = true;
      this.holdSamples = sampleRate * 0.25;
    } else if (this.holdSamples > 0) {
      this.holdSamples -= n;
    } else {
      this.open = false;
    }

    if (this.open && out.length === n) {
      out.set(ch);
    } else if (this.open) {
      for (let i = 0; i < out.length; i++) out[i] = ch[i % n];
    } else {
      out.fill(0);
    }
    return true;
  }
}

registerProcessor('noise-gate', NoiseGate);
