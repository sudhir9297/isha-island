import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { boatProfile } from '../src/game/BoatProfiles.js';
import { BOAT_SCALE } from '../src/game/WorldConfig.js';
import { sampleOceanSurface } from '../src/game/WaterOptics.js';
import { boatSurfacePose } from '../src/game/BoatHull.js';
import { stepBoatFrame } from '../src/game/BoatPhysics.js';
import { createFoamTexture } from '../src/game/BoatFoam.js';
import { actualReefField } from './boat-coast-audit-99.mjs';

// Runs the actual React frame closure against real Three objects. Timed frames
// exclude assertions, geometry creation, file I/O, and component compilation.
const source = readFileSync(new URL('../src/game/Boat.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const Wake = memo(function Wake(');
const bodyStart = source.indexOf('{\n', start) + 2;
const bodyEnd = source.indexOf('\n  return (', bodyStart);
const setup = new Function('useRef', 'useMemo', 'useEffect', 'useFrame', 'THREE',
  'boatProfile', 'BOAT_SCALE', 'createFoamTexture', 'FOAM_COUNT', 'boatState', 'paused', 'sampleOceanSurface',
  source.slice(bodyStart, bodyEnd));
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
const stats = values => ({ meanMs: values.reduce((s, v) => s + v, 0) / values.length,
  p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), maxMs: Math.max(...values) });
const field = actualReefField();
const reports = [];
for (const [name, x, z, speed] of [['idle-open', -25, 10, 0], ['moving-open', -25, 10, 8.4], ['moving-coast', 15.8, -12, 8.4]]) {
  const refs = []; let callback; let time = 3, sampleCount = 0;
  const state = { boatId: 'runabout', position: new THREE.Vector3(x, 0, z), heading: Math.PI / 2,
    speed, resetId: 1, terrainField: field };
  const measuredSample = (...args) => { sampleCount++; return sampleOceanSurface(...args); };
  setup(value => { const ref = { current: value }; refs.push(ref); return ref; }, f => f(), () => {}, f => { callback = f; },
    THREE, boatProfile, BOAT_SCALE, createFoamTexture, 300, { current: state }, false, measuredSample);
  const geometry = new THREE.PlaneGeometry(2, 2);
  geometry.setAttribute('instanceFade', new THREE.InstancedBufferAttribute(new Float32Array(300), 1));
  geometry.setAttribute('instanceSeed', new THREE.InstancedBufferAttribute(new Float32Array(300), 1));
  refs[0].current = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 300);
  refs[1].current = new THREE.Object3D();
  refs[2].current = { uniforms: { uTime: { value: 0 }, uSpeed: { value: 0 } } };
  refs[3].current = { geometry: new THREE.PlaneGeometry(3.1 * BOAT_SCALE, 4.8 * BOAT_SCALE, 14, 22) };
  const poseTarget = {}, poseTimes = [], physicsTimes = [], wakeTimes = [], counts = [];
  for (let i = 0; i < 300; i++) {
    time += 1 / 60;
    // Keep each controlled scene location stable while exercising steering,
    // damping, exact terrain checks, and a fully occupied moving foam pool.
    state.position.set(x, 0, z); state.heading = Math.PI / 2; state.speed = speed;
    let stamp = performance.now(); boatSurfacePose(state, time, poseTarget); const poseMs = performance.now() - stamp;
    stamp = performance.now(); stepBoatFrame(state, { forward: speed > 0, left: speed > 0 }, 1 / 60, false, time); const physicsMs = performance.now() - stamp;
    sampleCount = 0; stamp = performance.now(); callback({ clock: { elapsedTime: time } }, 1 / 60); const wakeMs = performance.now() - stamp;
    if (i >= 180) { poseTimes.push(poseMs); physicsTimes.push(physicsMs); wakeTimes.push(wakeMs); counts.push(sampleCount); }
  }
  reports.push({ name, frames: 120, fitOnly: stats(poseTimes), physicsIncludingFitAndContact: stats(physicsTimes),
    actualWakeCallback: stats(wakeTimes), surfaceQueriesMean: counts.reduce((a, b) => a + b, 0) / counts.length });
  geometry.dispose(); refs[0].current.material.dispose(); refs[3].current.geometry.dispose();
}
const result = { environment: 'Node on user host, warmed actual Three/React frame closures; this is CPU callback cost, not browser FPS', reports };
writeFileSync(new URL('./boat-water-cpu-99.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
