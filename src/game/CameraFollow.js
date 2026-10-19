import { Vector3 } from 'three';

// Bruno's focus-point / eased-zoom approach, tuned to Port's world scale.
export const FOLLOW = Object.freeze({ walkingHeight: 13, sailingHeight: 26, focusRate: 10, zoomRate: 5, minZoom: 0.55, maxZoom: 1.8 });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const ease = (rate, dt) => -Math.expm1(-rate * Math.max(0, dt));
const smoothstep = (n) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
const ARRIVAL_LANDMARK = new Vector3(0, 3.6, -12);

// Only the sea-facing approach to Malai Vasal needs extra context. Ease back
// before the doorway, and leave the other islands and open sea alone.
function arrivalWeight(position) {
  return (1 - smoothstep((Math.abs(position.x) - 10) / 8))
    * smoothstep((position.z + 11) / 5)
    * (1 - smoothstep((position.z - 2) / 10));
}

export function createCameraFollow() {
  return { target: new Vector3(), focus: new Vector3(), viewHeight: FOLLOW.sailingHeight, zoom: 1, resetId: null, initialized: false };
}

export function changeFollowZoom(state, amount) {
  state.zoom = clamp(state.zoom * Math.exp(amount), FOLLOW.minZoom, FOLLOW.maxZoom);
}

export function stepCameraFollow(state, { position, aboard, speed = 0, resetId = 0, reducedMotion = false, arrival = false }, dt) {
  const context = arrival ? arrivalWeight(position) : 0;
  const normalHeight = aboard ? FOLLOW.sailingHeight : FOLLOW.walkingHeight;
  const approachHeight = aboard ? 29 : clamp(Math.hypot(position.x, position.z + 12) * 1.9 + 4, normalHeight, 28);
  const baseHeight = normalHeight + context * (approachHeight - normalHeight);
  (state.focus ??= new Vector3()).copy(position).lerp(ARRIVAL_LANDMARK, context * (aboard ? .24 : .34));
  const speedRatio = smoothstep(speed / (aboard ? 9 : 4.4));
  const height = baseHeight * (1 + (reducedMotion ? 0 : speedRatio * 0.22)) / state.zoom;
  if (!state.initialized || state.resetId !== resetId) {
    state.target.copy(state.focus);
    state.viewHeight = height;
    state.initialized = true;
  } else {
    state.target.lerp(state.focus, reducedMotion ? 1 : ease(FOLLOW.focusRate, dt));
    state.viewHeight += (height - state.viewHeight) * ease(FOLLOW.zoomRate, dt);
  }
  state.resetId = resetId;
  return state;
}
