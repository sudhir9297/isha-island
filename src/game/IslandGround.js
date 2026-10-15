import { gateGround } from './MalaiVasalGeometry.js';
import { coastalRadiusAt } from './Seabed.js';
import { ADIYOGI_ISLAND, adiyogiRadiusAt, adiyogiTerrainHeight } from './AdiyogiTerrain.js';
export function islandCenterAt(x, z) {
  return adiyogiRadiusAt(x, z) < coastalRadiusAt(x, z) ? ADIYOGI_ISLAND : { x: 0, z: -12 };
}
export function islandGroundAt(x, z) {
  return islandCenterAt(x, z) === ADIYOGI_ISLAND ? adiyogiTerrainHeight(x, z) : gateGround(x, z + 12);
}
