import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { placeGateAsset, disposeGateAsset } from "./MalaiVasalAsset.js";

const path = new URL("../../public/models/malai-vasal-day-v2.glb", import.meta.url);
function readAssetGeometry() {
  const file = readFileSync(path);
  assert.equal(file.toString("ascii", 0, 4), "glTF");
  const length = file.readUInt32LE(12);
  const json = JSON.parse(file.toString("utf8", 20, 20 + length));
  const binaryStart = 20 + length + 8;
  const sizes = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
  const types = {5126: [4, "getFloat32"], 5125: [4, "getUint32"], 5123: [2, "getUint16"], 5121: [1, "getUint8"]};
  const attr = (index) => {
    const a = json.accessors[index], v = json.bufferViews[a.bufferView];
    const count = sizes[a.type], [bytes, method] = types[a.componentType];
    const start = binaryStart + (v.byteOffset || 0) + (a.byteOffset || 0);
    const data = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const array = a.componentType === 5126 ? new Float32Array(a.count * count) : new Uint32Array(a.count * count);
    for (let i = 0; i < a.count; i++) for (let j = 0; j < count; j++) array[i * count + j] = data[method](start + i * (v.byteStride || count * bytes) + j * bytes, true);
    return new THREE.BufferAttribute(array, count);
  };
  const nodes = json.nodes.map((n) => {
    const group = new THREE.Group(); group.name = n.name || "";
    if (n.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
    else { if (n.translation) group.position.fromArray(n.translation); if (n.rotation) group.quaternion.fromArray(n.rotation); if (n.scale) group.scale.fromArray(n.scale); }
    if (n.mesh !== undefined) for (const primitive of json.meshes[n.mesh].primitives) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", attr(primitive.attributes.POSITION));
      if (primitive.attributes.NORMAL !== undefined) geometry.setAttribute("normal", attr(primitive.attributes.NORMAL));
      if (primitive.indices !== undefined) geometry.setIndex(attr(primitive.indices));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
      mesh.name = n.name || ""; group.add(mesh);
    }
    return group;
  });
  json.nodes.forEach((n, i) => (n.children || []).forEach((child) => nodes[i].add(nodes[child])));
  const scene = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach((index) => scene.add(nodes[index])); scene.updateMatrixWorld(true);
  return { scene, json };
}

test("the browser asset is the requested V2 Blender export with baked stone colors", () => {
  const provenance = JSON.parse(readFileSync(new URL("../../public/models/malai-vasal-day-v2.json", import.meta.url)));
  assert.ok(provenance.source.endsWith("malaiVasal_detailed_day_v2.blend"));
  assert.match(provenance.source_sha256, /^[a-f0-9]{64}$/);
  assert.ok(provenance.source_object_count > 1000);
  assert.ok(provenance.source_objects.includes("top_rock"));
  assert.ok(provenance.source_objects.includes("side_rock_gate"));
  const {scene, json} = readAssetGeometry();
  assert.ok(json.images.length >= 2, "procedural boulder and granite colors are embedded");
  for (const role of ["Boulder", "GraniteSupports", "Walls", "Metalwork", "Finial"]) assert.ok(scene.getObjectByName(`MalaiVasal_${role}`));
  const bounds = new THREE.Box3().setFromObject(scene);
  assert.ok(bounds.max.x - bounds.min.x > 16 && bounds.max.x - bounds.min.x < 19);
  assert.ok(Math.abs(bounds.min.y) < 0.06);
  assert.ok(bounds.max.y > 6 && bounds.max.y < 6.5);
});
test("source geometry remains finite and the island placement does not mutate cached meshes", () => {
  const {scene} = readAssetGeometry();
  const originalBounds = new THREE.Box3().setFromObject(scene).clone();
  const placed = placeGateAsset(scene); placed.updateMatrixWorld(true);
  placed.traverse((object) => {
    if (!object.isMesh) return;
    assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(Array.from(object.geometry.attributes.normal.array).every(Number.isFinite));
    assert.ok(object.castShadow && object.receiveShadow);
  });
  assert.deepEqual(new THREE.Box3().setFromObject(scene).min.toArray(), originalBounds.min.toArray());
  assert.deepEqual(new THREE.Box3().setFromObject(scene).max.toArray(), originalBounds.max.toArray());
  for (const role of ["Boulder", "GraniteSupports", "Finial"]) {
    assert.deepEqual(new THREE.Box3().setFromObject(placed.getObjectByName(`MalaiVasal_${role}`)).min.toArray(), new THREE.Box3().setFromObject(scene.getObjectByName(`MalaiVasal_${role}`)).min.toArray());
  }
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 1.4, 4), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(placed, true).length, 0, "the central boat-to-portal route remains open");
  disposeGateAsset(placed);
});

test('static gate geometry is shared and disposal owns only deformed buffers', (t) => {
  const {scene} = readAssetGeometry();
  const placed = placeGateAsset(scene);
  let cachedDisposals=0,privateDisposals=0,shared=0,privateCount=0;
  const cached=new Set();
  scene.traverse(o=>{if(o.isMesh){cached.add(o.geometry);o.geometry.addEventListener('dispose',()=>cachedDisposals++);}});
  placed.traverse(o=>{
    if(!o.isMesh)return;
    if(cached.has(o.geometry))shared++;
    else {privateCount++;o.geometry.addEventListener('dispose',()=>privateDisposals++);}
  });
  assert.ok(shared>0 && privateCount>0);
  const sharedBuffers=new Set();
  placed.traverse(o=>{if(o.isMesh && cached.has(o.geometry)){
    for(const attribute of Object.values(o.geometry.attributes))sharedBuffers.add(attribute.array.buffer);
    if(o.geometry.index)sharedBuffers.add(o.geometry.index.array.buffer);
  }});
  t.diagnostic(`Avoided static geometry buffer copies: ${[...sharedBuffers].reduce((sum,b)=>sum+b.byteLength,0)} bytes across ${shared} primitives`);
  disposeGateAsset(placed);disposeGateAsset(placed);
  assert.equal(cachedDisposals,0);
  assert.equal(privateDisposals,privateCount);
});
