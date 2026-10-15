import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, DynamicDrawUsage, Frustum, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { prepareMovingInstances, commitMovingInstances } from './MovingInstances.js';

test('moving batches cull off-screen and reappear after swimming into view', () => {
  const geometry = new BoxGeometry(2, 1, 3), material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 2);
  const transform = new Object3D();
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  prepareMovingInstances(mesh);
  assert.equal(mesh.instanceMatrix.usage, DynamicDrawUsage);
  assert.equal(mesh.frustumCulled, true);
  for (const x of [120, 0, -120, 0]) {
    for (let i = 0; i < 2; i++) {
      transform.position.set(x + i, 0, -10);
      transform.rotation.set(0.2, i * 1.2, 0.3);
      transform.scale.set(0.8, 1.1, 1.4);
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    }
    const previousVersion = mesh.instanceMatrix.version;
    commitMovingInstances(mesh);
    assert.equal(mesh.instanceMatrix.version, previousVersion + 1);
    assert.equal(frustum.intersectsObject(mesh), x === 0);
    // Every transformed vertex must remain inside the refreshed aggregate sphere.
    const matrix = new Matrix4(), vertex = new Vector3();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (let j = 0; j < geometry.attributes.position.count; j++) {
        vertex.fromBufferAttribute(geometry.attributes.position, j).applyMatrix4(matrix);
        assert.ok(vertex.distanceTo(mesh.boundingSphere.center) <= mesh.boundingSphere.radius + 1e-6);
      }
    }
  }
  mesh.dispose(); geometry.dispose(); material.dispose();
});
