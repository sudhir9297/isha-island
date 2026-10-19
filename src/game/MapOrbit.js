export function createMapOrbit() { return { yaw: 0, targetYaw: 0 }; }
export function turnMapOrbit(state, radians) {
  state.targetYaw = Math.max(-Math.PI, Math.min(Math.PI, state.targetYaw + radians));
}
export function stepMapOrbit(state, delta, reducedMotion = false) {
  state.yaw += (state.targetYaw - state.yaw) * (reducedMotion ? 1 : -Math.expm1(-12 * Math.min(.1, Math.max(0, delta))));
  return state.yaw;
}

export function resetMapOrbit(state, immediate = false) {
  state.targetYaw = 0;
  if (immediate) state.yaw = 0;
}
