import { worldCoastalRadiusAt } from './Seabed.js';
export function ambientMix(x, z, released) {
  const radius = worldCoastalRadiusAt(x, z);
  const shore = Math.max(0, 1 - Math.abs(radius - 1) / .65);
  return {surf: (.065 + shore * .125) * (released ? .7 : 1)};
}
export function positionAudio(node, position, time) {
  node.positionX.setTargetAtTime(position.x, time, .08);
  node.positionY.setTargetAtTime(position.y ?? 0, time, .08);
  node.positionZ.setTargetAtTime(position.z, time, .08);
}
export function spatialPanner(context, destination, position) {
  const node = context.createPanner();
  node.panningModel = 'HRTF'; node.distanceModel = 'inverse';
  node.refDistance = 3; node.maxDistance = 60; node.rolloffFactor = 1;
  // Set initial position immediately; later motion is smoothed.
  node.positionX.value = position.x; node.positionY.value = position.y ?? 0; node.positionZ.value = position.z;
  node.connect(destination);
  return node;
}
