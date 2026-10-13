import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeEntrancePath } from "./MalaiVasalGeometry.js";
import { GATE, gateTerrainHeight } from "./GateTerrain.js";

test("paving follows sampled terrain, faces upward and keeps pier to gate connected", () => {
  const plane = new THREE.PlaneGeometry(30, 30, 25, 25).rotateX(-Math.PI / 2);
  const p = plane.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 0.5 + p.getZ(i) * 0.025);
  plane.computeVertexNormals();
  const paving = makeEntrancePath(plane), points = paving.attributes.position;
  for (let i = 0; i < points.count; i++) {
    assert.ok(Math.abs(points.getY(i) - (0.55 + points.getZ(i) * 0.025)) < 0.001);
    assert.ok(paving.attributes.normal.getY(i) > 0.95);
  }
  paving.computeBoundingBox();
  assert.ok(paving.boundingBox.max.z > 7);
  assert.ok(paving.boundingBox.min.z < -3);
  assert.equal(gateTerrainHeight(GATE.x, GATE.z, 0.5), GATE.floor);
  assert.equal(gateTerrainHeight(12, 0, 0.04), 0.04, "shore retains its original height");
  plane.dispose(); paving.dispose();
});
