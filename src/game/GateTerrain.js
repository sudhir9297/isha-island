// Coordinates are local to the island, whose world Z is -12.
export const GATE = Object.freeze({ x: 0, z: 0, floor: 2.35 });
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function gateTerrainHeight(x, z, beachHeight) {
  const distance = Math.hypot((x - GATE.x) / 10.4, (z - GATE.z) / 8.0);
  const hill = 1 - smooth(0.34, 1, distance);
  // Broad, uneven dune shoulders fade out at both the gate pad and tide line.
  const shoulder = hill * (1 - hill);
  const relief = shoulder * (0.65 * Math.sin(x * 0.55 + z * 0.24) + 0.38 * Math.cos(z * 0.8 - x * 0.18));
  return Math.max(beachHeight, beachHeight + (GATE.floor - beachHeight) * hill + relief);
}
