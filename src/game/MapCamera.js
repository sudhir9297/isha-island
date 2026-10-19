export const MAP_TRANSITION_SECONDS = 2;
const clamp = value => Math.max(0, Math.min(1, value));
// Quintic easing has zero velocity and acceleration at both ends. Unlike an
// exponential chase it starts gently and reaches a definite resting pose.
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
export function createMapTransition() {
  return { value: 0, from: 0, goal: 0, elapsed: MAP_TRANSITION_SECONDS };
}
export function stepMapTransition(state, open, delta, reducedMotion = false) {
  const goal = open ? 1 : 0;
  if (goal !== state.goal) {
    state.from = state.value;
    state.goal = goal;
    state.elapsed = 0;
  }
  if (reducedMotion) {
    state.value = goal;
    state.elapsed = MAP_TRANSITION_SECONDS;
  } else {
    state.elapsed = Math.min(MAP_TRANSITION_SECONDS, state.elapsed + Math.min(.1, Math.max(0, delta)));
    const progress = ease(clamp(state.elapsed / MAP_TRANSITION_SECONDS));
    state.value = state.from + (goal - state.from) * progress;
    if (state.elapsed >= MAP_TRANSITION_SECONDS - 1e-9) state.value = goal;
  }
  return state.value;
}
// Delay the center shift relative to scale, then catch up. On the return trip
// this recenters on the traveler before the close view comes back into focus.
export function mapFocusBlend(value) { return value * value * (2 - value); }
export function blendMapZoom(followZoom, width, height, span, blend) {
  const mapZoom = Math.min(width * .84, height * .72) / span;
  return Math.exp(Math.log(followZoom) * (1 - blend) + Math.log(mapZoom) * blend);
}
