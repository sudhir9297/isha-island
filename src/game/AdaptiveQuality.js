export function createQualityMonitor() {
  return {warmup: 4, cooldown: 0, elapsed: 0, frames: 0, slow: 0, bad: 0, good: 0};
}
export function resetQualityWindow(state) {
  state.elapsed = 0; state.frames = 0; state.slow = 0; state.bad = 0; state.good = 0;
}
export function sampleQuality(state, delta, quality) {
  if (!Number.isFinite(delta) || delta <= 0 || delta > .25) {
    resetQualityWindow(state); return null;
  }
  if (state.warmup > 0) { state.warmup -= delta; return null; }
  if (state.cooldown > 0) { state.cooldown -= delta; return null; }
  state.elapsed += delta; state.frames++; if (delta > .025) state.slow++;
  if (state.elapsed < 6) return null;
  const mean = state.elapsed / state.frames, slowFraction = state.slow / state.frames;
  state.bad = mean > .025 && slowFraction > .3 ? state.bad + 1 : 0;
  // Only restore high when there is substantial headroom, not just a brief 60 FPS spike.
  state.good = mean < .014 && slowFraction < .02 ? state.good + 1 : 0;
  state.elapsed = 0; state.frames = 0; state.slow = 0;
  const next = quality === 'high' && state.bad >= 2 ? 'balanced'
    : quality === 'balanced' && state.good >= 3 ? 'high' : null;
  if (next) { resetQualityWindow(state); state.cooldown = 30; }
  return next;
}
