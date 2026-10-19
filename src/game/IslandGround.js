import { NEEM_ISLAND, neemRadiusAt, neemTerrainHeight } from './NeemTerrain.js';
import { gateGround } from './MalaiVasalGeometry.js';
import { coastalRadiusAt } from './Seabed.js';
import { ADIYOGI_ISLAND, adiyogiRadiusAt, adiyogiTerrainHeight } from './AdiyogiTerrain.js';
export function islandCenterAt(x, z) {
  if (neemRadiusAt(x, z) < Math.min(adiyogiRadiusAt(x, z), coastalRadiusAt(x, z))) return NEEM_ISLAND;
  return adiyogiRadiusAt(x, z) < coastalRadiusAt(x, z) ? ADIYOGI_ISLAND : { x: 0, z: -12 };
}
export function islandGroundAt(x, z) {
  if (islandCenterAt(x, z) === NEEM_ISLAND) return neemTerrainHeight(x, z);
  return islandCenterAt(x, z) === ADIYOGI_ISLAND ? adiyogiTerrainHeight(x, z) : gateGround(x, z + 12);
}
