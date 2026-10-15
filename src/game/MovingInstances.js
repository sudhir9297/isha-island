import { DynamicDrawUsage } from 'three';

// Set usage before the renderer first allocates the GPU buffer.
export function prepareMovingInstances(mesh) {
  if (!mesh) return;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
}

export function commitMovingInstances(mesh) {
  mesh.instanceMatrix.needsUpdate = true;
  // InstancedMesh caches its aggregate sphere. Refresh it after movement so both
  // the underwater capture and main camera can cull without stale-bound popping.
  mesh.computeBoundingSphere();
}
