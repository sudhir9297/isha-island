import { Box3, Frustum, Matrix4 } from 'three';

// Use the islands' rendered geometry (including trees, gate and dock), rather
// than just their centers. Even a sliver of land entering the view hides arrows.
export function collectIslandBounds(scene) {
  const bounds = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!object.userData.navigationIsland) return;
    object.traverseVisible(child => {
      if (!child.isMesh) return;
      const box = new Box3().setFromObject(child);
      // Submerged terrain alone does not count as a visible island.
      if (box.isEmpty() || box.max.y < 0) return;
      box.min.y = Math.max(0, box.min.y);
      bounds.push(box);
    });
  });
  return bounds;
}

export function createIslandVisibilityCheck() {
  const frustum = new Frustum(), matrix = new Matrix4();
  return (camera, bounds) => {
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
    return bounds.some(box => frustum.intersectsBox(box));
  };
}
