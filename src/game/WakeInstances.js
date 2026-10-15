import { DynamicDrawUsage } from 'three';

export function prepareWakeInstances(mesh) {
  mesh.count = 0;
  for (const attribute of [mesh.instanceMatrix, mesh.geometry.attributes.instanceFade, mesh.geometry.attributes.instanceSeed]) {
    attribute.setUsage(DynamicDrawUsage);
  }
}

// Keep pool order for transparent blending; only GPU slots are compacted.
export function visitLiveWake(particles, delta, write) {
  let count = 0;
  for (const particle of particles) {
    particle.age += delta;
    if (particle.age < particle.life) write(particle, count++);
  }
  return count;
}

export function commitWakeInstances(mesh, count) {
  mesh.count = count;
  for (const attribute of [mesh.instanceMatrix, mesh.geometry.attributes.instanceFade, mesh.geometry.attributes.instanceSeed]) {
    attribute.clearUpdateRanges();
    if (count === 0) continue;
    attribute.addUpdateRange(0, count * attribute.itemSize);
    attribute.needsUpdate = true;
  }
}
