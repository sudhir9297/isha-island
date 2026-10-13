import { SHORE } from "./WorldConfig.js";

export function islandCollision(position, radius = 0.7) {
  const x = position.x ?? position[0],
    z = position.z ?? position[2];
  return (
    ((x - SHORE.x) / (SHORE.radiusX + radius)) ** 2 +
      ((z - SHORE.z) / (SHORE.radiusZ + radius)) ** 2 < 1
  );
}
