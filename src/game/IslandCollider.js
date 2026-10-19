import { neemRadiusAt } from './NeemTerrain.js';
import { adiyogiRadiusAt } from "./AdiyogiTerrain.js";
import { SHORE } from "./WorldConfig.js";

export function islandCollision(position, radius = 0.7) {
  const x = position.x ?? position[0],
    z = position.z ?? position[2];
  return (
    ((x - SHORE.x) / (SHORE.radiusX + radius)) ** 2 +
      ((z - SHORE.z) / (SHORE.radiusZ + radius)) ** 2 < 1 || adiyogiRadiusAt(x, z) < 1.06 + radius / 22 || neemRadiusAt(x, z) < 1.06 + radius / 6
  );
}
