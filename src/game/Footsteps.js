import { RUN_CYCLE_DISTANCE } from './TravelerRun.js';
import { WALK_PHASE_PER_METER } from './TravelerGait.js';
// Match the two alternating footfalls to the distance-driven leg animation.
export function crossedFootfall(before, after, running = false) {
  const phasePerMeter = running ? 2*Math.PI/RUN_CYCLE_DISTANCE : WALK_PHASE_PER_METER;
  return after > before && Math.floor(after * phasePerMeter / Math.PI) > Math.floor(before * phasePerMeter / Math.PI);
}
export function footstepSamples(sampleRate, burdened) {
  const duration = burdened ? .23 : .14;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 813, low = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296 * 2 - 1;
    low += (noise - low) * .12;
    const attack = Math.min(1, t / .008);
    const sand = low * Math.exp(-t * (burdened ? 24 : 38));
    const weight = Math.sin(t * Math.PI * 2 * 95) * Math.exp(-t * 45) * (burdened ? .18 : .06);
    const rustle = burdened ? noise * .06 * Math.exp(-Math.pow((t - .095) / .035, 2)) : 0;
    const fade = Math.min(1, (duration - t) / .02);
    samples[i] = (sand + weight + rustle) * attack * fade;
  }
  return samples;
}
