export const NEEM_ISLAND = Object.freeze({ x: 65, z: -48, radiusX: 8, radiusZ: 6 });
export function neemShoreRadius(a) {
  return 1 + .055 * Math.sin(a * 3 + .4) + .025 * Math.cos(a * 5);
}
export function neemRadiusAt(x, z) {
  const u = (x - NEEM_ISLAND.x) / NEEM_ISLAND.radiusX, v = (z - NEEM_ISLAND.z) / NEEM_ISLAND.radiusZ;
  return Math.hypot(u, v) / neemShoreRadius(Math.atan2(v, u));
}
export function neemTerrainHeight(x, z) {
  const r = neemRadiusAt(x, z);
  const t = Math.max(0, Math.min(1, (r - .45) / .55));
  if (r <= 1) return .035 + .525 * (1 - t * t * (3 - 2 * t));
  if (r <= 1.08) return .035 - .25 * ((r - 1) / .08);
  const s = Math.min(1, (r - 1.08) / .85);
  return -2.4 + 2.185 * (2 * s ** 3 - 3 * s ** 2 + 1) - (.25 / .08) * .85 * (s ** 3 - 2 * s ** 2 + s);
}
export function hitsNeemProps(x, z) {
  const u = x - NEEM_ISLAND.x, v = z - NEEM_ISLAND.z;
  return Math.hypot(u + .8, v + .65) < .72 || (Math.abs(u - 2.2) < 1.4 && Math.abs(v - .6) < .65);
}
