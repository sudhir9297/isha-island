import { materialColor, materialRoughness, materialOpacity, positionWorld, positionLocal, normalLocal, varying, uv, smoothstep, mix, texture, vec3, uniform, attribute, materialEmissive, instanceColor } from 'three/tsl';
import { beachWetness } from './generated/beachWetness.js';
import { stoneColor } from './generated/stoneColor.js';
export function beachNodes(uniforms) {
  const wet = beachWetness(uniforms, { beachWorld: positionWorld }).x;
  return { colorNode: materialColor.rgb.mul(mix(1, 0.86, wet)), roughnessNode: mix(materialRoughness, 0.56, wet) };
}
export function stoneNodes(uniforms) {
  return { colorNode: stoneColor(uniforms, { reefStoneWorld: positionWorld }).rgb };
}
export function coralEmission(vertexColors) { return materialEmissive.mul(instanceColor).mul(vertexColors ? attribute('color', 'vec3') : 1); }
export const contactOpacity = materialOpacity.mul(smoothstep(0.18, 0.5, uv().sub(0.5).length()).oneMinus());
const hullSide = varying(smoothstep(-0.045, 0.16, positionLocal.y)
  .mul(smoothstep(0.42, 0.55, positionLocal.y).oneMinus()).mul(normalLocal.x.abs().pow(2)));
export const hullFill = materialColor.rgb.mul(hullSide).mul(0.18);
export function gateStoneColor(material) {
  const sample = texture(material.map).rgb.dot(vec3(0.2126, 0.7152, 0.0722));
  return uniform(material.color).mul(mix(0.78, 1.12, smoothstep(0.08, 0.7, sample)))
    .mul(mix(0.8, 1, smoothstep(-0.6, 0.2, varying(normalLocal.y))));
}
