import { writeFileSync } from "node:fs";
import { Vector3, Matrix4, Euler } from "three";
import { BOATS } from "../src/game/BoatProfiles.js";
import { BOAT_SCALE, SHORE } from "../src/game/WorldConfig.js";
import { stepBoat, resolveHullCoast } from "../src/game/BoatPhysics.js";
import { HULL_MESH } from "../src/game/BoatHull.js";
import { MOTOR_CONTACT_MESH, MOTOR_RENDER_MESH, MOTOR_POSITION, PROPELLER_POSITION, PROPELLER_GEOMETRY } from "../src/game/BoatMotor.js";
import { seabedHeightAt } from "../src/game/Seabed.js";

// Independent Three matrix composition and barycentric probes across every skin
// triangle, at spacing below the physical terrain's .25m cell width.
export function createMeshProbes(mesh, subdivisions = 4) {
  const probes = Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
    new Vector3().fromArray(mesh.positions, i * 3));
  const indices = mesh.indices, vertices = mesh.positions;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    for (let u = 1; u < subdivisions; u++) for (let v = 1; v < subdivisions - u; v++) {
      const w = subdivisions - u - v;
      probes.push(new Vector3(
        (u * vertices[a] + v * vertices[b] + w * vertices[c]) / subdivisions,
        (u * vertices[a + 1] + v * vertices[b + 1] + w * vertices[c + 1]) / subdivisions,
        (u * vertices[a + 2] + v * vertices[b + 2] + w * vertices[c + 2]) / subdivisions,
      ));
    }
  }
  return probes;
}
export function createHullProbes(subdivisions = 4) {
  return createMeshProbes(HULL_MESH, subdivisions);
}
export function renderedMotorMatrix(state, profile, time, matrix = new Matrix4()) {
  renderedHullMatrix(state, profile, time, matrix);
  const motor = new Matrix4().makeRotationY((state.steering || 0) * 0.3);
  motor.setPosition(...MOTOR_POSITION);
  return matrix.multiply(motor);
}
export function renderedHullMatrix(state, profile, time, matrix = new Matrix4()) {
  const root = new Matrix4().makeRotationY(state.heading);
  root.scale(new Vector3(BOAT_SCALE, BOAT_SCALE, BOAT_SCALE));
  root.setPosition(state.position);
  const model = new Matrix4().makeRotationFromEuler(new Euler(
    Math.sin(time * 1.7 + 0.7) * 0.014 + Math.abs(state.speed) * 0.009,
    0,
    Math.sin(time * 1.3) * 0.016 - (state.steering || 0) * Math.abs(state.speed) * 0.012,
    "XYZ",
  ));
  model.scale(new Vector3(...profile.modelScale));
  model.setPosition(0, 0.08 + Math.sin(time * 1.75) * 0.025, 0);
  return matrix.multiplyMatrices(root, model);
}
export function auditCoast({ times = [0, 1, 2, 3], subdivisions = 4 } = {}) {
  const probes = createHullProbes(subdivisions), point = new Vector3();
  const motorProbes = createMeshProbes(MOTOR_CONTACT_MESH, subdivisions);
  const actualMotorProbes = createMeshProbes(MOTOR_RENDER_MESH, subdivisions);
  const propProbes = createMeshProbes({ positions: PROPELLER_GEOMETRY.attributes.position.array, indices: PROPELLER_GEOMETRY.index.array }, subdivisions);
  const result = { poses: 0, probesPerPose: probes.length + motorProbes.length + propProbes.length * 6, conflicts: 0,
    worstMargin: Infinity, worstMotorMargin: Infinity, minimumContactEnvelopeIdleDraft: Infinity, minimumActualIdleDraft: Infinity, minimumPropImmersion: Infinity, examples: [] };
  for (const profile of BOATS) for (let angle = 0; angle < 24; angle++) for (let heading = 0; heading < 8; heading++)
    for (const time of times) for (const speed of [0, profile.maxSpeed]) for (const steering of [-1, 0, 1]) {
      const a = angle * Math.PI / 12;
      const state = { boatId: profile.id, position: new Vector3(
        SHORE.x + (SHORE.radiusX + 1) * Math.cos(a), 0,
        SHORE.z + (SHORE.radiusZ + 1) * Math.sin(a)), heading: heading * Math.PI / 4, speed, steering };
      // Resolve shore and dock once, then exercise the full requested visual pose.
      stepBoat(state, {}, 0, time);
      state.speed = speed; state.steering = steering;
      state.velocity = undefined;
      resolveHullCoast(state, time);
      const matrix = renderedHullMatrix(state, profile, time);
      let margin = Infinity, worstPoint;
      for (const probe of probes) {
        point.copy(probe).applyMatrix4(matrix);
        const floor = seabedHeightAt(point.x, point.z), clearance = point.y - floor;
        if (clearance < margin) { margin = clearance; worstPoint = [point.x, point.y, point.z, floor]; }
      }
      const motorMatrix = renderedMotorMatrix(state, profile, time);
      let minimumMotorY = Infinity, motorMargin = Infinity;
      for (const probe of motorProbes) {
        point.copy(probe).applyMatrix4(motorMatrix);
        const floor = seabedHeightAt(point.x, point.z), clearance = point.y - floor;
        minimumMotorY = Math.min(minimumMotorY, point.y);
        motorMargin = Math.min(motorMargin, clearance);
        if (clearance < margin) { margin = clearance; worstPoint = [point.x, point.y, point.z, floor]; }
      }
      let actualMotorBottom = Infinity;
      for (const probe of actualMotorProbes) {
        point.copy(probe).applyMatrix4(motorMatrix);
        actualMotorBottom = Math.min(actualMotorBottom, point.y);
      }
      const propMatrix = new Matrix4(), propLocal = new Matrix4();
      for (let phase = 0; phase < 6; phase++) {
        propLocal.makeRotationZ(phase * Math.PI / 9);
        propLocal.setPosition(...PROPELLER_POSITION);
        propMatrix.multiplyMatrices(motorMatrix, propLocal);
        let actualBottom = actualMotorBottom;
        for (const probe of propProbes) {
          point.copy(probe).applyMatrix4(propMatrix);
          actualBottom = Math.min(actualBottom, point.y);
          result.minimumPropImmersion = Math.min(result.minimumPropImmersion, -0.08 - point.y);
          const floor = seabedHeightAt(point.x, point.z), clearance = point.y - floor;
          motorMargin = Math.min(motorMargin, clearance);
          if (clearance < margin) { margin = clearance; worstPoint = [point.x, point.y, point.z, floor]; }
        }
        if (speed === 0) result.minimumActualIdleDraft = Math.min(result.minimumActualIdleDraft, -0.08 - actualBottom);
      }
      if (speed === 0) result.minimumContactEnvelopeIdleDraft = Math.min(result.minimumContactEnvelopeIdleDraft, -0.08 - minimumMotorY);
      result.worstMotorMargin = Math.min(result.worstMotorMargin, motorMargin);
      result.poses++;
      result.worstMargin = Math.min(result.worstMargin, margin);
      if (margin < -1e-7) {
        result.conflicts++;
        if (result.examples.length < 5) result.examples.push({ boat: profile.id, position: state.position.toArray(), heading: state.heading, time, speed, steering, margin, point: worstPoint });
      }
    }
  return result;
}
if (process.argv[1]?.endsWith("boat-coast-audit-88.mjs")) {
  const result = auditCoast({ times: Array.from({ length: 21 }, (_, i) => i) });
  writeFileSync(new URL("./boat-coast-audit-92-motor-resolved.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
