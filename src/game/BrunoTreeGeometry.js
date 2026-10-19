// Adapted from Bruno Simon's folio-2025 Trees.js / Foliage.js (MIT).
// License: public/licenses/bruno-simon-folio-2025.txt.
import { PlaneGeometry, Spherical, Vector3, Float32BufferAttribute, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAMERA_OFFSET } from './WorldConfig.js';
export const BRUNO_TREE_MODEL = '/models/bruno-oak/oak-tree.glb';
export function createBrunoTreeGeometry(scene) {
  let seed = 2025;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const planes = [];
  // Bruno's 80 camera-facing cards per foliage cluster, with outward normals.
  for (let i = 0; i < 80; i++) {
    const plane = new PlaneGeometry(.8, .8);
    const p = new Vector3().setFromSpherical(new Spherical(1 - random() ** 3, Math.PI * 2 * random(), Math.PI * random()));
    plane.rotateZ(random() * 9999); plane.translate(p.x, p.y, p.z);
    const normal = p.clone().normalize(), normals = [];
    for (let vertex = 0; vertex < 4; vertex++) {
      const mixed = new Vector3().fromBufferAttribute(plane.attributes.position, vertex).lerp(normal, .85);
      normals.push(...mixed.toArray());
    }
    plane.setAttribute('normal', new Float32BufferAttribute(normals, 3)); planes.push(plane);
  }
  const cluster = mergeGeometries(planes); planes.forEach(p => p.dispose());
  const foliage = [], bodies = [];
  const towardCamera = new Vector3(...CAMERA_OFFSET).normalize();
  scene.updateMatrixWorld(true);
  scene.traverse(child => {
    if (!child.isMesh) return;
    if (child.name.startsWith('treeBody')) bodies.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
    if (!child.name.startsWith('treeLeaves')) return;
    const transform = new Object3D(), angle = Math.PI * 2 * random();
    transform.up.set(Math.sin(angle), Math.cos(angle), 0); transform.lookAt(towardCamera);
    child.getWorldPosition(transform.position);
    transform.scale.setScalar(child.getWorldScale(new Vector3()).x);
    transform.updateMatrix();
    foliage.push(cluster.clone().applyMatrix4(transform.matrix));
  });
  cluster.dispose();
  if (!bodies.length || !foliage.length) throw new Error('Bruno oak model is missing its body or foliage anchors.');
  const wood = mergeGeometries(bodies), leaves = mergeGeometries(foliage);
  [...bodies, ...foliage].forEach(g => g.dispose());
  return { wood, leaves };
}
