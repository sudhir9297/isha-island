// Deterministic synthesis also lets the circular waveform be checked without Web Audio.
export function createSurfSamples(sampleRate, duration = 24, seed = 71943) {
  const length = Math.round(sampleRate * duration);
  const overlap = Math.min(Math.round(sampleRate * 2), Math.floor(length / 4));
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
  const noise = () => {
    let low = 0;
    let body = 0;
    let air = 0;
    return () => {
      const white = random();
      low = low * 0.996 + white * 0.004;
      body = body * 0.92 + white * 0.08;
      air = air * 0.35 + white * 0.65;
      return low * 2.8 + body * 0.8 + air * 0.12;
    };
  };
  const mid = noise();
  const left = noise();
  const right = noise();
  for (let i = 0; i < 4096; i++) { mid(); left(); right(); }
  const raw = [new Float32Array(length + overlap), new Float32Array(length + overlap)];
  for (let i = 0; i < length + overlap; i++) {
    const shared = mid() * 0.72;
    raw[0][i] = shared + left() * 0.28;
    raw[1][i] = shared + right() * 0.28;
  }
  const channels = raw.map((channel) => {
    const output = new Float32Array(length);
    let sum = 0;
    for (let i = 0; i < length; i++) {
      // Start at the continuation of the tail, then blend into the original head.
      const blend = i < overlap ? Math.sin((i / overlap) * Math.PI / 2) ** 2 : 1;
      const circular = i < overlap
        ? channel[length + i] * (1 - blend) + channel[i] * blend
        : channel[i];
      const phase = (i / length) * Math.PI * 2;
      const swell = 0.56 + 0.2 * Math.sin(phase * 3)
        + 0.13 * Math.sin(phase * 5 + 1.1) + 0.07 * Math.sin(phase * 7 - 0.4);
      output[i] = circular * swell;
      sum += output[i];
    }
    const mean = sum / length;
    for (let i = 0; i < length; i++) output[i] -= mean;
    return output;
  });
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  }
  const scale = peak > 0 ? 0.72 / peak : 0;
  for (const channel of channels) {
    for (let i = 0; i < length; i++) channel[i] *= scale;
  }
  return channels;
}
