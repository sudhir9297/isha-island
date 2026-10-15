const clamp = v => Math.max(-1, Math.min(1, v));
export const WALK_PHASE_PER_METER = 5.6;
export const WALK_HIP_HEIGHT = .70;
const halfStep = Math.PI / WALK_PHASE_PER_METER / 2;

// During stance the foot travels back by exactly the distance the player moves.
// The return curve matches that velocity at both contacts, avoiding a foot snap.
export function travelerLegPose(phase, weight, out = {}) {
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  const swing = cycle >= .5;
  const t = (swing ? cycle - .5 : cycle) * 2;
  const z = halfStep * (swing ? 1 + 2*t - 12*t*t + 8*t*t*t : -1 + 2*t) * weight;
  const lift = swing ? Math.sin(Math.PI*t)**2 * .075 * weight : 0;
  const down = .59 - lift;
  const distance = Math.min(.669, Math.hypot(z, down));
  out.hip = Math.atan2(-z, down) + Math.acos(clamp((.33*.33 + distance*distance - .34*.34) / (.66*distance)));
  out.knee = -(Math.PI - Math.acos(clamp((.33*.33 + .34*.34 - distance*distance) / (2*.33*.34))));
  out.footPitch = swing ? .12 * Math.sin(Math.PI*2*t) * weight : 0;
  out.ankle = out.footPitch - out.hip - out.knee;
  out.lift = lift;
  return out;
}

export function travelerUpperPose(phase, weight, burdened = false, out = {}) {
  out.bob = (1-Math.cos(phase*2)) * .009 * weight;
  out.sway = Math.sin(phase) * .022 * weight;
  out.twist = Math.sin(phase) * .035 * weight;
  out.arm = -Math.cos(phase) * (burdened ? .075 : .23) * weight;
  out.elbow = .12 + (1-Math.cos(phase)) * .035 * weight;
  return out;
}
