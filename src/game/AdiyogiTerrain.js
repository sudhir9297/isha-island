// Provisional island scale; researched dimensions and assumptions are in docs/adiyogi-island.md.
export const ADIYOGI_ISLAND = Object.freeze({ x: 130, z: -84, radiusX: 30, radiusZ: 22 });
export const WORLD_LIMIT = 200;
export const MAP_FRAME = Object.freeze({ x: 65, z: -48, span: 210 });
const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function adiyogiShoreRadius(angle) {
  return 1 + .035 * Math.sin(angle * 3 + .4) + .018 * Math.cos(angle * 5 - .6);
}
export function adiyogiRadiusAt(x, z) {
  const u = (x - ADIYOGI_ISLAND.x) / ADIYOGI_ISLAND.radiusX;
  const v = (z - ADIYOGI_ISLAND.z) / ADIYOGI_ISLAND.radiusZ;
  return Math.hypot(u, v) / adiyogiShoreRadius(Math.atan2(v, u));
}
export function adiyogiTerrainHeight(x, z) {
  const r = adiyogiRadiusAt(x, z);
  // A broad level clearing, a gently sloping beach, and a submerged sand shelf.
  if (r <= 1) return .035 + .565 * (1 - smooth(.58, 1, r));
  if (r <= 1.08) return .035 - .37 * ((r - 1) / .08);
  const t = Math.min(1, (r - 1.08) / .3);
  return -2.4 + 2.065 * (2 * t ** 3 - 3 * t ** 2 + 1)
    - (.37 / .08) * .3 * (t ** 3 - 2 * t ** 2 + t);
}
