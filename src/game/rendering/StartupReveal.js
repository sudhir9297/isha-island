import { Matrix4, Vector2 } from 'three';
import { uniform, uv, vec4, mix, color, getViewPosition } from 'three/tsl';

// Reconstruct world positions from the scene depth. The reveal follows the
// ground plane in world units, so objects appear as the wave reaches them.
export function createStartupReveal(scenePass, camera) {
  const inverseProjection = uniform(new Matrix4());
  const cameraWorld = uniform(new Matrix4());
  const center = uniform(new Vector2());
  const radius = uniform(0);
  const fade = uniform(0);
  const depth = scenePass.getTextureNode('depth');
  const view = getViewPosition(uv(), depth, inverseProjection);
  const world = cameraWorld.mul(vec4(view, 1)).xyz;
  // The grid outside the revealed world lies on the sea plane, including sky.
  const near = cameraWorld.mul(vec4(getViewPosition(uv(), 0, inverseProjection), 1)).xyz;
  const far = cameraWorld.mul(vec4(getViewPosition(uv(), 1, inverseProjection), 1)).xyz;
  const ray = far.sub(near);
  const ground = near.add(ray.mul(near.y.negate().div(ray.y)));
  const position = mix(world, ground, depth.greaterThanEqual(.9999));
  const distance = position.xz.sub(center).length();
  const inside = distance.smoothstep(radius.sub(.06), radius.add(.06)).oneMinus();
  const ring = distance.sub(radius).abs().smoothstep(.035, .16).oneMinus().mul(radius.smoothstep(0, .6));
  const gridCoord = ground.xz.mul(.5).fract().sub(.5).abs();
  const grid = gridCoord.x.max(gridCoord.y).smoothstep(.485, .5).mul(.16);
  const backdrop = color('#052a35').add(color('#39717b').mul(grid));
  return {
    wrap: sceneColor => mix(mix(backdrop, sceneColor, inside).add(color('#b5efdf').mul(ring).mul(1.6)), sceneColor, fade),
    update(sequence, focus) {
      inverseProjection.value.copy(camera.projectionMatrixInverse);
      cameraWorld.value.copy(camera.matrixWorld);
      center.value.set(focus.x, focus.z);
      radius.value = sequence.radius;
      fade.value = sequence.fade;
    },
  };
}
