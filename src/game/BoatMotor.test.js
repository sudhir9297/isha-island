import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Vector3 } from "three";
import { sampleOceanSurface } from "./WaterOptics.js";
import { BOATS } from "./BoatProfiles.js";
import { HULL_MESH, transformBoatHull } from "./BoatHull.js";
import { advancePropeller, MOTOR_CONTACT_MESH, PROPELLER_GEOMETRY, PROPELLER_HUB_GEOMETRY, PROPELLER_POSITION } from "./BoatMotor.js";
import { createHullContactScratch, measureHullSeabed } from "./BoatHullCollision.js";
import { resolveHullCoast } from "./BoatPhysics.js";
import { createMeshProbes, renderedMotorMatrix } from "../../_ref/boat-coast-audit-99.mjs";

test("the lower unit and complete spinning prop stay immersed through boat poses", () => {
  const prop = PROPELLER_GEOMETRY.attributes.position, point = new Vector3();
  let minimumDraft = Infinity, minimumImmersion = Infinity;
  for (const profile of BOATS) for (let i = 0; i <= 100; i++)
    for (const speed of [0, profile.maxSpeed, -profile.reverseSpeed]) for (const steering of [-1, 0, 1]) {
      const state = { boatId: profile.id, position: new Vector3(-25, 0, 10), heading: 1.2, speed, steering };
      const matrix = renderedMotorMatrix(state, profile, i / 5);
      for (let phase = 0; phase < 12; phase++) {
        const local = new Matrix4().makeRotationZ(phase * Math.PI / 18);
        local.setPosition(...PROPELLER_POSITION);
        const world = new Matrix4().multiplyMatrices(matrix, local);
        let bottom = Infinity, draft = 0;
        for (let vertex = 0; vertex < prop.count; vertex++) {
          point.fromBufferAttribute(prop, vertex).applyMatrix4(world);
          bottom = Math.min(bottom, point.y);
          const surface = sampleOceanSurface(point.x, point.z, i / 5).height;
          minimumImmersion = Math.min(minimumImmersion, surface - point.y);
          draft = Math.max(draft, surface - point.y);
          assert.ok(point.y < surface, `${profile.id}, ${i / 5}s, speed ${speed}`);
        }
        if (speed === 0) minimumDraft = Math.min(minimumDraft, draft);
      }
    }
  assert.ok(minimumDraft > 0.24 && minimumDraft < 0.32, `draft ${minimumDraft}`);
  assert.ok(minimumImmersion > 0.015, `top blade immersion ${minimumImmersion}`);
});

test("prop rotation uses shaft Z, follows signed speed, and freezes when paused", () => {
  assert.ok(advancePropeller(0, 3, 1 / 60) > 0);
  assert.ok(advancePropeller(0, -3, 1 / 60) < 0);
  assert.equal(advancePropeller(1.3, 3, 1 / 60, true), 1.3);
  assert.equal(advancePropeller(1.3, 0, 1 / 60), 1.3);
  const run = hz => {
    let phase = 0;
    for (let i = 0; i < hz; i++) phase = advancePropeller(phase, 3, 1 / hz);
    return phase;
  };
  assert.ok(Math.abs(run(30) - run(144)) < 1e-12);
});

test("the contact mesh follows the rendered steered motor transform", () => {
  const out = new Float64Array(HULL_MESH.positions.length + MOTOR_CONTACT_MESH.positions.length), point = new Vector3();
  for (const profile of BOATS) for (const time of [0, 2, 9, 17]) for (const steering of [-1, 0, 1]) {
    const state = { boatId: profile.id, position: new Vector3(15, 0, -12), heading: 2.3, speed: profile.maxSpeed, steering };
    transformBoatHull(state, time, out);
    const matrix = renderedMotorMatrix(state, profile, time);
    for (let i = 0; i < MOTOR_CONTACT_MESH.positions.length; i += 3) {
      point.fromArray(MOTOR_CONTACT_MESH.positions, i).applyMatrix4(matrix);
      const offset = HULL_MESH.positions.length + i;
      assert.ok(Math.hypot(point.x - out[offset], point.y - out[offset + 1], point.z - out[offset + 2]) < 1e-12);
    }
  }
});

test("the motor cannot enter shallow terrain while its hull remains clear", () => {
  const state = { boatId: "skiff", position: new Vector3(14.65, 0, -12), heading: 11 * Math.PI / 8, speed: 0 };
  assert.ok(measureHullSeabed(state, 2, createHullContactScratch(false)).margin > 0.002);
  const scratch = createHullContactScratch();
  assert.ok(measureHullSeabed(state, 2, scratch).margin < -0.1);
  const start = state.position.clone();
  resolveHullCoast(state, 2);
  assert.ok(measureHullSeabed(state, 2, scratch).margin >= 0.002);
  assert.ok(state.position.distanceTo(start) < 0.5);
});

test("the motor envelope contains all rendered blade and hub rotation phases", () => {
  const probes = createMeshProbes({ positions: PROPELLER_GEOMETRY.attributes.position.array, indices: PROPELLER_GEOMETRY.index.array });
  const hub = PROPELLER_HUB_GEOMETRY.attributes.position;
  for (let i = 0; i < hub.count; i++) probes.push(new Vector3().fromBufferAttribute(hub, i));
  // The circumscribed collision prism encloses this full disk at every phase.
  for (const point of probes) {
    assert.ok(Math.hypot(point.x, point.y) <= 0.135);
    assert.ok(Math.abs(point.z) <= 0.045);
  }
});
