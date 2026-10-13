import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Object3D, Vector3 } from "three";
import { createWildlife, stepWildlife, shorelineDistance, wildlifeFootprintRadius, wildlifeDepthRange, wildlifeTurnRate, sharkCenterline, boatClearance, WILDLIFE_SPECIES, SHARK_PATROL } from "./WildlifeSimulation.js";
import { createWildlifeGeometry, deformMantaBody, deformMantaWings, deformShark, sharkSwimmingCenterline } from "./WildlifeGeometry.js";
import { SEABED_Y } from "./WorldConfig.js";
import { createReefHeightField } from "./Seabed.js";

const angularDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const cloneSimulation = (simulation) => ({ ...simulation, animals: structuredClone(simulation.animals) });
function advance(simulation, seconds, hz = 60, boat = null) {
  for (let i = 0; i < Math.round(seconds * hz); i++) stepWildlife(simulation, 1 / hz, boat);
  return simulation;
}

test("seeded wildlife has bounded, distinct populations and reproducible motion", () => {
  const a = createWildlife(93), b = createWildlife(93), c = createWildlife(94);
  assert.equal(a.animals.length, 44);
  for (const [species, config] of Object.entries(WILDLIFE_SPECIES)) assert.equal(a.animals.filter((f) => f.species === species).length, config.count);
  assert.deepEqual(a, b); assert.notDeepEqual(a.animals, c.animals);
  advance(a, 30); advance(b, 30); assert.deepEqual(a, b);
});

test("fixed substeps agree at 30 and 144 Hz and reject invalid delta", () => {
  const slow = advance(createWildlife(7), 12, 30), fast = advance(createWildlife(7), 12, 144);
  slow.animals.forEach((a, i) => {
    assert.ok(Math.hypot(a.x - fast.animals[i].x, a.z - fast.animals[i].z) < 1e-8);
    assert.ok(Math.abs(a.heading - fast.animals[i].heading) < 1e-8);
  });
  const before = cloneSimulation(slow);
  stepWildlife(slow, NaN); stepWildlife(slow, -10); assert.deepEqual(slow, before);
  stepWildlife(slow, 20); assert.ok(slow.time - before.time <= 0.251);
});

test("school cohesion retains neighbours, aligns headings and separates crowded fish", () => {
  const simulation = createWildlife(33), school = simulation.animals.filter((a) => a.species === "silver");
  const centre = () => [school.reduce((s, a) => s + a.x, 0) / school.length, school.reduce((s, a) => s + a.z, 0) / school.length];
  advance(simulation, 60);
  const [cx, cz] = centre();
  const meanRadius = school.reduce((s, a) => s + Math.hypot(a.x - cx, a.z - cz), 0) / school.length;
  const alignment = Math.hypot(school.reduce((s, a) => s + Math.cos(a.heading), 0), school.reduce((s, a) => s + Math.sin(a.heading), 0)) / school.length;
  assert.ok(meanRadius < 4.5, `school dispersed: ${meanRadius}`);
  assert.ok(alignment > 0.65, `school headings incoherent: ${alignment}`);
  school[0].x = school[1].x + 0.08; school[0].z = school[1].z;
  advance(simulation, 2);
  assert.ok(Math.hypot(school[0].x - school[1].x, school[0].z - school[1].z) > 0.25);
});

test("reef wanderers retain territories; manta and shark traverse broad distinct patrols", () => {
  const simulation = createWildlife(12), visited = { manta: [], shark: [] };
  for (let frame = 0; frame < 180 * 30; frame++) {
    stepWildlife(simulation, 1 / 30);
    for (const a of simulation.animals) {
      if (a.species === "butterfly" || a.species === "parrot") assert.ok(Math.hypot(a.x - a.homeX, a.z - a.homeZ) < 7.2);
      else if (visited[a.species] && frame % 30 === 0) visited[a.species].push([a.x, a.z]);
    }
  }
  const manta = visited.manta;
  assert.ok(Math.max(...manta.map((p) => p[0])) - Math.min(...manta.map((p) => p[0])) > 8);
  assert.ok(Math.max(...manta.map((p) => p[1])) - Math.min(...manta.map((p) => p[1])) > 7);
  const shark = visited.shark;
  assert.ok(Math.max(...shark.map((p) => p[0])) - Math.min(...shark.map((p) => p[0])) > 12);
  assert.ok(Math.max(...shark.map((p) => p[1])) - Math.min(...shark.map((p) => p[1])) > 5);
  let winding = 0, previous;
  const animal = simulation.animals.find((a) => a.species === "shark");
  shark.forEach(([x, z]) => {
    const dx = (x - animal.patrolX) / SHARK_PATROL.radiusX, dz = (z - animal.patrolZ) / SHARK_PATROL.radiusZ;
    assert.ok(Math.hypot(dx, dz) > 0.65 && Math.hypot(dx, dz) < 1.4, "shark left its foreground reef corridor");
    const angle = Math.atan2(dz, dx);
    if (previous !== undefined) winding += angularDifference(angle, previous);
    previous = angle;
  });
  assert.ok(Math.abs(winding) > Math.PI * 4, "shark did not complete two smooth patrol circuits");
});

test("a shark outside its new corridor returns smoothly without resetting its stroke", () => {
  const simulation = createWildlife(12), shark = simulation.animals.find((a) => a.species === "shark");
  shark.x = 20; shark.z = 8; shark.heading = 1;
  const stroke = shark.stroke;
  for (let frame = 0; frame < 120 * 60; frame++) {
    const x = shark.x, z = shark.z;
    stepWildlife(simulation, 1 / 60);
    assert.ok(Math.hypot(shark.x - x, shark.z - z) < 0.03);
  }
  assert.ok(shark.stroke > stroke);
  assert.ok(Math.hypot((shark.x - shark.patrolX) / SHARK_PATROL.radiusX, (shark.z - shark.patrolZ) / SHARK_PATROL.radiusZ) < 1.4);
});

test("manta wing flex propagates outward and bends the trailing silhouette", () => {
  const assets = createWildlifeGeometry(), wing = assets.manta.wings;
  const coordinates = wing.userData.wingCoordinates, rest = wing.userData.rest;
  let shoulder, tip, leading, trailing, centre;
  for (let i = 0; i < wing.attributes.position.count / 4; i++) {
    const span = coordinates[i * 2], chord = coordinates[i * 2 + 1];
    if (Math.abs(span - 0.39) < 0.03 && Math.abs(chord - 0.5) < 0.01) shoulder = i;
    if (span === 1 && Math.abs(chord - 0.5) < 0.01) tip = i;
    if (Math.abs(span - 0.56) < 0.03 && chord === 0) leading = i;
    if (Math.abs(span - 0.56) < 0.03 && chord === 1) trailing = i;
    if (span === 0 && chord === 0.5) centre = i;
  }
  assert.ok([shoulder, tip, leading, trailing, centre].every(Number.isInteger));
  const peaks = [-Infinity, -Infinity, -Infinity, -Infinity], lows = [Infinity, Infinity, Infinity, Infinity], phases = [], pitch = [];
  for (let i = 0; i < 240; i++) {
    const phase = i / 240 * Math.PI * 2;
    deformMantaWings(wing, phase);
    [shoulder, tip, leading, trailing].forEach((vertex, j) => {
      const displacement = wing.attributes.position.getY(vertex) - rest[vertex * 3 + 1];
      lows[j] = Math.min(lows[j], displacement);
      if (displacement > peaks[j]) { peaks[j] = displacement; phases[j] = phase; }
    });
    const p = wing.attributes.position;
    pitch.push(Math.atan2(p.getY(trailing) - p.getY(leading), p.getX(leading) - p.getX(trailing)));
    assert.equal(p.getY(centre), rest[centre * 3 + 1], "wing wave disturbed the quiet central disc");
    for (let vertex = 0; vertex < p.count; vertex++) if (coordinates[vertex * 2] <= 0.22) {
      assert.equal(p.getX(vertex), rest[vertex * 3], "central thorax pitched during a wing stroke");
      assert.equal(p.getY(vertex), rest[vertex * 3 + 1], "central thorax inflated during a wing stroke");
      assert.equal(p.getZ(vertex), rest[vertex * 3 + 2], "central thorax narrowed during a wing stroke");
    }
  }
  assert.ok(peaks[1] - lows[1] > 0.55, "tip stroke does not move through a readable power/recovery cycle");
  assert.ok(peaks[0] - lows[0] > 0.07 && peaks[0] - lows[0] < 0.2, "inner wing must drive the stroke without following the full tip amplitude");
  const lag = angularDifference(phases[1], phases[0]);
  assert.ok(lag > 0.8 && lag < 1.7, `wing flex has no meaningful outward travel: ${lag}`);
  const chordLag = angularDifference(phases[3], phases[2]);
  assert.ok(chordLag > 0.25 && chordLag < 1.4, `trailing edge did not follow the leading edge: ${chordLag}`);
  assert.ok(Math.max(...pitch) - Math.min(...pitch) > 0.2, "foil translates vertically without pitching its trailing edge");
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("manta head and both wings form one connected flattened disc", () => {
  const assets = createWildlifeGeometry(), disc = assets.manta.wings, rest = disc.userData.rest;
  const parent = Array.from({ length: disc.attributes.position.count }, (_, i) => i);
  const root = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < disc.index.count; i += 3) {
    const a = root(disc.index.getX(i)); parent[root(disc.index.getX(i + 1))] = a; parent[root(disc.index.getX(i + 2))] = a;
  }
  assert.equal(new Set(parent.map((_, i) => root(i))).size, 1);
  const centre = [];
  for (let i = 0; i < disc.attributes.position.count; i++) if (Math.abs(rest[i * 3 + 2]) < 1e-8) centre.push([rest[i * 3], rest[i * 3 + 1]]);
  assert.ok(centre.length > 20);
  assert.ok(Math.max(...centre.map((p) => p[0])) > 0.8 && Math.min(...centre.map((p) => p[0])) < -0.8);
  assert.ok(Math.max(...centre.map((p) => p[1])) - Math.min(...centre.map((p) => p[1])) < 0.17);
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("shark turn retains a firm forebody while the rear follows the historical swimming path", () => {
  const motion = { x: 0, z: 0, heading: Math.PI / 2, turnCurvature: 0.4,
    history: [{ x: 0, z: 0 }, { x: -0.3, z: -0.4 }, { x: -0.8, z: -0.6 }, { x: -1.4, z: -0.7 }] };
  const front = sharkCenterline(motion, 1.3), rear = sharkCenterline(motion, -1.3);
  assert.ok(front.z > 0.3 && front.tangent > 0.5);
  assert.ok(rear.z > 0.9 && rear.x < -0.5);
  assert.ok(Math.hypot(rear.x, rear.z) <= 1.3 + 1e-8);
  const assets = createWildlifeGeometry(), geometry = assets.shark.body;
  deformShark(geometry, 0.6, motion);
  const p = geometry.attributes.position, rest = geometry.userData.rest;
  let frontBend = 0, rearBend = 0;
  for (let i = 0; i < p.count; i++) {
    if (rest[i * 3] > 1) frontBend = Math.max(frontBend, Math.abs(p.getZ(i) - rest[i * 3 + 2]));
    if (rest[i * 3] < -1) rearBend = Math.max(rearBend, Math.abs(p.getZ(i) - rest[i * 3 + 2]));
  }
  assert.ok(frontBend < 0.025 && rearBend > 0.7, "turn must retain a firm anterior body while the rear follows the travelled path");
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("cruising shark sections rotate across the swimming curve with a quiet nose", () => {
  const assets = createWildlifeGeometry(), geometry = assets.shark.body, p = geometry.attributes.position, rest = geometry.userData.rest;
  const ring = 3, a = ring * 11 + 2, b = ring * 11 + 8, x = rest[a * 3];
  const wrist = [], midbody = [], angles = [];
  for (let frame = 0; frame < 240; frame++) {
    const stroke = frame / 240 * Math.PI * 2;
    deformShark(geometry, stroke);
    const centre = sharkSwimmingCenterline(x, stroke);
    const chordX = p.getX(a) - p.getX(b), chordZ = p.getZ(a) - p.getZ(b);
    assert.ok(Math.abs(chordX * Math.cos(centre.tangent) + chordZ * Math.sin(centre.tangent)) < 1e-6,
      "body section shears across the stroke curve instead of rotating with it");
    angles.push(Math.atan2(-chordX, chordZ));
    wrist.push(sharkSwimmingCenterline(-1.15, stroke).z);
    midbody.push(sharkSwimmingCenterline(0, stroke).z);
    assert.equal(sharkSwimmingCenterline(1, stroke).z, 0);
  }
  assert.ok(Math.max(...angles) - Math.min(...angles) > 0.3, "cruising trunk has no recurring stroke curvature");
  assert.ok(Math.max(...wrist) - Math.min(...wrist) > 0.5, "peduncle does not sweep through a visible stroke");
  assert.ok(Math.max(...midbody) - Math.min(...midbody) > 0.075, "swimming only moves the tail fin");
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("manta whip follows its travelled turn without shifting the front anatomy", () => {
  const assets = createWildlifeGeometry(), geometry = assets.manta.body, rest = geometry.userData.rest;
  const motion = { x: 0, z: 0, heading: 0, history: Array.from({ length: 160 }, (_, i) => {
    const s = -i * 0.02, k = 0.45;
    return { x: Math.sin(k * s) / k, z: (1 - Math.cos(k * s)) / k };
  }) };
  let tip = 0;
  for (let i = 0; i < geometry.attributes.position.count; i++) if (rest[i * 3] < rest[tip * 3]) tip = i;
  deformMantaBody(geometry, 0, motion);
  const p = geometry.attributes.position;
  assert.ok(p.getZ(tip) - rest[tip * 3 + 2] > 0.65, "tail stays aligned with root yaw instead of following the travelled curve");
  assert.ok(p.getX(tip) > rest[tip * 3] + 0.2, "turning whip fails to shorten its projected length");
  for (let i = 0; i < p.count; i++) if (rest[i * 3] > 0.3) {
    assert.equal(p.getX(i), rest[i * 3]); assert.equal(p.getY(i), rest[i * 3 + 1]); assert.equal(p.getZ(i), rest[i * 3 + 2]);
  }
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("shark forward travel pulses with its continuous caudal stroke", () => {
  const simulation = createWildlife(12), shark = simulation.animals.find((a) => a.species === "shark"), values = [];
  for (let frame = 0; frame < 6 * 60; frame++) {
    const x = shark.x, z = shark.z, stroke = shark.stroke;
    stepWildlife(simulation, 1 / 60);
    if (!shark.terrainBlocked) values.push([Math.cos(stroke * 2), Math.hypot(shark.x - x, shark.z - z) * 60 / shark.speed]);
  }
  const crest = values.filter(([phase]) => phase > 0.8).map(([, progress]) => progress), trough = values.filter(([phase]) => phase < -0.8).map(([, progress]) => progress);
  const mean = (a) => a.reduce((s, n) => s + n, 0) / a.length;
  assert.ok(crest.length > 8 && trough.length > 8);
  assert.ok(mean(crest) - mean(trough) > 0.13);
  assert.ok(shark.historyLengths.at(-1) > 1.7);
});

test("small fish evade an approaching shark, then regroup after it leaves", () => {
  const threatened = createWildlife(12), control = cloneSimulation(threatened);
  const predator = threatened.animals.find((a) => a.species === "shark");
  predator.x = -8.5; predator.z = 4.8; predator.heading = Math.PI / 2; predator.vx = 0; predator.vz = predator.speed;
  control.animals = control.animals.filter((a) => a.species !== "shark");
  advance(threatened, 3); advance(control, 3);
  const school = threatened.animals.filter((a) => a.species === "silver"), baseline = control.animals.filter((a) => a.species === "silver");
  const distance = (group) => group.reduce((n, a) => n + Math.hypot(a.x - predator.x, a.z - predator.z), 0) / group.length;
  assert.ok(distance(school) > distance(baseline) + 0.5);
  assert.ok(school.some((a) => a.alarm > 1));
  assert.ok(school.some((a) => a.speed > WILDLIFE_SPECIES.silver.speed * a.trait * 1.15));
  threatened.animals = threatened.animals.filter((a) => a.species !== "shark");
  advance(threatened, 20);
  assert.ok(school.every((a) => a.alarm < 0.001));
  const cx = school.reduce((n, a) => n + a.x, 0) / school.length, cz = school.reduce((n, a) => n + a.z, 0) / school.length;
  assert.ok(school.reduce((n, a) => n + Math.hypot(a.x - cx, a.z - cz), 0) / school.length < 3);
  const alignment = Math.hypot(school.reduce((n, a) => n + Math.cos(a.heading), 0), school.reduce((n, a) => n + Math.sin(a.heading), 0)) / school.length;
  assert.ok(alignment > 0.75);
});

test("manta tail flexes behind a stable head; shark caudal fin articulates behind its stable nose", () => {
  const assets = createWildlifeGeometry(), manta = assets.manta.body, shark = assets.shark.body;
  const mantaRest = manta.userData.rest, sharkRest = shark.userData.rest, [start, end] = shark.userData.caudalRange;
  let mantaTip = 0;
  for (let i = 0; i < manta.attributes.position.count; i++) if (mantaRest[i * 3] < mantaRest[mantaTip * 3]) mantaTip = i;
  const tailZ = [], sharkZ = [];
  const caudalDistance = (a, b) => Math.hypot(sharkRest[a * 3] - sharkRest[b * 3], sharkRest[a * 3 + 1] - sharkRest[b * 3 + 1], sharkRest[a * 3 + 2] - sharkRest[b * 3 + 2]);
  const originalDistance = caudalDistance(start + 1, end - 1);
  for (let frame = 0; frame < 240; frame++) {
    const stroke = frame / 240 * Math.PI * 2;
    deformMantaBody(manta, stroke / 0.65); deformShark(shark, stroke);
    tailZ.push(manta.attributes.position.getZ(mantaTip)); sharkZ.push(shark.attributes.position.getZ(start + 1));
    for (let i = 0; i < manta.attributes.position.count; i++) if (mantaRest[i * 3] > 0.3) {
      assert.equal(manta.attributes.position.getY(i), mantaRest[i * 3 + 1]);
      assert.equal(manta.attributes.position.getZ(i), mantaRest[i * 3 + 2]);
    }
    for (let i = 0; i < shark.attributes.position.count; i++) if (sharkRest[i * 3] > 0.8) {
      assert.equal(shark.attributes.position.getX(i), sharkRest[i * 3]);
      assert.equal(shark.attributes.position.getZ(i), sharkRest[i * 3 + 2]);
    }
    const p = shark.attributes.position;
    const distance = Math.hypot(p.getX(start + 1) - p.getX(end - 1), p.getY(start + 1) - p.getY(end - 1), p.getZ(start + 1) - p.getZ(end - 1));
    assert.ok(Math.abs(distance - originalDistance) < 1e-6, "caudal fin changed shape instead of articulating at its wrist");
  }
  assert.ok(Math.max(...tailZ) - Math.min(...tailZ) > 0.18);
  assert.ok(Math.max(...sharkZ) - Math.min(...sharkZ) > 0.3);
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("nearby boats trigger separation and turns remain bounded", () => {
  const threatened = createWildlife(8), control = cloneSimulation(threatened);
  const a = threatened.animals[0], boat = { x: a.x + Math.cos(a.heading) * 1.6, z: a.z + Math.sin(a.heading) * 1.6, speed: 0, heading: 0 };
  let sawAvoidance = false;
  for (let i = 0; i < 120; i++) {
    const headings = threatened.animals.map((a) => a.heading);
    stepWildlife(threatened, 1 / 60, boat); stepWildlife(control, 1 / 60);
    threatened.animals.forEach((animal, j) => assert.ok(Math.abs(angularDifference(animal.heading, headings[j])) <= wildlifeTurnRate(animal) / 60 + 1e-9));
    sawAvoidance ||= a.avoidance > 0.2;
  }
  assert.ok(sawAvoidance);
  const distance = (animal) => Math.hypot(animal.x - boat.x, animal.z - boat.z);
  assert.ok(distance(a) > distance(control.animals[0]) + 0.25, "boat avoidance did not increase clearance");
});

test("boat clearance includes the oriented gunwale and each animal's complete footprint", () => {
  const shark = createWildlife(1).animals.find((a) => a.species === "shark");
  shark.x = 0; shark.z = 4;
  const bowGap = boatClearance(shark, { x: 0, z: 0, heading: 0 });
  const sideGap = boatClearance(shark, { x: 0, z: 0, heading: Math.PI / 2 });
  assert.ok(sideGap > bowGap + 0.8);
  shark.x = 4; shark.z = 0;
  assert.ok(Math.abs(boatClearance(shark, { x: 0, z: 0, heading: Math.PI / 2 }) - bowGap) < 1e-8);
  shark.x = 0; shark.z = 0;
  assert.ok(boatClearance(shark, { x: 0, z: 0, heading: 0 }) < -wildlifeFootprintRadius(shark));
});

test("long runs stay finite, outside shore, submerged and move without jumps", () => {
  const simulation = createWildlife(4);
  for (let i = 0; i < 300 * 30; i++) {
    const positions = simulation.animals.map((a) => [a.x, a.z]);
    const t = i / 30, boat = { x: -13 + Math.sin(t * 0.06) * 8, z: 4 + Math.cos(t * 0.09) * 8, heading: t * 0.1, speed: 3 };
    stepWildlife(simulation, 1 / 30, boat);
    simulation.animals.forEach((a, j) => {
      assert.ok([a.x, a.y, a.z, a.heading, a.size, a.speed].every(Number.isFinite));
      assert.ok(shorelineDistance(a.x, a.z, wildlifeFootprintRadius(a) + 0.24) >= 1.0019);
      assert.ok(a.y + WILDLIFE_SPECIES[a.species].clearance * a.size / WILDLIFE_SPECIES[a.species].size <= -0.24 + 1e-8);
      assert.ok(a.y - WILDLIFE_SPECIES[a.species].downwardClearance * a.size / WILDLIFE_SPECIES[a.species].size >= SEABED_Y + 0.04 - 1e-8);
      assert.ok(Math.hypot(a.x - positions[j][0], a.z - positions[j][1]) < 0.12, `jump in ${a.species}`);
    });
  }
});

test("maximum boat avoidance dives stop smoothly above the seabed for every species", () => {
  for (const [species, config] of Object.entries(WILDLIFE_SPECIES)) {
    const simulation = createWildlife(93), animal = simulation.animals.find((a) => a.species === species);
    simulation.animals = [animal];
    animal.x = -25; animal.z = 12; animal.size = config.size * 1.12;
    const [minimumY, maximumY] = wildlifeDepthRange(animal);
    animal.y = Math.max(minimumY, Math.min(maximumY, config.depth));
    let lowestY = animal.y;
    for (let frame = 0; frame < 60 * 60; frame++) {
      const previousY = animal.y;
      // Sustained maximum threat exercises the strongest dive continuously, rather than a brief fly-by.
      stepWildlife(simulation, 1 / 60, { x: animal.x, z: animal.z, heading: 0, speed: 0 });
      assert.equal(animal.avoidance, 8);
      assert.ok(animal.y >= minimumY - 1e-8 && animal.y <= maximumY + 1e-8);
      assert.ok(Math.abs(animal.y - previousY) < 0.02, `${species} vertical response jumped`);
      lowestY = Math.min(lowestY, animal.y);
    }
    // Anticipatory terrain steering keeps a 5.5cm ascent cushion above the hard depth limit.
    if (species === "manta" || species === "shark") assert.ok(lowestY < minimumY + 0.065, `${species} test did not exercise its floor limit`);
  }
});

test("all seeded spawns fit between the shared seabed and sea surface", () => {
  for (let seed = 0; seed < 200; seed++) for (const animal of createWildlife(seed).animals) {
    const [minimumY, maximumY] = wildlifeDepthRange(animal);
    assert.ok(minimumY < maximumY);
    assert.ok(animal.y >= minimumY && animal.y <= maximumY);
  }
});

test("actual triangle fields keep full bodies clear without hiding, normal relocations or prolonged stalls", () => {
  const rock = new BoxGeometry(2.2, 2, 2.4).toNonIndexed();
  const field = createReefHeightField(rock, [{ position: [-18.5, SEABED_Y, -10.1], scale: [0.7, 1.4, 0.7], angle: 0.43 }]);
  const simulation = createWildlife(93, field), relocations = simulation.terrainRelocations;
  const stopped = new Array(simulation.animals.length).fill(0), travelled = new Array(simulation.animals.length).fill(0);
  for (let frame = 0; frame < 120 * 60; frame++) {
    const previous = simulation.animals.map((a) => [a.x, a.y, a.z, a.stroke]);
    stepWildlife(simulation, 1 / 60, null, field);
    assert.equal(simulation.terrainRelocations, relocations);
    simulation.animals.forEach((a, i) => {
      assert.equal(a.terrainUnavailable, false);
      const config = WILDLIFE_SPECIES[a.species], ratio = a.size / config.size;
      const terrain = field.maxHeightWithin(a.x, a.z, wildlifeFootprintRadius(a));
      assert.ok(a.y - config.downwardClearance * ratio >= terrain + 0.04 - 1e-7);
      assert.ok(a.y + config.clearance * ratio <= -0.24 + 1e-7);
      assert.ok(a.stroke > previous[i][3]);
      const distance = Math.hypot(a.x - previous[i][0], a.z - previous[i][2]);
      travelled[i] += distance;
      stopped[i] = distance < 1e-5 ? stopped[i] + 1 / 60 : 0;
      assert.ok(stopped[i] <= 2, `${a.species} stopped instead of finding a clear flank`);
      assert.ok(Math.hypot(distance, a.y - previous[i][1]) < 0.07, `${a.species} repositioned during an ordinary step`);
    });
  }
  assert.ok(travelled.every((distance) => distance > 12));
  rock.dispose();
});

test("binding a new authored field recovers an occupied spawn once without resetting anatomy or stroke", () => {
  const rock = new BoxGeometry(2.2, 2, 2.4).toNonIndexed();
  const field = createReefHeightField(rock, [{ position: [-23, SEABED_Y, 4.6], scale: [1, 1.4, 1], angle: 0.43 }]);
  const simulation = createWildlife(7), manta = simulation.animals.find((a) => a.species === "manta");
  manta.x = -23; manta.z = 4.6;
  const { size, stroke } = manta;
  stepWildlife(simulation, 0, null, field);
  const count = simulation.terrainRelocations;
  assert.equal(manta.size, size); assert.equal(manta.stroke, stroke); assert.equal(manta.terrainUnavailable, false);
  const [floor, ceiling] = wildlifeDepthRange(manta, field);
  assert.ok(manta.y >= floor && manta.y <= ceiling);
  stepWildlife(simulation, 0, null, field);
  assert.equal(simulation.terrainRelocations, count);
  rock.dispose();
});

test("actual animated vertices fit both floor and sea clearances throughout the stroke and bank cycle", () => {
  const assets = createWildlifeGeometry(), transform = new Object3D(), point = new Vector3();
  for (let i = 0; i < 720; i++) {
    const stroke = i / 720 * Math.PI * 2;
    // The whip has a slower cycle; sample that full cycle independently of the membrane.
    deformMantaWings(assets.manta.wings, stroke); deformMantaBody(assets.manta.body, stroke / 0.65); deformShark(assets.shark.body, stroke);
    for (const [species, parts] of Object.entries(assets)) {
      const config = WILDLIFE_SPECIES[species], size = config.size * 1.12;
      const bank = species === "manta" ? 0.08 : 0.035;
      const [floorDepth, surfaceDepth] = wildlifeDepthRange({ species, size }, null);
      transform.position.set(0, surfaceDepth, 0);
      transform.scale.setScalar(size);
      for (const bankAngle of [-bank, 0, bank]) {
        transform.rotation.set(bankAngle, stroke, 0, "YXZ"); transform.updateMatrixWorld(true);
        for (const [name, geometry] of Object.entries(parts)) {
          if (!geometry?.attributes) continue;
          for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
          const p = geometry.attributes.position;
          for (let j = 0; j < p.count; j++) {
            point.fromBufferAttribute(p, j);
            if (name === "tail") {
              const tailAngle = Math.sin(stroke) * 0.46;
              const x = point.x * Math.cos(tailAngle) + point.z * Math.sin(tailAngle);
              point.z = -point.x * Math.sin(tailAngle) + point.z * Math.cos(tailAngle); point.x = x + parts.tailX;
            }
            point.applyMatrix4(transform.matrixWorld);
            assert.ok(point.y <= -0.24 + 1e-6, `${species}/${name} breaches sea clearance at ${point.y}`);
            // Translating the same transformed vertex to its deepest allowed centre audits the actual lower extent.
            const floorVertexY = point.y - surfaceDepth + floorDepth;
            assert.ok(floorVertexY >= SEABED_Y + 0.04 - 1e-6, `${species}/${name} breaches the seabed at ${floorVertexY}`);
            assert.ok(Math.hypot(point.x, point.z) <= config.footprint * size, `${species}/${name} exceeds its shoreline/boat footprint`);
          }
        }
      }
    }
  }
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});

test("turning predator poses remain inside their real depth and footprint envelopes", () => {
  const assets = createWildlifeGeometry(), point = new Vector3();
  for (const turn of [-1, 0, 1]) {
    const curvature = turn * 1.1;
    const history = Array.from({ length: 160 }, (_, i) => {
      const distance = -i * 0.02;
      return curvature ? { x: Math.sin(curvature * distance) / curvature, z: (1 - Math.cos(curvature * distance)) / curvature } : { x: distance, z: 0 };
    });
    const motion = { x: 0, z: 0, heading: 0, history, turnCurvature: turn * 0.62, turnVelocity: turn * 0.38, tailTurnLag: turn * 0.35 };
    for (let frame = 0; frame < 720; frame++) {
      const stroke = frame / 720 * Math.PI * 2;
      deformMantaWings(assets.manta.wings, stroke, motion); deformMantaBody(assets.manta.body, stroke / 0.65, motion); deformShark(assets.shark.body, stroke, motion);
      for (const species of ["manta", "shark"]) {
        const config = WILDLIFE_SPECIES[species], size = config.size * 1.12, bank = species === "manta" ? 0.08 : 0.035;
        for (const roll of [-bank, bank]) for (const geometry of Object.values(assets[species])) {
          const p = geometry.attributes.position;
          for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i);
            const y = (point.y * Math.cos(roll) - point.z * Math.sin(roll)) * size;
            const z = (point.y * Math.sin(roll) + point.z * Math.cos(roll)) * size;
            assert.ok(y >= -config.downwardClearance * 1.12 && y <= config.clearance * 1.12, `${species} turn/stroke breaches its depth envelope`);
            assert.ok(Math.hypot(point.x * size, z) <= config.footprint * size, `${species} turn/stroke breaches its physical footprint`);
          }
        }
      }
    }
  }
  Object.values(assets).forEach((parts) => Object.values(parts).forEach((g) => g?.dispose?.()));
});
