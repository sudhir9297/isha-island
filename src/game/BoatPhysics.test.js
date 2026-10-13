import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { navigationControls, stepBoat, stepBoatFrame } from "./BoatPhysics.js";
import { createHullContactScratch, measureHullSeabed } from "./BoatHullCollision.js";
import { BOATS } from "./BoatProfiles.js";
import { BOAT_SCALE, DOCK } from "./WorldConfig.js";

function state(position = [-25, 0, 20], speed = 0) {
  return { position: new Vector3(...position), speed, heading: 0 };
}

function simulate(hz, seconds, controls, boat = state()) {
  for (let i = 0; i < hz * seconds; i++) stepBoat(boat, controls, 1 / hz);
  return boat;
}

test("straight sailing remains consistent at 30, 60, and 144 Hz", () => {
  const slow = simulate(30, 5, { forward: true });
  const normal = simulate(60, 5, { forward: true });
  const fast = simulate(144, 5, { forward: true });
  assert.ok(slow.position.distanceTo(normal.position) < 1e-8);
  assert.ok(normal.position.distanceTo(fast.position) < 0.02);
  assert.ok(Math.abs(normal.speed - fast.speed) < 0.01);
});

test("braking stops the boat while releasing throttle preserves inertia", () => {
  const braking = simulate(60, 1, { brake: true }, state(undefined, 6));
  const coasting = simulate(60, 1, {}, state(undefined, 6));
  assert.ok(braking.speed < 0.04);
  assert.ok(coasting.speed > 2.5);
  assert.ok(coasting.position.distanceTo(braking.position) > 2);
});

test("forward and reverse both accelerate with bounded speeds", () => {
  const forward = simulate(60, 8, { forward: true });
  const reverse = simulate(60, 8, { backward: true });
  assert.ok(forward.speed > 6 && forward.speed <= 6.2);
  assert.ok(reverse.speed < -2 && reverse.speed >= -2.2);
  assert.ok(forward.position.z < 20);
  assert.ok(reverse.position.z > 20);
});

test("steering follows the bow and changes direction when reversing", () => {
  const forward = simulate(60, 1, { forward: true, left: true });
  const reverse = simulate(60, 1, { backward: true, left: true });
  assert.ok(forward.heading > 0 && forward.position.x < -25);
  assert.ok(reverse.heading < 0 && reverse.position.x < -25);
});

test("a slow approach settles against the real beach without climbing it", () => {
  const boat = simulate(60, 2, {}, state([0, 0, -1.8], 1));
  assert.ok(!boat.beached);
  assert.ok(measureHullSeabed(boat, boat.visualTime, createHullContactScratch()).margin >= -1e-8);
});

test("the pier blocks a direct approach while its outer edge remains passable", () => {
  const blocked = simulate(60, 5, { forward: true }, state([6.53, 0, 8]));
  const clear = simulate(60, 5, { forward: true }, state([10, 0, 8]));
  assert.ok(blocked.position.z >= 2.3);
  assert.ok(clear.position.z < blocked.position.z - 2);
});

test("a suspended browser frame cannot teleport through the scene", () => {
  const boat = state(undefined, 2);
  const start = boat.position.clone();
  stepBoat(boat, { forward: true }, 5);
  assert.ok(boat.position.distanceTo(start) < 0.22);
});

test("resetting shared speed immediately clears velocity", () => {
  const boat = simulate(60, 3, { forward: true });
  boat.position.set(4, 0, 8);
  boat.speed = 0;
  boat.heading = 0;
  stepBoat(boat, {}, 1 / 60);
  assert.deepEqual(boat.position.toArray(), [4, 0, 8]);
  assert.equal(boat.speed, 0);
});

function navigate(boat, seconds, manual = {}) {
  for (let i = 0; i < 60 * seconds; i++) {
    stepBoat(boat, navigationControls(boat, manual, 1 / 60), 1 / 60);
  }
  return boat;
}

test("a click destination in open water is reached and the boat brakes to rest", () => {
  const boat = state();
  const destination = new Vector3(-25, 0, 5);
  boat.destination = destination;
  navigate(boat, 12);
  assert.equal(boat.destination, null);
  assert.ok(boat.position.distanceTo(destination) < 0.8);
  assert.ok(boat.speed < 0.025);
});

test("navigation turns toward an off-axis destination", () => {
  const boat = state();
  boat.destination = new Vector3(-32, 0, 11);
  navigate(boat, 14);
  assert.equal(boat.destination, null);
  assert.ok(boat.position.distanceTo(new Vector3(-32, 0, 11)) < 0.9);
});

test("a nearby destination to the side does not trap the boat in circles", () => {
  const boat = state();
  const destination = new Vector3(-23, 0, 20);
  boat.destination = destination;
  navigate(boat, 20);
  assert.equal(boat.destination, null);
  assert.ok(boat.position.distanceTo(destination) < 0.9);
});

test("resetting the boat cancels an active destination", () => {
  const boat = state();
  boat.resetId = 0;
  boat.destination = new Vector3(-25, 0, 5);
  navigate(boat, 1);
  boat.position.set(4, 0, 8);
  boat.speed = 0;
  boat.heading = 0;
  boat.resetId++;
  navigate(boat, 1);
  assert.equal(boat.destination, null);
  assert.deepEqual(boat.position.toArray(), [4, 0, 8]);
});

test("every manual control cancels navigation immediately", () => {
  for (const key of ["forward", "backward", "left", "right", "brake"]) {
    const boat = state();
    boat.destination = new Vector3(-25, 0, 5);
    const manual = { [key]: true };
    assert.equal(navigationControls(boat, manual, 1 / 60), manual);
    assert.equal(boat.destination, null);
  }
});

test("navigation cancels a target blocked by the pier", () => {
  const boat = state([6.53, 0, 8]);
  boat.destination = new Vector3(6.53, 0, -1);
  navigate(boat, 10);
  assert.equal(boat.destination, null);
  assert.ok(boat.position.z >= 2.3);
  assert.ok(boat.speed < 0.025);
});

function hullPerimeter(boat) {
  const points = [];
  const sin = Math.sin(boat.heading), cos = Math.cos(boat.heading);
  for (let i = 0; i <= 80; i++) {
    const t = i / 80 * 2 - 1;
    for (const [x, z] of [[t * 1.02, -2.1], [t * 1.02, 2.1], [-1.02, t * 2.1], [1.02, t * 2.1]]) {
      points.push({
        x: boat.position.x + BOAT_SCALE * (cos * x + sin * z),
        z: boat.position.z + BOAT_SCALE * (-sin * x + cos * z),
      });
    }
  }
  return points;
}

function assertHullInWater(boat) {
  for (const point of hullPerimeter(boat)) {

    const dx = point.x - DOCK.x, dz = point.z - DOCK.z;
    const localX = Math.cos(DOCK.heading) * dx - Math.sin(DOCK.heading) * dz;
    const localZ = Math.sin(DOCK.heading) * dx + Math.cos(DOCK.heading) * dz;
    assert.ok(Math.abs(localX) >= DOCK.halfWidth || Math.abs(localZ) >= DOCK.halfLength, `hull enters dock at ${point.x}, ${point.z}`);
  }
}

test("angled approaches stay above the terrain and outside the dock", () => {
  for (const profile of BOATS) for (const heading of [-0.7, 0, 0.7, Math.PI / 2, Math.PI]) {
    const boat = state([0, 0, 0], profile.maxSpeed);
    boat.boatId = profile.id;
    boat.heading = heading;
    for (let i = 0; i < 180; i++) {
      stepBoat(boat, { forward: true, left: i > 90 }, 1 / 60);
      assertHullInWater(boat);
      assert.ok(measureHullSeabed(boat, boat.visualTime, createHullContactScratch()).margin >= -1e-8);
    }
  }
});

test("low-speed hull contact is resolved at the actual coastal surface", () => {
  const boat = state([14.65, 0, -12]);
  boat.heading = Math.PI / 2;
  stepBoat(boat, {}, 0, 45);
  assert.ok(!boat.beached);
  assert.ok(measureHullSeabed(boat, 45, createHullContactScratch()).margin >= -1e-8);
  assert.equal(boat.collided, true);
});

test("diagonal hull contact cannot cross dock corners", () => {
  for (const profile of BOATS) for (const heading of [-0.55, 0, 0.55, Math.PI]) {
    const boat = state([6.52, 0, 5], profile.maxSpeed);
    boat.boatId = profile.id;
    boat.heading = heading;
    for (let i = 0; i < 300; i++) {
      stepBoat(boat, { forward: true, right: i > 130 }, 1 / 60);
      assertHullInWater(boat);
    }
  }
});

test("a turn preserves modest sideways momentum before water drag removes it", () => {
  const boat = simulate(60, 1, { left: true }, state(undefined, 5));
  const lateral = boat.velocity.x * Math.cos(boat.heading) - boat.velocity.z * Math.sin(boat.heading);
  assert.ok(lateral > 0.4 && lateral < 1.2);
  const initial = Math.abs(lateral);
  simulate(60, 1, {}, boat);
  const settled = Math.abs(boat.velocity.x * Math.cos(boat.heading) - boat.velocity.z * Math.sin(boat.heading));
  assert.ok(settled < initial * 0.02);
});

test("turning and drift remain consistent across common refresh rates", () => {
  const slow = simulate(30, 4, { forward: true, left: true });
  const normal = simulate(60, 4, { forward: true, left: true });
  const fast = simulate(144, 4, { forward: true, left: true });
  assert.ok(slow.position.distanceTo(normal.position) < 1e-8);
  assert.ok(normal.position.distanceTo(fast.position) < 0.06);
  assert.ok(Math.abs(normal.heading - fast.heading) < 0.01);
});

test("resetId and legacy speed resets clear accumulated sideways momentum", () => {
  for (const explicitReset of [false, true]) {
    const boat = simulate(60, 1, { forward: true, left: true });
    boat.position.set(-20, 0, 15);
    boat.heading = 0;
    boat.speed = 0;
    if (explicitReset) boat.resetId = (boat.resetId ?? 0) + 1;
    stepBoat(boat, {}, 1 / 60);
    assert.deepEqual(boat.position.toArray(), [-20, 0, 15]);
    assert.equal(boat.velocity.x, 0);
    assert.equal(boat.velocity.z, 0);
  }
});

function profileSail(id, fps, seconds, controls) {
  const state = { position: new Vector3(-30, 0, 15), heading: 0, speed: 0, boatId: id };
  for (let frame = 0; frame < fps * seconds; frame++) stepBoat(state, controls, 1 / fps);
  return state;
}

test("boat types have distinct forward and reverse performance", () => {
  const speeds = BOATS.map(boat => profileSail(boat.id, 60, 6, { forward: true }).speed);
  assert.ok(speeds[1] > speeds[0] && speeds[0] > speeds[2]);
  for (const boat of BOATS) {
    const reverse = profileSail(boat.id, 60, 6, { backward: true });
    assert.ok(reverse.speed < 0 && reverse.speed >= -boat.reverseSpeed);
    assert.ok(profileSail(boat.id, 60, 6, { forward: true }).speed <= boat.maxSpeed);
  }
});

test("every boat type steers consistently across common refresh rates", () => {
  for (const boat of BOATS) {
    const baseline = profileSail(boat.id, 60, 2, { forward: true, left: true });
    for (const fps of [30, 144]) {
      const result = profileSail(boat.id, fps, 2, { forward: true, left: true });
      assert.ok(result.position.distanceTo(baseline.position) < 0.07, boat.id);
      assert.ok(Math.abs(result.heading - baseline.heading) < 0.02, boat.id);
      assert.ok(Math.abs(result.speed - baseline.speed) < 0.02, boat.id);
    }
  }
});

test("every boat reaches an open-water click destination and brakes", () => {
  for (const boat of BOATS) {
    const state = { position: new Vector3(-25, 0, 10), heading: 0, speed: 0, boatId: boat.id,
      destination: new Vector3(-22, 0, -2) };
    const target = state.destination.clone();
    for (let frame = 0; frame < 60 * 16; frame++)
      stepBoat(state, navigationControls(state, {}, 1 / 60), 1 / 60);
    assert.equal(state.destination, null, boat.id);
    assert.ok(state.position.distanceTo(target) < 1, boat.id);
    assert.ok(Math.abs(state.speed) < 0.03, boat.id);
  }
});

test("the rendered keel and hull skin clear the physical coast across boat poses", async () => {
  const { auditCoast } = await import("../../_ref/boat-coast-audit-99.mjs");
  const audit = auditCoast();
  assert.equal(audit.poses, 13824);
  assert.equal(audit.conflicts, 0, JSON.stringify(audit.examples));
  assert.ok(audit.worstMargin >= 0.0019, `minimum rendered skin clearance ${audit.worstMargin}`);
});

test("the shared hull transform matches Three's rendered XYZ pose", async () => {
  const { HULL_MESH, transformBoatHull } = await import("./BoatHull.js");
  const { renderedHullMatrix } = await import("../../_ref/boat-coast-audit-99.mjs");
  const output = new Float64Array(HULL_MESH.positions.length), point = new Vector3();
  for (const profile of BOATS) for (const time of [0, 2, 9, 17]) for (const steering of [-1, 1]) {
    const boat = state([14.65, 0, -12], profile.maxSpeed);
    boat.boatId = profile.id; boat.heading = 1.7; boat.steering = steering;
    transformBoatHull(boat, time, output);
    const matrix = renderedHullMatrix(boat, profile, time);
    for (let i = 0; i < output.length; i += 3) {
      point.fromArray(HULL_MESH.positions, i).applyMatrix4(matrix);
      assert.ok(Math.hypot(point.x - output[i], point.y - output[i + 1], point.z - output[i + 2]) < 1e-12);
    }
  }
});

test("coastal contact follows the displayed clock phase during motion and pause", async () => {
  const { createHullProbes, renderedHullMatrix } = await import("../../_ref/boat-coast-audit-99.mjs");
  const { seabedHeightAt } = await import("./Seabed.js");
  const { resolveHullCoast } = await import("./BoatPhysics.js");
  const probes = createHullProbes(), point = new Vector3();
  for (const profile of BOATS) for (const hz of [30, 60, 144]) {
    const boat = state([15.8, 0, -12], profile.maxSpeed);
    boat.boatId = profile.id; boat.heading = Math.PI / 2;
    for (let frame = 0; frame < hz * 2; frame++) {
      const time = 10 + frame / hz;
      stepBoat(boat, { forward: true, left: frame > hz }, 1 / hz, time);
      const matrix = renderedHullMatrix(boat, profile, time);
      for (const probe of probes) {
        point.copy(probe).applyMatrix4(matrix);
        assert.ok(point.y - seabedHeightAt(point.x, point.z) >= -1e-7, `${profile.id} at ${hz}Hz/frame ${frame}`);
      }
    }
    for (const time of [12, 12.3, 13, 14]) {
      resolveHullCoast(boat, time);
      const matrix = renderedHullMatrix(boat, profile, time);
      for (const probe of probes) {
        point.copy(probe).applyMatrix4(matrix);
        assert.ok(point.y - seabedHeightAt(point.x, point.z) >= -1e-7, `paused ${profile.id} at ${time}`);
      }
    }
  }
});

test("east-coast skin penetration beneath the displaced surface needs only a local correction", async () => {
  const { createHullContactScratch, measureHullSeabed } = await import("./BoatHullCollision.js");
  const boat = state([14.65, 0, -12]);
  boat.heading = Math.PI / 2;
  // This actual low-water phase occupies the same east-coast skin boundary.
  const scratch = createHullContactScratch();
  assert.ok(measureHullSeabed(boat, 45, scratch).margin < -0.016);
  const start = boat.position.clone();
  stepBoat(boat, {}, 0, 45);
  assert.ok(measureHullSeabed(boat, 45, scratch).margin >= 0.002);
  assert.ok(boat.position.distanceTo(start) < 0.06);
  assert.equal(boat.position.y, 0);
  assert.equal(Math.abs(boat.speed), 0);
});

test("terrain ridges inside a hull triangle are measured beyond its vertices", async () => {
  const { createHullContactScratch, measureHullSeabed } = await import("./BoatHullCollision.js");
  const { seabedHeightAt } = await import("./Seabed.js");
  const boat = state([0.1, 0, -11.9]);
  boat.heading = Math.PI / 4;
  const contact = measureHullSeabed(boat, 3, createHullContactScratch(false));
  let vertexMargin = Infinity;
  for (let i = 0; i < contact.world.length; i += 3) {
    vertexMargin = Math.min(vertexMargin, contact.world[i + 1] - seabedHeightAt(contact.world[i], contact.world[i + 2]));
  }
  assert.ok(contact.margin < vertexMargin - 0.002);
});

test("paused coastal frames hold the hull pose and resume without a clock jump", async () => {
  const { boatHullPose } = await import("./BoatHull.js");
  const { createHullContactScratch, measureHullSeabed } = await import("./BoatHullCollision.js");
  for (const profile of BOATS) for (const hz of [30, 60, 144]) {
    const boat = state([14.55, 0, -12]);
    boat.boatId = profile.id;
    boat.heading = Math.PI / 2;
    boat.visualTime = 3;
    const scratch = createHullContactScratch();
    assert.ok(measureHullSeabed(boat, boat.visualTime, scratch).margin < 0, profile.id);
    // Pausing must still correct an occupied coastal pose, including motor skin.
    stepBoatFrame(boat, {}, 1 / hz, true);
    assert.ok(measureHullSeabed(boat, boat.visualTime, scratch).margin >= 0.002 - 1e-10);
    const position = boat.position.clone();
    const pose = boatHullPose(boat, boat.visualTime);
    for (let frame = 0; frame < hz * 2; frame++) stepBoatFrame(boat, { forward: true }, 1 / hz, true);
    assert.equal(boat.visualTime, 3);
    assert.deepEqual(boatHullPose(boat, boat.visualTime), pose);
    assert.ok(boat.position.distanceTo(position) < 1e-10);
    assert.equal(boat.speed, 0);
    assert.equal(boat.heading, Math.PI / 2);
    stepBoatFrame(boat, {}, 1 / hz);
    assert.ok(Math.abs(boat.visualTime - (3 + 1 / hz)) < 1e-12);
    const resumed = boatHullPose(boat, boat.visualTime);
    assert.ok(Math.abs(resumed.bob - pose.bob) < 0.002);
    assert.ok(Math.abs(resumed.pitch - pose.pitch) < 0.001);
    assert.ok(Math.abs(resumed.roll - pose.roll) < 0.001);
    assert.ok(measureHullSeabed(boat, boat.visualTime, scratch).margin >= 0.002 - 1e-10);
  }
});
