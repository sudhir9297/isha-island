import { ROWING_RATE } from './Rowing.js';
import { WORLD_LIMIT } from "./AdiyogiTerrain.js";
import { BOAT_SCALE, DOCK, START, OPENING_APPROACH } from "./WorldConfig.js";
import { seabedHeightAt, seabedMaxHeightWithin, worldCoastalRadiusAt } from "./Seabed.js";
import { gateTerrainHeight } from "./GateTerrain.js";
import { boatProfile } from "./BoatProfiles.js";
import { advanceBoatHullPose } from "./BoatHull.js";
import { createHullContactScratch, measureHullSeabed } from "./BoatHullCollision.js";

/** Translate a sea destination into the same throttle and wheel used by the keys. */
export function navigationControls(state, manual, frameDelta) {
  const navigation = (state.navigation ??= {
    target: null,
    lastDistance: 0,
    stalled: 0,
    stopping: false,
    resetId: state.resetId,
    controls: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      navigation: true,
    },
  });
  if (navigation.resetId !== state.resetId) {
    navigation.resetId = state.resetId;
    state.destination = null;
    state.openingVoyage = false;
    navigation.target = null;
    navigation.stopping = false;
    return manual;
  }
  if (
    manual.forward ||
    manual.backward ||
    manual.left ||
    manual.right ||
    manual.brake
  ) {
    state.destination = null;
    state.openingVoyage = false;
    navigation.target = null;
    navigation.stopping = false;
    return manual;
  }
  const controls = navigation.controls;
  controls.forward =
    controls.backward =
    controls.left =
    controls.right =
    controls.brake =
      false;
  if (!state.destination) {
    if (navigation.stopping && Math.abs(state.speed) > 0.025) {
      controls.brake = true;
      return controls;
    }
    navigation.stopping = false;
    return manual;
  }
  const dx = state.destination.x - state.position.x;
  const dz = state.destination.z - state.position.z;
  const distance = Math.hypot(dx, dz);
  if (navigation.target !== state.destination) {
    navigation.target = state.destination;
    navigation.lastDistance = distance;
    navigation.stalled = 0;
    navigation.stopping = false;
  }
  if (distance < 0.7) {
    state.destination = null;
    state.openingVoyage = false;
    navigation.stopping = true;
    controls.brake = true;
    return controls;
  }
  if (navigation.lastDistance - distance > 0.035) {
    navigation.lastDistance = distance;
    navigation.stalled = 0;
  } else if (state.collided || navigation.stalled > 0) {
    navigation.stalled += Math.min(frameDelta, 0.09);
  } else {
    navigation.stalled = 0;
  }
  if (navigation.stalled >= 1) {
    state.destination = null;
    state.openingVoyage = false;
    navigation.stopping = true;
    controls.brake = true;
    return controls;
  }
  const heading = Math.atan2(-dx, -dz);
  const angle = Math.atan2(
    Math.sin(heading - state.heading),
    Math.cos(heading - state.heading),
  );
  controls.left = angle > 0.055;
  controls.right = angle < -0.055;
  const alignment = Math.abs(angle) > 0.8 ? 0.34 : 1;
  const desiredSpeed =
    Math.min(state.openingVoyage ? OPENING_APPROACH.speed : boatProfile(state.boatId).cruiseSpeed, Math.max(0.7, (distance - 0.35) * 1.15)) * alignment;
  controls.forward = state.speed < desiredSpeed - 0.08;
  controls.brake = state.speed > desiredSpeed + 0.25;
  return controls;
}

// A conservative deck envelope includes the gunwale as well as the keel.
const HALF_BEAM = 1.02 * BOAT_SCALE;
const HALF_LENGTH = 2.1 * BOAT_SCALE;
const DOCK_X = DOCK.x;
const DOCK_Z = DOCK.z;
const DOCK_HEADING = DOCK.heading;
const DOCK_HALF_BEAM = DOCK.halfWidth;
const DOCK_HALF_LENGTH = DOCK.halfLength;
const CONTACT_GAP = 0.002;

function contact(state, motion, nx, nz, depth) {
  state.position.x += nx * (depth + CONTACT_GAP);
  state.position.z += nz * (depth + CONTACT_GAP);
  const inward = motion.x * nx + motion.z * nz;
  if (inward < 0) {
    motion.x -= nx * inward;
    motion.z -= nz * inward;
  }
  state.collided = true;
}

/** Recover to a previously verified clear-water position, with no residual impulse. */
export function resetBoatToWater(state) {
  state.openingVoyage = false;
  const safe = state.safeWater ?? START;
  state.position.x = safe.x; state.position.y = 0; state.position.z = safe.z;
  state.heading = safe.heading;
  state.speed = 0; state.steering = 0; state.angularVelocity = 0;
  state.beached = false; state.beachedTime = 0; state.destination = null;
  state.velocity = undefined; state.hullPose = undefined;
  state.resetId = (state.resetId ?? 0) + 1;
}

const hullScratch = new WeakMap();

/** Resolve the displayed hull pose against the physical coastal triangles. */
export function resolveHullCoast(state, time = state.visualTime ?? 0) {
  let scratch = hullScratch.get(state);
  if (!scratch) {
    scratch = createHullContactScratch();
    hullScratch.set(state, scratch);
  }
  const motion = state.velocity ?? { x: 0, z: 0 };
  for (let iteration = 0; iteration < 12; iteration++) {
    measureHullSeabed(state, time, scratch);
    if (scratch.margin >= CONTACT_GAP || !Number.isFinite(scratch.margin)) return;
    if (!scratch.rock && !state.beached && Math.hypot(motion.x, motion.z) > 2.8
      && worldCoastalRadiusAt(state.position.x, state.position.z) < 1.3) {
      state.beached = true;
      state.beachedTime = 0;
      state.angularVelocity = (state.steering ?? 0) * boatProfile(state.boatId).turnRate;
      state.destination = null;
      state.openingVoyage = false;
    }
    if (state.beached && !scratch.rock) {
      state.hullPose.bob += (CONTACT_GAP - scratch.margin) / BOAT_SCALE;
      state.hullPose.bobVelocity = Math.max(0, state.hullPose.bobVelocity);
      return;
    }
    const gradient = Math.hypot(scratch.gradientX, scratch.gradientZ);
    if (gradient < 1e-8) {
      if (!scratch.rock) return;
      // An exact flat rock face has no downhill gradient. Exit its support
      // boundary radially from this rock, after narrow-phase contact is proven.
      const rock = scratch.rock;
      const cx = (rock.minX + rock.maxX) / 2, cz = (rock.minZ + rock.maxZ) / 2;
      const dx = state.position.x - cx, dz = state.position.z - cz;
      const length = Math.hypot(dx, dz);
      const nx = length > 1e-8 ? dx / length : -Math.sin(state.heading);
      const nz = length > 1e-8 ? dz / length : -Math.cos(state.heading);
      const rockSupport = Math.abs(nx) * (rock.maxX - rock.minX) / 2 + Math.abs(nz) * (rock.maxZ - rock.minZ) / 2;
      const hullSupport = Math.abs(nx) * Math.max(state.position.x - scratch.minX, scratch.maxX - state.position.x)
        + Math.abs(nz) * Math.max(state.position.z - scratch.minZ, scratch.maxZ - state.position.z);
      contact(state, motion, nx, nz, rockSupport + hullSupport - dx * nx - dz * nz);
      if (state.velocity) state.speed = -motion.x * Math.sin(state.heading) - motion.z * Math.cos(state.heading);
      continue;
    }
    contact(state, motion, -scratch.gradientX / gradient, -scratch.gradientZ / gradient,
      (CONTACT_GAP - scratch.margin) / gradient);
    if (state.velocity) state.speed = -motion.x * Math.sin(state.heading) - motion.z * Math.cos(state.heading);
  }
}

// Rectangle/rectangle SAT uses both hull and dock axes, so a diagonal bow
// cannot cut a pier corner and a parallel boat can pass close alongside it.
function dockContact(state, motion, sin, cos) {
  const ds = Math.sin(DOCK_HEADING), dc = Math.cos(DOCK_HEADING);
  const dx = state.position.x - DOCK_X, dz = state.position.z - DOCK_Z;
  let depth = Infinity, nx = 0, nz = 0;
  for (let axis = 0; axis < 4; axis++) {
    const ax = axis === 0 ? cos : axis === 1 ? sin : axis === 2 ? dc : ds;
    const az = axis === 0 ? -sin : axis === 1 ? cos : axis === 2 ? -ds : dc;
    const hull = HALF_BEAM * Math.abs(cos * ax - sin * az) + HALF_LENGTH * Math.abs(sin * ax + cos * az);
    const dock = DOCK_HALF_BEAM * Math.abs(dc * ax - ds * az) + DOCK_HALF_LENGTH * Math.abs(ds * ax + dc * az);
    const projection = dx * ax + dz * az;
    const overlap = hull + dock - Math.abs(projection);
    if (overlap <= 0) return;
    if (overlap < depth) {
      depth = overlap;
      const sign = projection < 0 ? -1 : 1;
      nx = ax * sign; nz = az * sign;
    }
  }
  contact(state, motion, nx, nz, depth);
}

/** Advance shared boat state with bounded integration and damped sideways slip. */
export function stepBoat(state, controls, frameDelta, visualTime = (state.visualTime ?? 0) + Math.min(Math.max(frameDelta, 0), 0.09)) {
  const profile = boatProfile(state.boatId);
  const delta = Math.min(Math.max(frameDelta, 0), 0.09);
  const steps = Math.max(1, Math.ceil(delta / (1 / 120)));
  const dt = delta / steps;
  const motion = (state.velocity ??= {
    x: -Math.sin(state.heading) * state.speed,
    z: -Math.cos(state.heading) * state.speed,
    resetId: state.resetId,
    lastSpeed: state.speed,
  });
  // Callers historically reset by clearing speed; also honor explicit resetId.
  if (motion.resetId !== state.resetId || (state.speed === 0 && motion.lastSpeed !== 0)) {
    state.beached = false; state.beachedTime = 0; state.angularVelocity = 0;
    motion.x = motion.z = 0;
    motion.resetId = state.resetId;
  }
  let steering = state.steering ?? 0;
  state.collided = false;
  state.visualTime = visualTime;
  const initialPose = !state.hullPose;
  if (initialPose) advanceBoatHullPose(state, visualTime, 0);
  for (let i = 0; i < steps; i++) {
    const throttle = Number(Boolean(controls.forward)) - Number(Boolean(controls.backward));
    const wheel = Number(Boolean(controls.left)) - Number(Boolean(controls.right));
    if (state.beached) {
      // Propellers and rudders cannot drive on sand; only existing momentum remains.
      const speed = Math.hypot(motion.x, motion.z);
      const x = state.position.x, z = state.position.z;
      const nx = x + motion.x * dt, nz = z + motion.z * dt;
      const rise = Math.max(0, gateTerrainHeight(nx, nz + 12, seabedHeightAt(nx, nz) + 0.012)
        - gateTerrainHeight(x, z + 12, seabedHeightAt(x, z) + 0.012));
      const uphillSpeed = Math.sqrt(Math.max(0, speed * speed - 2 * 9.81 * rise));
      // Sand ploughing opposes translation much more strongly than water drag.
      // Broadside slides dig in harder than a straight bow-first landing.
      const sideways = Math.abs(motion.x * Math.cos(state.heading) - motion.z * Math.sin(state.heading));
      // Build resistance as the hull leaves the wet shallows and bears on sand.
      const sandLoad = Math.max(0, Math.min(1, (1.10 - worldCoastalRadiusAt(x, z)) / 0.12));
      const sandResistance = controls.brake ? 8 : 2.1 + sandLoad * (2.5 + speed * 0.28 + sideways * 0.9);
      const drag = Math.max(0, (uphillSpeed - sandResistance * dt) / Math.max(speed, 0.001));
      motion.x *= drag; motion.z *= drag;
      state.angularVelocity *= Math.exp(-4.2 * dt);
      state.heading += state.angularVelocity * dt;
      state.position.x += motion.x * dt; state.position.z += motion.z * dt;
      state.speed = -motion.x * Math.sin(state.heading) - motion.z * Math.cos(state.heading);
      dockContact(state, motion, Math.sin(state.heading), Math.cos(state.heading));
      state.beachedTime += dt;
      continue;
    }
    const stroke = state.boatId === 'rowboat' ? .35 + 1.3 * Math.max(0, Math.sin((visualTime + i * dt) * ROWING_RATE)) : 1;
    state.speed += throttle * (throttle > 0 ? profile.acceleration : profile.reverseAcceleration) * stroke * dt;
    const friction = controls.brake ? profile.brakeDrag : throttle ? 0.16 : profile.coastDrag;
    state.speed *= Math.exp(-(friction + Math.abs(state.speed) * 0.035) * dt);
    state.speed = Math.min(profile.maxSpeed, Math.max(-profile.reverseSpeed, state.speed));
    if (Math.abs(state.speed) < 0.008 && !throttle) state.speed = 0;
    if (dt > 0) steering = wheel * Math.min(1, Math.abs(state.speed) / (controls.navigation ? 1.2 : 2.4)) * Math.sign(state.speed);
    state.heading += steering * profile.turnRate * dt;
    const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
    const lateral = (motion.x * cos - motion.z * sin) * Math.exp(-(controls.brake ? 10 : profile.lateralDrag) * dt);
    motion.x = -sin * state.speed + cos * lateral;
    motion.z = -cos * state.speed - sin * lateral;
    if (state.speed === 0 && Math.abs(lateral) < 0.008) motion.x = motion.z = 0;
    state.position.x += motion.x * dt;
    state.position.z += motion.z * dt;
    state.steering = steering;
    resolveHullCoast(state, visualTime);
    dockContact(state, motion, sin, cos);
    // The pier overlaps the shoreline; finish with an island separation there.
    if (state.collided) {
      state.speed = -motion.x * sin - motion.z * cos;
      resolveHullCoast(state, visualTime);
    }
    const radius = Math.hypot(state.position.x, state.position.z + 5);
    if (radius > WORLD_LIMIT - HALF_LENGTH) {
      const scale = (WORLD_LIMIT - HALF_LENGTH) / radius;
      state.position.x *= scale;
      state.position.z = (state.position.z + 5) * scale - 5;
      state.speed *= 0.8;
      motion.x *= 0.8; motion.z *= 0.8;
    }
  }
  // One footprint fit per frame. All substep contacts use the cached pose;
  // after the damped update, validate that same final pose before rendering.
  if (!initialPose) advanceBoatHullPose(state, visualTime, delta);
  resolveHullCoast(state, visualTime);
  if (state.beached) {
    if (seabedMaxHeightWithin(state.position.x, state.position.z, 2.6) < -0.65) {
      state.beached = false; state.beachedTime = 0;
    } else if (state.beachedTime >= 5) {
      resetBoatToWater(state);
      advanceBoatHullPose(state, visualTime, 0);
      return state;
    }
  } else if (!state.collided && seabedMaxHeightWithin(state.position.x, state.position.z, 2.6) < -0.65
    && Math.hypot(state.position.x - DOCK_X, state.position.z - DOCK_Z) > 6) {
    state.safeWater = { x: state.position.x, z: state.position.z, heading: state.heading };
  }
  motion.lastSpeed = state.speed;
  state.steering = steering;
  return state;
}

/** Keep rendered pose and coastal contact on one clock, including paused frames. */
export function stepBoatFrame(state, controls, frameDelta, paused = false, surfaceTime, terrainField = state.terrainField) {
  state.terrainField = terrainField;
  if (!paused) return stepBoat(state, controls, frameDelta,
    surfaceTime ?? (state.visualTime ?? 0) + Math.min(Math.max(frameDelta, 0), 0.09));
  state.visualTime ??= surfaceTime ?? 0;
  if (!state.hullPose) advanceBoatHullPose(state, state.visualTime, 0);
  // Ambient ocean time may continue. The occupied hull pose stays frozen, and
  // resume damps toward the current surface with at most .09s of integration.
  resolveHullCoast(state, state.visualTime);
  return state;
}
