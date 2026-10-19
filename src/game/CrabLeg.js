import { Vector3 } from 'three';

export const CRAB_UPPER_LEG = .16;
export const CRAB_LOWER_LEG = .17;

// Reuse the vectors for all eight legs. Unreachable ground leaves a foot in
// the air rather than changing the animal's limb lengths at a ledge.
export function createCrabLegSolver() {
  const hip = new Vector3(), foot = new Vector3(), knee = new Vector3();
  const axis = new Vector3(), bend = new Vector3();
  return (hx, hy, hz, fx, fy, fz, side) => {
    hip.set(hx, hy, hz);
    axis.set(fx-hx, fy-hy, fz-hz);
    const distance = Math.max(.011, Math.min(CRAB_UPPER_LEG + CRAB_LOWER_LEG - .001, axis.length()));
    if (axis.lengthSq() < 1e-12) axis.set(side, 0, 0);
    else axis.normalize();
    foot.copy(hip).addScaledVector(axis, distance);
    // Bend outward and upward, projected perpendicular to the hip-foot axis.
    bend.set(side, 1, 0).addScaledVector(axis, -axis.dot(bend));
    if (bend.lengthSq() < 1e-8) bend.set(0,0,1).addScaledVector(axis,-axis.z);
    bend.normalize();
    const along = (CRAB_UPPER_LEG ** 2 - CRAB_LOWER_LEG ** 2 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, CRAB_UPPER_LEG ** 2 - along ** 2));
    knee.copy(hip).addScaledVector(axis, along).addScaledVector(bend, height);
    return { hip, knee, foot };
  };
}
