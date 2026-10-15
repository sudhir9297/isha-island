import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { prepareWakeInstances, visitLiveWake, commitWakeInstances } from './WakeInstances.js';

test('wake keeps live particle order, ages expired slots and reuses reset slots', () => {
  const particles = [
    {age: 1, life: 1}, {age: 0.2, life: 1}, {age: 0.95, life: 1}, {age: -0.05, life: 1},
  ];
  const live = [];
  assert.equal(visitLiveWake(particles, 0.1, (p, i) => live.push([particles.indexOf(p), i])), 2);
  assert.deepEqual(live, [[1, 0], [3, 1]]);
  assert.equal(particles[0].age, 1.1);
  // A boat reset expires everything; new emissions can reuse any ring-buffer slot.
  particles.forEach(p => { p.age = p.life; });
  assert.equal(visitLiveWake(particles, 0.016, () => assert.fail('expired particle')), 0);
  particles[2].age = -0.016;
  assert.equal(visitLiveWake(particles, 0.016, (p, i) => {
    assert.equal(p, particles[2]); assert.equal(i, 0); assert.equal(p.age, 0);
  }), 1);
});

test('wake uploads only the packed prefix and stops uploads when empty', () => {
  const geometry = new PlaneGeometry(2, 2), material = new MeshBasicMaterial();
  geometry.setAttribute('instanceFade', new InstancedBufferAttribute(new Float32Array(300), 1));
  geometry.setAttribute('instanceSeed', new InstancedBufferAttribute(new Float32Array(300), 1));
  const mesh = new InstancedMesh(geometry, material, 300);
  prepareWakeInstances(mesh);
  assert.equal(mesh.count, 0);
  const attributes = [mesh.instanceMatrix, geometry.attributes.instanceFade, geometry.attributes.instanceSeed];
  for (const count of [300, 27, 0, 4]) {
    const versions = attributes.map(a => a.version);
    commitWakeInstances(mesh, count);
    assert.equal(mesh.count, count);
    attributes.forEach((a, i) => {
      assert.equal(a.usage, DynamicDrawUsage);
      assert.equal(a.version, versions[i] + (count ? 1 : 0));
      assert.deepEqual(a.updateRanges, count ? [{start: 0, count: count * a.itemSize}] : []);
    });
  }
  mesh.dispose(); geometry.dispose(); material.dispose();
});
