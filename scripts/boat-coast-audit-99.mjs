import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { Vector3, Matrix4, Euler } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createHash } from "node:crypto";
import { sampleOceanSurface } from "../src/game/WaterOptics.js";
import { BOATS } from "../src/game/BoatProfiles.js";
import { BOAT_SCALE, SHORE, SEABED_Y } from "../src/game/WorldConfig.js";
import { stepBoat, resolveHullCoast } from "../src/game/BoatPhysics.js";
import { HULL_MESH, boatHullPose } from "../src/game/BoatHull.js";
import { MOTOR_CONTACT_MESH, MOTOR_RENDER_MESH, MOTOR_POSITION, PROPELLER_POSITION, PROPELLER_GEOMETRY } from "../src/game/BoatMotor.js";
import { seabedHeightAt, createReefHeightField } from "../src/game/Seabed.js";

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
  const pose = boatHullPose(state, time);
  const model = new Matrix4().makeRotationFromEuler(new Euler(pose.pitch, 0, pose.roll, "XYZ"));
  model.scale(new Vector3(...profile.modelScale));
  model.setPosition(0, pose.bob, 0);
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
      let minimumMotorY = Infinity, motorMargin = Infinity, motorDraft = 0;
      for (const probe of motorProbes) {
        point.copy(probe).applyMatrix4(motorMatrix);
        const floor = seabedHeightAt(point.x, point.z), clearance = point.y - floor;
        minimumMotorY = Math.min(minimumMotorY, point.y);
        motorDraft = Math.max(motorDraft, sampleOceanSurface(point.x, point.z, time).height - point.y);
        motorMargin = Math.min(motorMargin, clearance);
        if (clearance < margin) { margin = clearance; worstPoint = [point.x, point.y, point.z, floor]; }
      }
      let actualMotorBottom = Infinity, actualMotorDraft = 0;
      for (const probe of actualMotorProbes) {
        point.copy(probe).applyMatrix4(motorMatrix);
        actualMotorBottom = Math.min(actualMotorBottom, point.y);
        actualMotorDraft = Math.max(actualMotorDraft, sampleOceanSurface(point.x, point.z, time).height - point.y);
      }
      const propMatrix = new Matrix4(), propLocal = new Matrix4();
      for (let phase = 0; phase < 6; phase++) {
        propLocal.makeRotationZ(phase * Math.PI / 9);
        propLocal.setPosition(...PROPELLER_POSITION);
        propMatrix.multiplyMatrices(motorMatrix, propLocal);
        let actualBottom = actualMotorBottom, actualDraft = actualMotorDraft;
        for (const probe of propProbes) {
          point.copy(probe).applyMatrix4(propMatrix);
          actualBottom = Math.min(actualBottom, point.y);
          const depth = sampleOceanSurface(point.x, point.z, time).height - point.y;
          actualDraft = Math.max(actualDraft, depth);
          result.minimumPropImmersion = Math.min(result.minimumPropImmersion, depth);
          const floor = seabedHeightAt(point.x, point.z), clearance = point.y - floor;
          motorMargin = Math.min(motorMargin, clearance);
          if (clearance < margin) { margin = clearance; worstPoint = [point.x, point.y, point.z, floor]; }
        }
        if (speed === 0) result.minimumActualIdleDraft = Math.min(result.minimumActualIdleDraft, actualDraft);
      }
      if (speed === 0) result.minimumContactEnvelopeIdleDraft = Math.min(result.minimumContactEnvelopeIdleDraft, motorDraft);
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
export function actualReefField() {
  const source = readFileSync(new URL("../src/game/Reef.jsx", import.meta.url), "utf8");
  const helpers = source.slice(source.indexOf("function random("), source.indexOf("// Preserve each species"));
  const object = source.match(/const assets = useMemo\(\(\) => \((\{[\s\S]*?\})\), \[\]\);/)[1]
    .replace("stoneField: reefStoneMaterialField(),", "stoneField: null,")
    .replace("contactMap: contactTexture(),", "contactMap: null,").replace("bump: brainTexture(),", "bump: null,");
  const body = source.match(/const layout = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[assets\]\);/)[1];
  const prefix = "const {BufferGeometry,Float32BufferAttribute,Color,Object3D,LatheGeometry,Vector2,SphereGeometry,CircleGeometry,TorusGeometry,CylinderGeometry,Vector3,CanvasTexture,RepeatWrapping,DoubleSide}=THREE;";
  const result = new Function("THREE", "mergeGeometries", "SEABED_Y", "seabedHeightAt", "createReefHeightField",
    prefix + helpers + "\nconst assets=(" + object + ");const makeLayout=()=>{" + body + "};return {assets,data:makeLayout()};")
    (THREE, mergeGeometries, SEABED_Y, seabedHeightAt, createReefHeightField);
  Object.values(result.assets).forEach(asset => asset?.dispose?.());
  return result.data.environment;
}

export function auditReef({ subdivisions = 3 } = {}) {
  const field = actualReefField(), point = new Vector3();
  const hull = createHullProbes(subdivisions), motor = createMeshProbes(MOTOR_CONTACT_MESH, subdivisions);
  const result = { rockCount: field.rockGroups.length, poses: 0, conflicts: 0, minimumMargin: Infinity, maximumCorrection: 0,
    rockTriangleHash: createHash("sha256").update(Buffer.concat(field.rockGroups.map(g => Buffer.from(g.triangles.buffer)))).digest("hex"), examples: [] };
  for (const rock of field.rockGroups) for (const profile of BOATS) for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const cx = (rock.minX + rock.maxX) / 2, cz = (rock.minZ + rock.maxZ) / 2;
    const state = { boatId: profile.id, position: new Vector3(cx - Math.sin(heading) * 1.85 * BOAT_SCALE,
      0, cz - Math.cos(heading) * 1.85 * BOAT_SCALE), heading, speed: 0, terrainField: field };
    const start = state.position.clone();
    stepBoat(state, {}, 0, 3);
    result.maximumCorrection = Math.max(result.maximumCorrection, state.position.distanceTo(start));
    const hullMatrix = renderedHullMatrix(state, profile, 3), motorMatrix = renderedMotorMatrix(state, profile, 3);
    let margin = Infinity;
    for (const [probes, matrix] of [[hull, hullMatrix], [motor, motorMatrix]]) for (const probe of probes) {
      point.copy(probe).applyMatrix4(matrix);
      margin = Math.min(margin, point.y - field.heightAt(point.x, point.z));
    }
    result.minimumMargin = Math.min(result.minimumMargin, margin); result.poses++;
    if (margin < -1e-7) {
      result.conflicts++;
      if (result.examples.length < 5) result.examples.push({ boat: profile.id, heading, start: start.toArray(), finish: state.position.toArray(), margin });
    }
  }
  return result;
}

if (process.argv[1]?.endsWith("boat-coast-audit-99.mjs")) {
  const result = auditCoast({ times: Array.from({ length: 21 }, (_, i) => i) });
  writeFileSync(new URL("./boat-coast-audit-99.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
