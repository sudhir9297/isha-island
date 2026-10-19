export const SHELL_REVEAL_DURATION = .9;
export function createShellReveal(journey) {
  return { revealed: journey.shellRevealed, resetId: journey.resetId, time: SHELL_REVEAL_DURATION };
}
// Return an event only on a live reveal, never when loading an existing discovery.
export function stepShellReveal(state, journey, delta, paused, reducedMotion) {
  if (state.resetId !== journey.resetId) Object.assign(state, createShellReveal(journey));
  if (paused) return false;
  const appeared = journey.shellRevealed && !state.revealed;
  if (appeared) state.time = 0;
  state.revealed = journey.shellRevealed;
  state.time = reducedMotion ? SHELL_REVEAL_DURATION : Math.min(SHELL_REVEAL_DURATION, state.time + Math.max(0, Math.min(delta, .05)));
  return appeared;
}
export function shellRevealPose(time) {
  const t = Math.max(0, Math.min(1, time / SHELL_REVEAL_DURATION));
  return { height: .38 * Math.abs(Math.sin(t * Math.PI * 2)) * (1-t), scale: .65 + .35 * Math.min(1,t*4), burst: t < .72 ? 1-t/.72 : 0 };
}
