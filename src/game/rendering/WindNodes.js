import { attribute, positionLocal, normalLocal, modelWorldMatrix, transformNormalToView } from 'three/tsl';
import { windPosition } from './generated/windPosition.js';
import { windNormal } from './generated/windNormal.js';
import { leafWindPosition } from './generated/leafWindPosition.js';
import { leafWindNormal } from './generated/leafWindNormal.js';
export function windNodes(uniforms, leaf = false) {
  const inputs = { modelMatrix: modelWorldMatrix, position: positionLocal, normal: normalLocal };
  if (leaf) Object.assign(inputs, {
    leafWindRoot: attribute('leafWindRoot', 'vec3'),
    leafWindReach: attribute('leafWindReach', 'float'),
    leafWindAxis: attribute('leafWindAxis', 'vec3'),
  });
  return {
    positionNode: (leaf ? leafWindPosition : windPosition)(uniforms, inputs).xyz,
    normalNode: transformNormalToView((leaf ? leafWindNormal : windNormal)(uniforms, inputs).xyz).normalize(),
  };
}
