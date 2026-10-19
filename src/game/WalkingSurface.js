import { worldCoastalRadiusAt } from './Seabed.js';
import { islandGroundAt } from './IslandGround.js';
import { gateGround } from './MalaiVasalGeometry.js';

export const DOCK = Object.freeze({ x: 7, z: -4.85, rotation: -0.16,
  halfWidth: 1.08, start: -1.77, end: 6.02, deckHeight: 0.595 });
const cos = Math.cos(DOCK.rotation), sin = Math.sin(DOCK.rotation);
export function dockWorldPoint(x, z) {
  return { x: DOCK.x + cos * x + sin * z, z: DOCK.z - sin * x + cos * z };
}
export function dockSurfaceHeight(x, z) {
  const dx = x - DOCK.x, dz = z - DOCK.z;
  const across = cos * dx - sin * dz, along = sin * dx + cos * dz;
  // Keep feet inside the rope rails and leave a small margin at the last plank.
  if (Math.abs(across) > DOCK.halfWidth || along < DOCK.start || along > DOCK.end) return null;
  if (along >= -0.275) return DOCK.deckHeight;
  const landing = dockWorldPoint(0, Math.max(-1.65, along));
  const landingHeight = Math.max(0.53, gateGround(landing.x, landing.z + 12) + 0.09) + 0.07;
  const blend = Math.max(0, Math.min(1, (-along - 0.275) / 0.125));
  return DOCK.deckHeight + (landingHeight - DOCK.deckHeight) * blend;
}
export function walkingSurfaceHeight(x, z) {
  const dock = dockSurfaceHeight(x, z);
  const land = worldCoastalRadiusAt(x, z) < 0.97 ? islandGroundAt(x, z) : null;
  if (dock === null) return land;
  return land === null ? dock : Math.max(dock, land);
}
