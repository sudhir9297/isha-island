import assert from "node:assert/strict";
import test from "node:test";
import { BoxGeometry, Euler, Matrix4, Vector3 } from "three";
import { BOATS } from "./BoatProfiles.js";
import { BOAT_SCALE } from "./WorldConfig.js";
import { boatSurfacePose, boatHullPose, HULL_SURFACE_CLEARANCE } from "./BoatHull.js";
import { stepBoatFrame, resolveHullCoast } from "./BoatPhysics.js";
import { measureHullSeabed, createHullContactScratch } from "./BoatHullCollision.js";
import { createReefHeightField } from "./Seabed.js";
import { sampleOceanSurface } from "./WaterOptics.js";
import { auditReef, actualReefField } from "../../scripts/boat-coast-audit-99.mjs";

const state = (id = "skiff") => ({ boatId: id, position: new Vector3(-25, 0, 10), heading: 0, speed: 0 });

test("buoyancy recovers a physical water plane across heading and scaled hulls", () => {
  const gx = .034, gz = -.023, height = -.061;
  const normal = new Vector3(-gx, 1, -gz).normalize();
  const sea = (x, z, time, target) => Object.assign(target, { height: height + gx * x + gz * z });
  for (const profile of BOATS) for (const heading of [0, .63, Math.PI / 2, 2.8]) {
    const boat = state(profile.id); boat.heading = heading;
    const pose = boatSurfacePose(boat, 3, {}, sea);
    assert.ok(Math.abs(BOAT_SCALE * pose.bob - (height + gx * boat.position.x + gz * boat.position.z + HULL_SURFACE_CLEARANCE)) < 1e-12);
    const root = new Matrix4().makeRotationY(heading);
    const model = new Matrix4().makeRotationFromEuler(new Euler(pose.pitch, 0, pose.roll, "XYZ"));
    const fittedNormal = new Vector3(0, 1, 0).transformDirection(root.multiply(model));
    assert.ok(fittedNormal.distanceTo(normal) < 1e-12, `${profile.id} heading ${heading}`);
  }
});

test("a settled hull follows spatial water height while retaining planing and steering heel", () => {
  const boat = state();
  const still = boatSurfacePose(boat, 2);
  boat.speed = 6; boat.steering = 1;
  const driven = boatSurfacePose(boat, 2);
  assert.ok(Math.abs(driven.bob - still.bob) < 1e-12);
  assert.ok(Math.abs(driven.pitch - still.pitch - .054) < 1e-12);
  assert.ok(Math.abs(driven.roll - still.roll + .072) < 1e-12);
  const away = state(); away.position.x += 8;
  assert.ok(Math.abs(boatSurfacePose(away, 2).bob - still.bob) > .005);
  // Several actual points over the hull independently constrain its fitted level.
  const heights = [-.8, 0, .8].flatMap(x => [-1.1, 0, 1.1].map(z =>
    sampleOceanSurface(boat.position.x + x, boat.position.z + z, 2).height));
  const fitted = still.bob * BOAT_SCALE - HULL_SURFACE_CLEARANCE;
  assert.ok(fitted >= Math.min(...heights) - .01 && fitted <= Math.max(...heights) + .01);
});

test("pause freezes the cached pose and long ambient resume uses bounded spring motion", () => {
  for (const profile of BOATS) {
    const boat = state(profile.id);
    stepBoatFrame(boat, {}, 1 / 60, false, 2);
    const frozen = boatHullPose(boat, 2), position = boat.position.clone();
    for (let i = 0; i < 120; i++) stepBoatFrame(boat, { forward: true }, 1 / 60, true, 200 + i);
    assert.deepEqual(boatHullPose(boat, 500), frozen);
    assert.deepEqual(boat.position, position);
    stepBoatFrame(boat, {}, 5, false, 600);
    const resumed = boatHullPose(boat, 600);
    assert.ok(Math.abs(resumed.bob - frozen.bob) * BOAT_SCALE < .035);
    assert.ok(Math.abs(resumed.pitch - frozen.pitch) < .02);
    assert.ok(Math.abs(resumed.roll - frozen.roll) < .02);
    assert.ok(Object.values(resumed).every(Number.isFinite));
    for (let i = 0; i < 180; i++) stepBoatFrame(boat, {}, 1 / 60, false, 600);
    const target = boatSurfacePose(boat, 600);
    assert.ok(Math.abs(boatHullPose(boat, 600).bob - target.bob) < 1e-8);
  }
});

test("a flat reef crown can block the motor with a clear hull and opposite triangle winding", () => {
  const geometry = new BoxGeometry(.6, .6, .6).toNonIndexed();
  const field = createReefHeightField(geometry, [{ position: [-25, -.6, 11.63], scale: [1, 1, 1], angle: .43 }]);
  const boat = state(); boat.terrainField = field;
  assert.ok(measureHullSeabed(boat, 2, createHullContactScratch(false)).margin > .002);
  const scratch = createHullContactScratch();
  assert.ok(measureHullSeabed(boat, 2, scratch).margin < -.01);
  resolveHullCoast(boat, 2);
  assert.ok(measureHullSeabed(boat, 2, scratch).margin >= .002 - 1e-8);
  assert.ok(boat.position.distanceTo(new Vector3(-25, 0, 10)) < 2.7);
  geometry.dispose();
});

test("all actual 53 reef rocks separate rendered hull and motor skin", () => {
  const result = auditReef();
  assert.equal(result.rockCount, 53);
  assert.equal(result.poses, 636);
  assert.equal(result.conflicts, 0, JSON.stringify(result.examples));
  assert.ok(result.minimumMargin >= .0019, `actual skin margin ${result.minimumMargin}`);
});

test("binding the real reef field preserves clear water motion", () => {
  const clear = state(), reef = state(); reef.terrainField = actualReefField();
  for (let frame = 0; frame < 180; frame++) {
    stepBoatFrame(clear, { forward: true }, 1 / 60, false, frame / 60);
    stepBoatFrame(reef, { forward: true }, 1 / 60, false, frame / 60);
  }
  assert.deepEqual(reef.position, clear.position);
  assert.equal(reef.speed, clear.speed);
  assert.deepEqual(boatHullPose(reef, 3), boatHullPose(clear, 3));
});
