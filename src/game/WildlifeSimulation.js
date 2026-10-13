import { SHORE, BOAT_SCALE, SEABED_Y } from "./WorldConfig.js";
import { seabedHeightAt, seabedMaxHeightWithin, SEABED_MAX_Y } from "./Seabed.js";

// World-space wildlife uses +X as its forward axis. This module has no renderer state.
export const WILDLIFE_SPECIES = Object.freeze({
  silver: { count: 24, behavior: "school", speed: 0.72, turn: 1.55, size: 0.27, footprint: 1.3, clearance: 0.11, downwardClearance: 0.09, depth: -1.05 },
  butterfly: { count: 10, behavior: "reef", speed: 0.3, turn: 1.9, size: 0.38, footprint: 1.05, clearance: 0.25, downwardClearance: 0.22, depth: -0.85 },
  parrot: { count: 8, behavior: "reef", speed: 0.43, turn: 1.4, size: 0.36, footprint: 1.3, clearance: 0.18, downwardClearance: 0.16, depth: -1.0 },
  manta: { count: 1, behavior: "glide", speed: 0.67, turn: 0.38, size: 1.05, footprint: 2.13, clearance: 0.56, downwardClearance: 0.55, depth: -1.55 },
  shark: { count: 1, behavior: "patrol", speed: 0.91, turn: 0.48, size: 0.95, footprint: 2.0, clearance: 0.72, downwardClearance: 0.47, depth: -1.55 },
});

const STEP = 1 / 60;
const TAU = Math.PI * 2;
const REEF_HOMES = [[-18.8, -12.2], [-16.1, -4.5], [-9.8, -0.8]];
export const SHARK_PATROL = Object.freeze({ x: -7, z: 5.5, radiusX: 8.5, radiusZ: 3.2 });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const SEDIMENT_FIELD = Object.freeze({ heightAt: seabedHeightAt, maxHeightWithin: seabedMaxHeightWithin, terrainMaxY: SEABED_MAX_Y });
function random(seed) {
  let n = seed >>> 0;
  return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; };
}

export function sharkCenterline(motion, distance) {
  const curvature = Math.max(-0.62, Math.min(0.62, motion?.turnCurvature || 0));
  if (distance >= 0 || !motion?.history?.length) {
    if (Math.abs(curvature) < 1e-6) return { x: distance, z: 0, tangent: 0 };
    return { x: Math.sin(curvature * distance) / curvature, z: (1 - Math.cos(curvature * distance)) / curvature, tangent: curvature * distance };
  }
  let remaining = -distance, newer = { x: motion.x, z: motion.z };
  const c = Math.cos(motion.heading), s = Math.sin(motion.heading);
  if (motion.historyLengths) {
    let low = 0, high = motion.history.length - 1;
    while (low < high) { const middle = (low + high) >> 1; if (motion.historyLengths[middle] < remaining) low = middle + 1; else high = middle; }
    const index = low, older = motion.history[index], previous = index ? motion.history[index - 1] : newer;
    const start = index ? motion.historyLengths[index - 1] : 0, length = Math.max(1e-8, motion.historyLengths[index] - start);
    const t = (remaining - start) / length, dx = previous.x - older.x, dz = previous.z - older.z;
    const x = previous.x - dx * t - motion.x, z = previous.z - dz * t - motion.z;
    return { x: x * c + z * s, z: -x * s + z * c, tangent: Math.atan2(-dx * s + dz * c, dx * c + dz * s) };
  }
  for (const older of motion.history) {
    const dx = newer.x - older.x, dz = newer.z - older.z, length = Math.hypot(dx, dz);
    if (length < 1e-8) { newer = older; continue; }
    if (remaining <= length) {
      const t = remaining / length, x = newer.x - dx * t - motion.x, z = newer.z - dz * t - motion.z;
      return { x: x * c + z * s, z: -x * s + z * c, tangent: Math.atan2(-dx * s + dz * c, dx * c + dz * s) };
    }
    remaining -= length; newer = older;
  }
  const last = motion.history.at(-1), previous = motion.history.at(-2) || last;
  const dx = previous.x - last.x, dz = previous.z - last.z, length = Math.max(1e-8, Math.hypot(dx, dz));
  const x = last.x - dx / length * remaining - motion.x, z = last.z - dz / length * remaining - motion.z;
  return { x: x * c + z * s, z: -x * s + z * c, tangent: Math.atan2(-dx * s + dz * c, dx * c + dz * s) };
}

function resetMotionHistory(a) {
  if (a.species !== "manta" && a.species !== "shark") return;
  a.turnVelocity = 0; a.turnCurvature = 0; a.tailTurnLag = 0; a.lagHeading = a.heading;
  a.history = Array.from({ length: 160 }, (_, i) => ({ x: a.x - Math.cos(a.heading) * i * 0.02, z: a.z - Math.sin(a.heading) * i * 0.02 }));
  a.historyLengths = Float64Array.from(a.history, (_, i) => i * 0.02);
}

function recordMotion(a, turnVelocity) {
  if (a.species !== "manta" && a.species !== "shark") return;
  a.turnVelocity = turnVelocity;
  a.turnCurvature += (clamp(turnVelocity / Math.max(a.speed, 0.3), -0.62, 0.62) - a.turnCurvature) * (1 - Math.exp(-STEP * 3));
  a.lagHeading = wrap(a.lagHeading + wrap(a.heading - a.lagHeading) * (1 - Math.exp(-STEP * 1.4)));
  a.tailTurnLag = clamp(wrap(a.lagHeading - a.heading), -0.35, 0.35);
  const latest = a.history[0];
  if (Math.hypot(a.x - latest.x, a.z - latest.z) > 0.012) {
    a.history.unshift({ x: a.x, z: a.z });
    if (a.history.length > 160) a.history.pop();
  }
  let distance = 0, previous = a;
  for (let i = 0; i < a.history.length; i++) {
    const point = a.history[i]; distance += Math.hypot(previous.x - point.x, previous.z - point.z);
    a.historyLengths[i] = distance; previous = point;
  }
}

export function shorelineDistance(x, z, padding = 0) {
  // Expanding both normalized axes by padding/minRadius contains the complete
  // Minkowski envelope of the island and an animal's circular body footprint.
  const expansion = 1 + padding / Math.min(SHORE.radiusX, SHORE.radiusZ);
  return Math.hypot((x - SHORE.x) / (SHORE.radiusX * expansion), (z - SHORE.z) / (SHORE.radiusZ * expansion));
}

export function wildlifeFootprintRadius(a) { return WILDLIFE_SPECIES[a.species].footprint * a.size; }

export function wildlifeTurnRate(a) { return WILDLIFE_SPECIES[a.species].turn * (1 + Math.min((a.alarm || 0) * 0.13, 0.45)); }

export function wildlifeDepthRange(a, terrain = SEDIMENT_FIELD, x = a.x, z = a.z) {
  const config = WILDLIFE_SPECIES[a.species], ratio = a.size / config.size;
  // Clearances contain actual vertices throughout the stroke and maximum bank.
  // Depth targets are bounded before interpolation, so a normal dive stops smoothly.
  const floor = terrain?.maxHeightWithin ? terrain.maxHeightWithin(x, z, wildlifeFootprintRadius(a)) : SEABED_Y;
  return [floor + 0.04 + config.downwardClearance * ratio, -0.24 - config.clearance * ratio];
}

function terrainPlacement(a, terrain) {
  const radius = wildlifeFootprintRadius(a), [minimumY, maximumY] = wildlifeDepthRange(a, terrain);
  if (minimumY <= maximumY && a.y >= minimumY && a.y <= maximumY) return false;
  // Spawn/rebinding recovery searches actual queried surfaces, preserving the seeded pose.
  // Ordinary movement never uses this relocation: it stops before entering a solid footprint.
  const originX = a.x, originZ = a.z;
  for (let ring = 1; ring <= 48; ring++) {
    const distance = ring * 0.25, samples = Math.max(12, Math.ceil(distance * 16));
    for (let i = 0; i < samples; i++) {
      const angle = a.phase + i / samples * TAU;
      const x = originX + Math.cos(angle) * distance, z = originZ + Math.sin(angle) * distance;
      if (shorelineDistance(x, z, radius + 0.24) < 1.002) continue;
      const [low, high] = wildlifeDepthRange(a, terrain, x, z);
      if (low > high || low > a.y || a.y > high) continue;
      a.x = x; a.z = z;
      return true;
    }
  }
  // An externally supplied field may cover the entire search area. Keep the animal
  // hidden until a legal water column is available rather than compressing its body.
  a.terrainUnavailable = true;
  return false;
}

export function bindWildlifeTerrain(simulation, terrain = SEDIMENT_FIELD) {
  simulation.terrainField = terrain || SEDIMENT_FIELD;
  simulation.terrainRelocations ??= 0;
  for (const a of simulation.animals) {
    a.terrainUnavailable = false;
    a.nextTerrainDecision = 0; a.terrainGuidance = null; a.terrainBlocked = false; a.terrainRiseY = -Infinity; a.terrainEscapeAngle = null;
    if (terrainPlacement(a, simulation.terrainField)) simulation.terrainRelocations++;
    if (a.species === "shark") {
      const config = WILDLIFE_SPECIES.shark, radius = wildlifeFootprintRadius(a) + 0.12;
      a.patrolX = SHARK_PATROL.x; a.patrolZ = SHARK_PATROL.z;
      // Keep encounters in the foreground. New coastal terrain can occupy the
      // nominal oval: shift it only as far seaward as its actual water column requires.
      for (let shift = 0; shift <= 12; shift += 0.5) {
        let legal = true;
        for (let i = 0; i < 40; i++) {
          const angle = i / 40 * TAU;
          const x = SHARK_PATROL.x + Math.cos(angle) * SHARK_PATROL.radiusX;
          const z = SHARK_PATROL.z + shift + Math.sin(angle) * SHARK_PATROL.radiusZ;
          const floor = simulation.terrainField.maxHeightWithin(x, z, radius) + 0.04 + config.downwardClearance * (a.size / config.size);
          if (floor > config.depth - 0.12) { legal = false; break; }
        }
        if (legal) { a.patrolZ = SHARK_PATROL.z + shift; break; }
      }
    }
    // Initialization may arrive beside a new wall. Choose a legal initial heading
    // before rendering; subsequent headings always respect the species turn rate.
    const radius = wildlifeFootprintRadius(a) + 0.12, distance = Math.max(0.9, a.speed / wildlifeTurnRate(a) * 2) + radius * 0.6;
    let score = Infinity, heading = a.heading;
    for (const offset of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const angle = a.heading + offset;
      let risk = 0;
      for (const fraction of [0.25, 1]) {
        const x = a.x + Math.cos(angle) * distance * fraction, z = a.z + Math.sin(angle) * distance * fraction;
        const config = WILDLIFE_SPECIES[a.species], ratio = a.size / config.size;
        const floor = simulation.terrainField.maxHeightWithin(x, z, radius) + 0.04 + config.downwardClearance * ratio;
        risk += Math.max(0, floor - a.y) * 100 + (shorelineDistance(x, z, radius + 0.24) < 1 ? 100 : 0);
      }
      const candidate = risk + Math.abs(offset);
      if (candidate < score) { score = candidate; heading = angle; }
    }
    a.heading = wrap(heading); a.vx = Math.cos(a.heading) * a.speed; a.vz = Math.sin(a.heading) * a.speed;
    a.terrainAvoidSide = Math.sin(a.phase) >= 0 ? 1 : -1; a.terrainAvoidUntil = 0;
    resetMotionHistory(a);
  }
  return simulation;
}

function boatSurface(a, boat, lookahead = 0) {
  const heading = boat.heading || 0, c = Math.cos(heading), s = Math.sin(heading);
  const bx = boat.x - s * (boat.speed || 0) * lookahead, bz = boat.z - c * (boat.speed || 0) * lookahead;
  const dx = a.x - bx, dz = a.z - bz, lx = dx * c - dz * s, lz = dx * s + dz * c;
  // Include the gunwale and the widest/longest currently selectable hull.
  const beam = 1.02 * BOAT_SCALE * 1.04, length = 2.1 * BOAT_SCALE * 1.04;
  let nx = lx - clamp(lx, -beam, beam), nz = lz - clamp(lz, -length, length);
  let distance = Math.hypot(nx, nz);
  if (distance < 1e-8) {
    if (beam - Math.abs(lx) < length - Math.abs(lz)) { nx = Math.sign(lx) || 1; nz = 0; distance = -(beam - Math.abs(lx)); }
    else { nx = 0; nz = Math.sign(lz) || 1; distance = -(length - Math.abs(lz)); }
  } else { nx /= distance; nz /= distance; }
  return { x: nx * c + nz * s, z: -nx * s + nz * c, gap: distance - wildlifeFootprintRadius(a) };
}

export function boatClearance(a, boat) { return boatSurface(a, boat).gap; }

export function createWildlife(seed = 93, terrain = SEDIMENT_FIELD) {
  const r = random(seed), animals = [];
  Object.entries(WILDLIFE_SPECIES).forEach(([species, config]) => {
    for (let i = 0; i < config.count; i++) {
      const phase = r() * TAU, home = REEF_HOMES[i % REEF_HOMES.length];
      let x, z;
      if (config.behavior === "school") {
        x = -8.5 + (r() - 0.5) * 4.1; z = 8 + (r() - 0.5) * 3.2;
      } else if (config.behavior === "reef") {
        x = home[0] + Math.cos(phase) * 1.7; z = home[1] + Math.sin(phase) * 1.7;
      } else if (species === "manta") { x = -23; z = 3.5; }
      else { x = SHARK_PATROL.x - 3.0; z = SHARK_PATROL.z + SHARK_PATROL.radiusZ * 0.94; }
      const heading = config.behavior === "school" ? 0.3 + (r() - 0.5) * 0.5 : species === "shark" ? 0 : phase;
      const size = config.size * (0.88 + r() * 0.24);
      const animal = { species, x, z, y: config.depth - r() * 0.24, heading,
        vx: Math.cos(heading) * config.speed, vz: Math.sin(heading) * config.speed,
        speed: config.speed, size, phase, trait: 0.86 + r() * 0.28,
        homeX: home[0], homeZ: home[1], bank: 0, stroke: phase, avoidance: 0, alarm: 0, predatorThreat: 0 };
      const [minimumY, maximumY] = wildlifeDepthRange(animal, null);
      animal.y = clamp(animal.y, minimumY, maximumY);
      animals.push(animal);
    }
  });
  // Spawn outside the same padded shoreline used by continuous steering.
  animals.forEach((a) => projectOutsideShore(a));
  return bindWildlifeTerrain({ animals, time: 0, accumulator: 0 }, terrain);
}

function projectOutsideShore(a) {
  const padding = wildlifeFootprintRadius(a) + 0.24;
  const d = shorelineDistance(a.x, a.z, padding);
  if (d < 1.002) {
    a.x = SHORE.x + (a.x - SHORE.x) / (d / 1.002); a.z = SHORE.z + (a.z - SHORE.z) / (d / 1.002);
  }
}

function schoolForce(a, animals) {
  let cx = 0, cz = 0, ax = 0, az = 0, sx = 0, sz = 0, n = 0;
  for (const b of animals) {
    if (a === b || b.species !== "silver") continue;
    const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 > 14) continue;
    cx += dx; cz += dz; ax += b.vx; az += b.vz; n++;
    if (d2 < 0.75 * 0.75) {
      sx -= dx / Math.max(d2, 0.025); sz -= dz / Math.max(d2, 0.025);
    }
  }
  if (!n) return [0, 0];
  return [cx / n * 0.32 + ax / n * 0.62 + sx * 0.46,
    cz / n * 0.32 + az / n * 0.62 + sz * 0.46];
}

function terrainSteering(a, terrain, time, intentX, intentZ) {
  if (a.terrainEscapeAngle !== null && a.terrainEscapeAngle !== undefined) {
    if (a.terrainBlocked || Math.hypot(a.x - a.terrainEscapeX, a.z - a.terrainEscapeZ) < 0.16) {
      return [Math.cos(a.terrainEscapeAngle), Math.sin(a.terrainEscapeAngle)];
    }
    a.terrainEscapeAngle = null; a.nextTerrainDecision = 0;
  }
  if (time < (a.nextTerrainDecision || 0) && !a.terrainBlocked) return a.terrainGuidance;
  a.nextTerrainDecision = time + 0.1;
  const radius = wildlifeFootprintRadius(a), distance = Math.max(1, a.speed / wildlifeTurnRate(a) * 2.1) + radius * 0.65;
  const requestedIntent = Math.atan2(intentZ, intentX);
  const intent = time < (a.terrainAvoidUntil || 0) && a.terrainGuidance ? Math.atan2(a.terrainGuidance[1], a.terrainGuidance[0]) : requestedIntent;
  const [, ceiling] = wildlifeDepthRange(a, terrain);
  let highest = -Infinity;
  for (const angle of [a.heading, intent]) {
    for (const fraction of [0.35, 1]) {
      const [floor] = wildlifeDepthRange(a, terrain, a.x + Math.cos(angle) * distance * fraction, a.z + Math.sin(angle) * distance * fraction);
      highest = Math.max(highest, floor);
    }
  }
  a.terrainTargetY = highest <= ceiling ? Math.min(ceiling, highest + 0.055) : -Infinity;
  if (highest <= a.y + 0.025 && highest <= ceiling && !a.terrainBlocked) {
    a.terrainGuidance = null; a.terrainAvoidUntil = 0; return null;
  }
  // Safety has final priority over social, boat and territorial steering. Sample
  // actual whole-body water columns along open flanks rather than reversing into a wall.
  let bestScore = Infinity, bestAngle = a.heading, bestFloor = -Infinity;
  const side = a.terrainAvoidSide || 1;
  const offsets = [0, 0.4 * side, -0.4 * side, 0.8 * side, -0.8 * side, 1.2 * side, -1.2 * side, 1.6 * side, -1.6 * side, 2.2 * side, -2.2 * side, Math.PI];
  for (const offset of offsets) {
    const angle = a.heading + offset;
    let floor = -Infinity, shorePenalty = 0;
    let x = a.x, z = a.z, predictedHeading = a.heading;
    const duration = Math.max(1.8, Math.min(4.4, distance / Math.max(a.speed, 0.2))), dt = duration / 8;
    for (let step = 0; step < 8; step++) {
      predictedHeading += clamp(wrap(angle - predictedHeading), -wildlifeTurnRate(a) * dt, wildlifeTurnRate(a) * dt);
      x += Math.cos(predictedHeading) * a.speed * dt; z += Math.sin(predictedHeading) * a.speed * dt;
      const config = WILDLIFE_SPECIES[a.species], ratio = a.size / config.size;
      floor = Math.max(floor, terrain.maxHeightWithin(x, z, radius + 0.12) + 0.04 + config.downwardClearance * ratio);
      if (shorelineDistance(x, z, radius + 0.24) < 1.01) shorePenalty += 100;
    }
    const score = Math.abs(wrap(angle - intent)) + Math.abs(offset) * 0.08 + (offset * side < 0 ? 0.04 : 0) + Math.max(0, floor - a.y + 0.015) * 20 + Math.max(0, floor - ceiling) * 1000 + shorePenalty;
    if (score < bestScore) { bestScore = score; bestAngle = angle; bestFloor = floor; }
  }
  a.terrainTargetY = bestFloor <= ceiling ? Math.min(ceiling, bestFloor + 0.055) : -Infinity;
  a.terrainGuidance = [Math.cos(bestAngle), Math.sin(bestAngle)];
  if (time >= (a.terrainAvoidUntil || 0)) a.terrainAvoidUntil = time + 1.1;
  return a.terrainGuidance;
}

function beginTerrainEscape(a, terrain) {
  let score = Infinity, angle = a.heading + Math.PI;
  for (const offset of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4, Math.PI]) {
    const heading = a.heading + offset;
    let risk = 0;
    for (const distance of [0.06, 0.16, 0.32]) {
      const x = a.x + Math.cos(heading) * distance, z = a.z + Math.sin(heading) * distance;
      const [floor, ceiling] = wildlifeDepthRange(a, terrain, x, z);
      risk += Math.max(0, floor - a.y) * 200 + Math.max(0, floor - ceiling) * 1000;
      if (shorelineDistance(x, z, wildlifeFootprintRadius(a) + 0.24) < 1.002) risk += 1000;
    }
    const candidate = risk + Math.abs(offset);
    if (candidate < score) { score = candidate; angle = heading; }
  }
  a.terrainEscapeAngle = angle; a.terrainEscapeX = a.x; a.terrainEscapeZ = a.z;
}

function desiredVelocity(a, animals, time, boat, terrain) {
  const config = WILDLIFE_SPECIES[a.species];
  let x = 0, z = 0;
  if (config.behavior === "school") {
    // A shared broad current gives the school a destination; neighbours shape its motion.
    const flow = time * 0.055 + 0.3;
    const tx = -8.5 + Math.sin(time * 0.065) * 4.4;
    const tz = 8 + Math.sin(time * 0.083) * 2.5;
    const social = schoolForce(a, animals);
    x = Math.cos(flow) * 0.47 + (tx - a.x) * 0.12 + social[0];
    z = Math.sin(flow) * 0.47 + (tz - a.z) * 0.12 + social[1];
  } else if (config.behavior === "reef") {
    const orbit = time * (a.species === "butterfly" ? 0.16 : 0.11) * a.trait + a.phase;
    const radius = a.species === "butterfly" ? 1.65 : 2.3;
    const tx = a.homeX + Math.cos(orbit) * radius + Math.sin(orbit * 2.1) * 0.38;
    const tz = a.homeZ + Math.sin(orbit) * radius * 0.78;
    x = (tx - a.x) * 0.7; z = (tz - a.z) * 0.7;
    // Solitary grazers leave space around one another instead of forming another school.
    for (const b of animals) if (b !== a && b.species === a.species) {
      const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.4) { x += dx / Math.max(d2, 0.02) * 0.12; z += dz / Math.max(d2, 0.02) * 0.12; }
    }
  } else if (config.behavior === "glide") {
    // Follow the tangent of a broad oval, with a gentle return to the glide corridor.
    const dx = (a.x + 22) / 6.2, dz = (a.z - 4.6) / 5.2;
    const angle = Math.atan2(dz, dx), radial = Math.hypot(dx, dz);
    x = -Math.sin(angle) - Math.cos(angle) * (radial - 1) * 1.5;
    z = Math.cos(angle) - Math.sin(angle) * (radial - 1) * 1.5;
  } else {
    const dx = (a.x - (a.patrolX ?? SHARK_PATROL.x)) / SHARK_PATROL.radiusX, dz = (a.z - (a.patrolZ ?? SHARK_PATROL.z)) / SHARK_PATROL.radiusZ;
    const angle = Math.atan2(dz, dx), radial = Math.hypot(dx, dz);
    x = Math.sin(angle) - Math.cos(angle) * (radial - 1) * 3.5;
    z = -Math.cos(angle) * SHARK_PATROL.radiusZ / SHARK_PATROL.radiusX - Math.sin(angle) * (radial - 1) * 3.5;
    const radius = ((SHARK_PATROL.radiusX * Math.sin(angle)) ** 2 + (SHARK_PATROL.radiusZ * Math.cos(angle)) ** 2) ** 1.5 / (SHARK_PATROL.radiusX * SHARK_PATROL.radiusZ);
    a.patrolSpeedLimit = config.turn * radius * 0.85;
  }
  const wobble = config.behavior === "reef" ? 0.1 : 0.035;
  x += Math.cos(time * 0.71 * a.trait + a.phase) * wobble;
  z += Math.sin(time * 0.63 * a.trait + a.phase) * wobble;

  a.predatorThreat = 0;
  if (config.behavior === "school" || config.behavior === "reef") {
    for (const predator of animals) {
      // Mantas are harmless gliders; small fish evade approaching sharks, then regroup.
      if (predator.species !== "shark") continue;
      const dx = a.x - predator.x - predator.vx * 0.7, dz = a.z - predator.z - predator.vz * 0.7;
      const distance = Math.hypot(dx, dz), gap = distance - wildlifeFootprintRadius(predator) - wildlifeFootprintRadius(a);
      const alert = config.behavior === "school" ? 4.4 : 3.2;
      if (gap < alert) {
        const threat = clamp((1 - gap / alert) ** 2 * 3.3, 0, 5);
        const safeDistance = Math.max(distance, 0.05);
        x += dx / safeDistance * threat; z += dz / safeDistance * threat;
        a.predatorThreat = Math.max(a.predatorThreat, threat);
      }
    }
  }

  // Anticipate the shoreline before a turn is required. The fallback projection is spawn/safety only.
  const padding = wildlifeFootprintRadius(a) + 0.24;
  const lookX = a.x + a.vx * 2.1, lookZ = a.z + a.vz * 2.1;
  const distance = shorelineDistance(lookX, lookZ, padding);
  if (distance < 1.32) {
    const nx = (lookX - SHORE.x) / SHORE.radiusX ** 2, nz = (lookZ - SHORE.z) / SHORE.radiusZ ** 2;
    const normalLength = Math.hypot(nx, nz);
    const weight = clamp((1.32 - distance) * 13, 0, 4.0);
    x += nx / normalLength * weight; z += nz / normalLength * weight;
  }
  a.avoidance = 0;
  if (boat) {
    const current = boatSurface(a, boat), predicted = boatSurface(a, boat, 0.6);
    const alert = config.behavior === "glide" || config.behavior === "patrol" ? 3.5 : 2.2;
    for (const surface of [current, predicted]) if (surface.gap < alert) {
      const weight = clamp((1 - surface.gap / alert) ** 2 * 4, 0, 8);
      x += surface.x * weight; z += surface.z * weight;
      a.avoidance = Math.max(a.avoidance, weight);
    }
  }
  return terrainSteering(a, terrain, time, x, z) || [x, z];
}

function substep(simulation, boat) {
  const { animals } = simulation;
  // Evaluate from one shared frame so school response does not depend on iteration order.
  const terrain = simulation.terrainField;
  const desired = animals.map((a) => desiredVelocity(a, animals, simulation.time, boat, terrain));
  animals.forEach((a, i) => {
    if (a.terrainUnavailable) return;
    const config = WILDLIFE_SPECIES[a.species], [dx, dz] = desired[i];
    const alarm = a.alarm || 0, response = a.predatorThreat > alarm ? 6 : 0.65;
    a.alarm = alarm + (a.predatorThreat - alarm) * (1 - Math.exp(-STEP * response));
    const turnRate = wildlifeTurnRate(a);
    const wantedHeading = Math.atan2(dz, dx), turn = wrap(wantedHeading - a.heading);
    const turnStep = clamp(turn, -turnRate * STEP, turnRate * STEP);
    a.heading = wrap(a.heading + turnStep);
    const cruise = Math.min(config.speed * a.trait, a.species === "shark" ? (a.patrolSpeedLimit || Infinity) : Infinity);
    const targetSpeed = cruise * (1 + Math.min(a.avoidance * 0.1, 0.45) + Math.min(a.alarm * 0.14, 0.65));
    a.speed += (targetSpeed - a.speed) * (1 - Math.exp(-STEP * 2));
    // Caudal sweeps provide a small twice-per-cycle thrust pulse; cadence rises with speed.
    const propulsion = a.species === "shark" ? 1 + Math.cos(a.stroke * 2) * 0.08 : 1;
    a.vx = Math.cos(a.heading) * a.speed * propulsion; a.vz = Math.sin(a.heading) * a.speed * propulsion;
    const bank = -turnStep / STEP / turnRate * (a.species === "manta" ? 0.08 : 0.035);
    a.bank += (bank - a.bank) * (1 - Math.exp(-STEP * 3));
    const dive = a.avoidance * (a.species === "silver" ? 0.09 : 0.035);
    const [minimumY, maximumY] = wildlifeDepthRange(a, terrain);
    const wantedY = clamp(Math.max(config.depth + Math.sin(simulation.time * 0.48 * a.trait + a.phase) * 0.12 - dive, a.terrainTargetY, a.terrainRiseY ?? -Infinity), minimumY, maximumY);
    a.y += (wantedY - a.y) * (1 - Math.exp(-STEP * 1.1));
    a.y = clamp(a.y, minimumY, maximumY);
    let nextX = a.x + a.vx * STEP, nextZ = a.z + a.vz * STEP;
    const shore = shorelineDistance(nextX, nextZ, wildlifeFootprintRadius(a) + 0.24);
    if (shore < 1.002) {
      nextX = SHORE.x + (nextX - SHORE.x) / (shore / 1.002); nextZ = SHORE.z + (nextZ - SHORE.z) / (shore / 1.002);
    }
    const [nextFloor, nextCeiling] = wildlifeDepthRange(a, terrain, nextX, nextZ);
    const wasBlocked = a.terrainBlocked;
    a.terrainBlocked = nextFloor > nextCeiling || nextFloor > a.y;
    if (!a.terrainBlocked) { a.x = nextX; a.z = nextZ; a.terrainRiseY = -Infinity; }
    else {
      a.vx = 0; a.vz = 0;
      a.terrainRiseY = nextFloor <= nextCeiling ? nextCeiling : -Infinity;
      if (!wasBlocked && a.terrainEscapeAngle == null) beginTerrainEscape(a, terrain);
    }
    recordMotion(a, turnStep / STEP);
    a.stroke += STEP * (a.species === "manta" ? 1.45 : a.species === "shark" ? 4.4 + a.speed * 1.6 : 7.6 + a.speed * 3);
  });
  simulation.time += STEP;
}

export function stepWildlife(simulation, delta, boat = null, terrain = simulation.terrainField) {
  const field = terrain || SEDIMENT_FIELD;
  if (simulation.terrainField !== field) bindWildlifeTerrain(simulation, field);
  if (!Number.isFinite(delta) || delta <= 0) return simulation;
  simulation.accumulator += Math.min(delta, 0.25);
  while (simulation.accumulator + 1e-10 >= STEP) {
    substep(simulation, boat);
    simulation.accumulator -= STEP;
  }
  return simulation;
}
