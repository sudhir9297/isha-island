import { HULL_MESH, transformBoatHull } from "./BoatHull.js";
import { MOTOR_CONTACT_MESH } from "./BoatMotor.js";

const contactIndices = new Uint16Array(HULL_MESH.indices.length + MOTOR_CONTACT_MESH.indices.length);
contactIndices.set(HULL_MESH.indices);
for (let i = 0; i < MOTOR_CONTACT_MESH.indices.length; i++)
  contactIndices[HULL_MESH.indices.length + i] = MOTOR_CONTACT_MESH.indices[i] + HULL_MESH.positions.length / 3;
import { SEABED_GRID, seabedHeightAt, seabedMaxHeightWithin } from "./Seabed.js";

export function createHullContactScratch(includeMotor = true) {
  return {
    world: new Float64Array(HULL_MESH.positions.length + (includeMotor ? MOTOR_CONTACT_MESH.positions.length : 0)),
    indices: includeMotor ? contactIndices : HULL_MESH.indices, pose: {},
    polygonA: new Float64Array(24), polygonB: new Float64Array(24),
    margin: Infinity, gradientX: 0, gradientZ: 0, x: 0, z: 0,
    rock: null, minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  };
}

// Clip an actual hull triangle to a seabed triangle in XZ, retaining interpolated
// hull Y. The difference of two planes reaches its minimum at a polygon vertex.
// This includes triangle interiors and floor-grid ridges, not just hull vertices.
function triangleMargin(scratch, ia, ib, ic, ax, az, bx, bz, cx, cz, height, gx, gz) {
  const world = scratch.world;
  let input = scratch.polygonA, output = scratch.polygonB;
  for (let axis = 0; axis < 3; axis++) {
    input[axis] = world[ia + axis];
    input[axis + 3] = world[ib + axis];
    input[axis + 6] = world[ic + axis];
  }
  let count = 3;
  for (let edge = 0; edge < 3; edge++) {
    const ex = edge === 0 ? ax : edge === 1 ? bx : cx;
    const ez = edge === 0 ? az : edge === 1 ? bz : cz;
    const dx = (edge === 0 ? bx : edge === 1 ? cx : ax) - ex;
    const dz = (edge === 0 ? bz : edge === 1 ? cz : az) - ez;
    let nextCount = 0;
    for (let i = 0; i < count; i++) {
      const p = i * 3, q = ((i + count - 1) % count) * 3;
      const sideP = dx * (input[p + 2] - ez) - dz * (input[p] - ex);
      const sideQ = dx * (input[q + 2] - ez) - dz * (input[q] - ex);
      const insideP = sideP >= -1e-12, insideQ = sideQ >= -1e-12;
      if (insideP !== insideQ) {
        const t = sideQ / (sideQ - sideP), offset = nextCount++ * 3;
        for (let axis = 0; axis < 3; axis++) output[offset + axis] = input[q + axis] + t * (input[p + axis] - input[q + axis]);
      }
      if (insideP) {
        const offset = nextCount++ * 3;
        output[offset] = input[p]; output[offset + 1] = input[p + 1]; output[offset + 2] = input[p + 2];
      }
    }
    count = nextCount;
    if (!count) return;
    const swap = input; input = output; output = swap;
  }
  for (let p = 0; p < count * 3; p += 3) {
    const floor = height + gx * (input[p] - ax) + gz * (input[p + 2] - az);
    const margin = input[p + 1] - floor;
    if (margin < scratch.margin) {
      scratch.margin = margin;
      scratch.rock = null;
      scratch.gradientX = gx; scratch.gradientZ = gz;
      scratch.x = input[p]; scratch.z = input[p + 2];
    }

  }
}

const rockCache = new WeakMap();
function rockPlanes(field) {
  if (!field?.rockGroups) return [];
  let groups = rockCache.get(field);
  if (groups) return groups;
  groups = field.rockGroups.map(group => {
    const planes = [], p = group.triangles;
    for (let i = 0; i < p.length; i += 9) {
      const ax = p[i], ay = p[i + 1], az = p[i + 2];
      let bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
      let cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
      let area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (Math.abs(area) < 1e-10) continue;
      if (area < 0) { [bx, cx] = [cx, bx]; [by, cy] = [cy, by]; [bz, cz] = [cz, bz]; area = -area; }
      const gx = ((by - ay) * (cz - az) - (cy - ay) * (bz - az)) / area;
      const gz = ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / area;
      planes.push({ ax, az, bx, bz, cx, cz, height: ay, gx, gz,
        minX: Math.min(ax, bx, cx), maxX: Math.max(ax, bx, cx),
        minZ: Math.min(az, bz, cz), maxZ: Math.max(az, bz, cz), maxY: Math.max(ay, by, cy) });
    }
    return { ...group, planes };
  });
  rockCache.set(field, groups);
  return groups;
}

/** Measure triangle contact, returning a conservative floor bound in clear water. */
export function measureHullSeabed(state, time, scratch = createHullContactScratch()) {
  const world = transformBoatHull(state, time, scratch.world, scratch.pose);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
  for (let i = 0; i < world.length; i += 3) {
    minX = Math.min(minX, world[i]); maxX = Math.max(maxX, world[i]);
    minY = Math.min(minY, world[i + 1]);
    minZ = Math.min(minZ, world[i + 2]); maxZ = Math.max(maxZ, world[i + 2]);
  }
  const radius = Math.max(maxX - minX, maxZ - minZ) / 2;
  const floorBound = seabedMaxHeightWithin((minX + maxX) / 2, (minZ + maxZ) / 2, radius);
  scratch.minX = minX; scratch.maxX = maxX; scratch.minZ = minZ; scratch.maxZ = maxZ;
  scratch.rock = null;
  const rocks = rockPlanes(state.terrainField).filter(group => group.maxY >= minY - 0.002
    && group.maxX >= minX && group.minX <= maxX && group.maxZ >= minZ && group.minZ <= maxZ);
  scratch.margin = minY - Math.max(floorBound, ...rocks.map(group => group.maxY));
  scratch.gradientX = scratch.gradientZ = 0;
  if (scratch.margin > 0.002) return scratch;
  scratch.margin = Infinity;
  const { x: originX, z: originZ, step, columns, rows } = SEABED_GRID;
  const indices = scratch.indices;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const lowY = Math.min(world[a + 1], world[b + 1], world[c + 1]);
    const needFloor = lowY - floorBound <= Math.min(0.002, scratch.margin);
    const firstX = Math.max(0, Math.floor((Math.min(world[a], world[b], world[c]) - originX) / step));
    const lastX = Math.min(columns - 2, Math.floor((Math.max(world[a], world[b], world[c]) - originX) / step));
    const firstZ = Math.max(0, Math.floor((Math.min(world[a + 2], world[b + 2], world[c + 2]) - originZ) / step));
    const lastZ = Math.min(rows - 2, Math.floor((Math.max(world[a + 2], world[b + 2], world[c + 2]) - originZ) / step));
    if (needFloor) for (let iz = firstZ; iz <= lastZ; iz++) for (let ix = firstX; ix <= lastX; ix++) {
      const x = originX + ix * step, z = originZ + iz * step;
      const ha = seabedHeightAt(x, z), hb = seabedHeightAt(x + step, z);
      const hc = seabedHeightAt(x, z + step), hd = seabedHeightAt(x + step, z + step);
      if (lowY - Math.max(ha, hb, hc) <= Math.min(0.002, scratch.margin))
        triangleMargin(scratch, a, b, c, x, z, x + step, z, x, z + step, ha, (hb - ha) / step, (hc - ha) / step);
      if (lowY - Math.max(hb, hc, hd) <= Math.min(0.002, scratch.margin))
        triangleMargin(scratch, a, b, c, x + step, z + step, x, z + step, x + step, z, hd, (hd - hc) / step, (hd - hb) / step);
    }
    const triMinX = Math.min(world[a], world[b], world[c]), triMaxX = Math.max(world[a], world[b], world[c]);
    const triMinZ = Math.min(world[a + 2], world[b + 2], world[c + 2]), triMaxZ = Math.max(world[a + 2], world[b + 2], world[c + 2]);
    for (const group of rocks) for (const p of group.planes) {
      if (lowY - p.maxY > Math.min(0.002, scratch.margin) || p.maxX < triMinX || p.minX > triMaxX
        || p.maxZ < triMinZ || p.minZ > triMaxZ) continue;
      const before = scratch.margin;
      triangleMargin(scratch, a, b, c, p.ax, p.az, p.bx, p.bz, p.cx, p.cz, p.height, p.gx, p.gz);
      if (scratch.margin < before) scratch.rock = group;
    }
  }
  return scratch;
}
