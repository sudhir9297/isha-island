export const ROWING_RATE = 2.8;
export function rowingPose(time, active = true) {
  const phase=time*ROWING_RATE;
  return { sweep: active?Math.sin(phase)*.48:0, lift:active?Math.max(0,Math.cos(phase))*.22:0, pull:active?(1-Math.cos(phase))*.5:0 };
}
