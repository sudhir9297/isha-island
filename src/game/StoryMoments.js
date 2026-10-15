export const REST_SPOT = Object.freeze({x: 0, z: -18.2, radius: 1.35});
export const REVEAL_END = 8;
const smooth = value => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };
export function checkpointReveal(time, completed=false) {
  const start=completed?.55:2.2;
  const entering=smooth((time-start)/.8), leaving=smooth((time-6)/1.5);
  return {visible:time>=start&&time<7.5, opacity:entering*(1-leaving), scale:.94+.06*entering, blur:8*(1-entering)};
}
export function nearRestSpot(position) {
  return Math.hypot(position.x-REST_SPOT.x,position.z-REST_SPOT.z)<REST_SPOT.radius;
}

export const OVERLOOK_SEAT = Object.freeze({x:-2.25,z:REST_SPOT.z+.5});
export function hitsOverlookSeat(x,z) { return Math.abs(x-OVERLOOK_SEAT.x)<.85 && Math.abs(z-OVERLOOK_SEAT.z)<.46; }
