import { MathUtils } from 'three';

// Sheltered planting pockets, not an even ring of plants around the beach.
const POCKETS = [
  [-6.8, 0.1, 3.1, 3.8], [7.4, 0.4, 2.6, 3.5],
  [-4.7, -4.8, 4.0, 2.7], [3.8, -4.4, 4.3, 3.0],
  [-4.2, 2.8, 2.0, 1.6], [5.3, 1.9, 1.8, 1.5],
];

// Island-local coordinates: a broad sandy clearing from the shore end of the
// dock to the doorway. This only controls planting, never terrain or collision.
export const ARRIVAL_APPROACH = Object.freeze([
  Object.freeze([7.3, 5.7]), Object.freeze([4.8, 4.3]),
  Object.freeze([2.4, 2.8]), Object.freeze([0, 0.8]),
]);
export function arrivalPlantingWeight(x, z) {
  let distance = Infinity;
  for (let i = 1; i < ARRIVAL_APPROACH.length; i++) {
    const [ax, az] = ARRIVAL_APPROACH[i - 1], [bx, bz] = ARRIVAL_APPROACH[i];
    const dx = bx - ax, dz = bz - az;
    const t = MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return MathUtils.smoothstep(distance, 1.15, 2.1);
}
export function islandCover(x, z) {
  let cover = 0;
  const ripple = 0.13 * Math.sin(x * 2.1 + z * 1.4) + 0.08 * Math.cos(z * 3.2 - x);
  for (const [cx, cz, rx, rz] of POCKETS) {
    const distance = Math.hypot((x - cx) / rx, (z - cz) / rz);
    cover = Math.max(cover, 1 - MathUtils.smoothstep(distance + ripple, 0.42, 1.08));
  }
  // Preserve bare sand at the tide line and an open forecourt at the entrance.
  const coast = 1 - MathUtils.smoothstep(Math.hypot(x / 12, z / 9), 0.77, 0.92);
  const portal = Math.max(MathUtils.smoothstep(Math.abs(x), 1.4, 2.8), MathUtils.smoothstep(Math.abs(z), 1.8, 3.1));
  // Continue the central sandy passage behind the gate to the far shoreline.
  const center = 0.28 * Math.sin(-z * 0.55) * MathUtils.smoothstep(-z, 0, 2);
  const edgeDistance = Math.abs(x - center);
  const passage = z < 0 ? MathUtils.smoothstep(edgeDistance, 1.1, 1.85) : 1;
  const shoulder = MathUtils.smoothstep(-z, 1.2, 2.5)
    * (1 - MathUtils.smoothstep(edgeDistance + ripple, 2.1, 3.3));
  return Math.max(cover, shoulder * 0.72) * coast * portal * passage * arrivalPlantingWeight(x, z);
}
