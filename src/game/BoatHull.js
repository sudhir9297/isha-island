import { BOAT_SCALE } from "./WorldConfig.js";
import { gateTerrainHeight } from "./GateTerrain.js";
import { seabedHeightAt } from "./Seabed.js";
import { boatProfile } from "./BoatProfiles.js";
import { sampleOceanSurface, OCEAN_SEA_LEVEL } from "./WaterOptics.js";
import { MOTOR_CONTACT_MESH, MOTOR_POSITION, motorSteeringAngle } from "./BoatMotor.js";

export const HULL_STATIONS = [
  [-1.98, 0.025], [-1.82, 0.28], [-1.55, 0.52], [-1.18, 0.72],
  [-0.65, 0.84], [0, 0.89], [0.7, 0.87], [1.25, 0.82], [1.68, 0.76],
];
export const HULL_STATION_COUNT = 42;
export const HULL_PROFILE = [
  [-1, 0.55], [-1.035, 0.38], [-1.01, 0.2], [-0.985, 0.035],
  [-0.84, -0.02], [-0.44, -0.2], [0, -0.25], [0.44, -0.2],
  [0.84, -0.02], [0.985, 0.035], [1.01, 0.2], [1.035, 0.38], [1, 0.55],
];
export const INTERIOR_PROFILE = [
  [-1, 0.54], [-0.93, 0.3], [-0.68, 0.13], [0.68, 0.13], [0.93, 0.3], [1, 0.54],
];
export function widthAt(z) {
  for (let i = 1; i < HULL_STATIONS.length; i++) {
    if (z <= HULL_STATIONS[i][0]) {
      const [az, aw] = HULL_STATIONS[i - 1], [bz, bw] = HULL_STATIONS[i];
      return aw + (bw - aw) * (z - az) / (bz - az);
    }
  }
  return HULL_STATIONS.at(-1)[1];
}
export function createHullMeshData(interior = false) {
  const profile = interior ? INTERIOR_PROFILE : HULL_PROFILE;
  const positions = new Float32Array(HULL_STATION_COUNT * profile.length * 3);
  const indices = new Uint16Array((HULL_STATION_COUNT - 1) * (profile.length - 1) * 6);
  let p = 0, index = 0;
  for (let i = 0; i < HULL_STATION_COUNT; i++) {
    const z = -1.98 + (1.68 + 1.98) * i / (HULL_STATION_COUNT - 1);
    const width = Math.max(0.015, widthAt(z) - (interior ? 0.075 : 0));
    const sheer = Math.max(0, -z - 0.8) * 0.1;
    for (const [x, y] of profile) {
      positions[p++] = x * width;
      positions[p++] = y + sheer * Math.abs(x);
      positions[p++] = z;
    }
    if (i === HULL_STATION_COUNT - 1) continue;
    for (let j = 0; j < profile.length - 1; j++) {
      const a = i * profile.length + j, b = a + profile.length;
      indices.set([a, a + 1, b, a + 1, b + 1, b], index);
      index += 6;
    }
  }
  return { positions, indices };
}
export const HULL_MESH = createHullMeshData();

// The existing hull origin sits .1504m above the mean sea, placing the central
// keel .0696m below it. Keep that draft over the scaled hull footprint.
export const HULL_SURFACE_CLEARANCE = 0.08 * BOAT_SCALE - OCEAN_SEA_LEVEL;
const surfaceScratch = { normal: [0, 1, 0] };
const targetPose = {};

/** Area-weighted water plane beneath all 42 rendered hull stations. */
export function boatSurfacePose(state, time, target = {}, sample = sampleOceanSurface) {
  const [sx, , sz] = boatProfile(state.boatId).modelScale;
  const ch = Math.cos(state.heading), sh = Math.sin(state.heading);
  let weight = 0, xMean = 0, zMean = 0, hMean = 0;
  let xx = 0, zz = 0, xz = 0, xh = 0, zh = 0;
  for (let station = 0; station < HULL_STATION_COUNT; station++) {
    const localZ = -1.98 + 3.66 * station / (HULL_STATION_COUNT - 1);
    const width = Math.max(0.015, widthAt(localZ));
    // Trapezoidal longitudinal integration and Simpson beam integration.
    const longitudinal = station === 0 || station === HULL_STATION_COUNT - 1 ? 0.5 : 1;
    for (let beam = -1; beam <= 1; beam++) {
      const x = beam * width * BOAT_SCALE * sx;
      const z = localZ * BOAT_SCALE * sz;
      const w = width * longitudinal * (beam === 0 ? 4 : 1);
      const wx = state.position.x + ch * x + sh * z;
      const wz = state.position.z - sh * x + ch * z;
      let h = sample(wx, wz, time, surfaceScratch).height;
      if (state.beached) h = Math.max(h,
        gateTerrainHeight(wx, wz + 12, seabedHeightAt(wx, wz) + 0.012) + 0.18);
      weight += w; xMean += w * x; zMean += w * z; hMean += w * h;
      xx += w * x * x; zz += w * z * z; xz += w * x * z;
      xh += w * x * h; zh += w * z * h;
    }
  }
  xMean /= weight; zMean /= weight; hMean /= weight;
  xx -= weight * xMean * xMean; zz -= weight * zMean * zMean;
  xz -= weight * xMean * zMean; xh -= weight * xMean * hMean; zh -= weight * zMean * hMean;
  const determinant = xx * zz - xz * xz;
  const slopeX = (xh * zz - zh * xz) / determinant;
  const slopeZ = (zh * xx - xh * xz) / determinant;
  target.bob = (hMean - slopeX * xMean - slopeZ * zMean
    + HULL_SURFACE_CLEARANCE - state.position.y) / BOAT_SCALE;
  // XYZ rotation maps +Y to (-sin(roll),cos(roll)cos(pitch),cos(roll)sin(pitch)).
  target.roll = Math.asin(slopeX / Math.hypot(slopeX, 1, slopeZ))
    - (state.steering || 0) * Math.abs(state.speed) * 0.012;
  target.pitch = -Math.atan(slopeZ) + Math.abs(state.speed) * 0.009;
  return target;
}

/** A critically damped response, stepped on the bounded physics clock. */
export function advanceBoatHullPose(state, time, dt) {
  boatSurfacePose(state, time, targetPose);
  const reset = !state.hullPose || state.hullPose.resetId !== state.resetId
    || state.hullPose.boatId !== state.boatId;
  const pose = state.hullPose ??= {};
  if (reset) {
    Object.assign(pose, targetPose, { bobVelocity: 0, rollVelocity: 0, pitchVelocity: 0,
      resetId: state.resetId, boatId: state.boatId });
  } else {
    // Exact spring response at a fixed target is stable even after a suspended frame.
    for (const [axis, frequency] of [["bob", 9], ["roll", 7], ["pitch", 7]]) {
      const velocity = `${axis}Velocity`;
      const displacement = pose[axis] - targetPose[axis];
      const c = pose[velocity] + frequency * displacement;
      const decay = Math.exp(-frequency * dt);
      pose[axis] = targetPose[axis] + (displacement + c * dt) * decay;
      pose[velocity] = (pose[velocity] - frequency * c * dt) * decay;
    }
  }
  // Sand is a supporting surface: never spring through an uphill ramp.
  if (state.beached && pose.bob < targetPose.bob) {
    pose.bob = targetPose.bob;
    pose.bobVelocity = Math.max(0, pose.bobVelocity);
  }
  return pose;
}

/** The same cached XYZ pose is consumed by the renderer and coastal triangles. */
export function boatHullPose(state, time, target = {}) {
  const pose = state.hullPose ?? boatSurfacePose(state, time, target);
  target.bob = pose.bob; target.roll = pose.roll; target.pitch = pose.pitch;
  return target;
}
export function transformBoatHull(state, time, output, pose = {}) {
  boatHullPose(state, time, pose);
  const [sx, sy, sz] = boatProfile(state.boatId).modelScale;
  const cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
  const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  const ch = Math.cos(state.heading), sh = Math.sin(state.heading);
  const hull = HULL_MESH.positions, motor = MOTOR_CONTACT_MESH.positions;
  const ms = Math.sin(motorSteeringAngle(state)), mc = Math.cos(motorSteeringAngle(state));
  for (let i = 0; i < output.length; i += 3) {
    let lx, ly, lz;
    if (i < hull.length) {
      lx = hull[i]; ly = hull[i + 1]; lz = hull[i + 2];
    } else {
      const m = i - hull.length;
      lx = MOTOR_POSITION[0] + mc * motor[m] + ms * motor[m + 2];
      ly = MOTOR_POSITION[1] + motor[m + 1];
      lz = MOTOR_POSITION[2] - ms * motor[m] + mc * motor[m + 2];
    }
    const x = lx * sx, y = ly * sy, z = lz * sz;
    const rx = cr * x - sr * y, ry = sr * x + cr * y;
    const py = cp * ry - sp * z, pz = sp * ry + cp * z;
    output[i] = state.position.x + BOAT_SCALE * (ch * rx + sh * pz);
    output[i + 1] = state.position.y + BOAT_SCALE * (py + pose.bob);
    output[i + 2] = state.position.z + BOAT_SCALE * (-sh * rx + ch * pz);
  }
  return output;
}
