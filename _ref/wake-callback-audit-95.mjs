import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { boatProfile, BOATS } from '../src/game/BoatProfiles.js';
import { BOAT_SCALE } from '../src/game/WorldConfig.js';
import { createFoamTexture } from '../src/game/BoatFoam.js';

// Execute the component's actual hook setup and useFrame closure with Three
// objects. This catches changes to frame backdating, pool reuse, and matrices.
const source = readFileSync(new URL('../src/game/Boat.jsx', import.meta.url), 'utf8');
const start = source.indexOf('const Wake = memo(function Wake(');
const bodyStart = source.indexOf('{\n', start) + 2;
const bodyEnd = source.indexOf('\n  return (', bodyStart);
const setup = new Function('useRef', 'useMemo', 'useEffect', 'useFrame', 'THREE',
  'boatProfile', 'BOAT_SCALE', 'createFoamTexture', 'FOAM_COUNT', 'boatState', 'paused',
  source.slice(bodyStart, bodyEnd) + '\nreturn (value) => { paused = value; };');
assert.match(source.slice(bodyEnd, source.indexOf('export default function Boat', bodyEnd)),
  /<group userData=\{\{ seaSurfaceOnly: true \}\}>/);
function rig(id, speed, hz) {
  const refs = []; let frame; let time = 0;
  const state = { boatId: id, speed, heading: -.72,
    position: new THREE.Vector3(30, 0, 30), resetId: 1 };
  const setPaused = setup(value => { const ref = { current: value }; refs.push(ref); return ref; },
    factory => factory(), () => {}, callback => { frame = callback; }, THREE,
    boatProfile, BOAT_SCALE, createFoamTexture, 300, { current: state }, false);
  const foam = new THREE.PlaneGeometry(2, 2);
  foam.setAttribute('instanceFade', new THREE.InstancedBufferAttribute(new Float32Array(300), 1));
  foam.setAttribute('instanceSeed', new THREE.InstancedBufferAttribute(new Float32Array(300), 1));
  refs[0].current = new THREE.InstancedMesh(foam, new THREE.MeshBasicMaterial(), 300);
  refs[1].current = new THREE.Object3D();
  for (const i of [2]) refs[i].current = { uniforms: {
    uTime: { value: 0 }, uSpeed: { value: 0 }, uDirection: { value: 1 } } };
  const data = refs[3].current;
  let randomState = 712;
  const random = () => ((randomState = (randomState * 1664525 + 1013904223) >>> 0) / 4294967296);
  function tick(dt = 1 / hz) {
    time += dt;
    state.position.x -= Math.sin(state.heading) * state.speed * dt;
    state.position.z -= Math.cos(state.heading) * state.speed * dt;
    const savedRandom = Math.random; Math.random = random;
    try { frame({ clock: { elapsedTime: time } }, dt); }
    finally { Math.random = savedRandom; }
    const fades = refs[0].current.geometry.attributes.instanceFade.array;
    const seeds = refs[0].current.geometry.attributes.instanceSeed.array;
    const matrices = refs[0].current.instanceMatrix.array;
    let live = 0, opacity = 0;
    for (let i = 0; i < 300; i++) {
      const p = data.particles[i];
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(fades[i] >= 0 && fades[i] <= 1);
      assert.ok(seeds[i] >= 0 && seeds[i] < 1);
      if (fades[i] > 0) {
        live++; opacity += fades[i];
        assert.ok(p.age >= 0 && p.age < p.life && p.life < 3);
        assert.ok(Math.abs(matrices[i * 16 + 13] + .08) <= .005);
        assert.ok(Math.hypot(...matrices.slice(i * 16, i * 16 + 3)) > 0);
        assert.ok(Math.hypot(...matrices.slice(i * 16 + 4, i * 16 + 7)) > 0);
      }
    }
    assert.ok(matrices.every(Number.isFinite));
    assert.equal(data.particles.length, 300);
    return { live, opacity };
  }
  const snapshot = () => JSON.stringify({ data: { ...data, dummy: data.dummy.matrix.elements },
    matrices: [...refs[0].current.instanceMatrix.array],
    fades: [...refs[0].current.geometry.attributes.instanceFade.array],
    contact: refs[1].current.position.toArray(),
    uniforms: [refs[2].current.uniforms] });
  return { tick, snapshot, setPaused, state, data, refs };
}
const report = [];
for (const profile of BOATS) for (const reverse of [false, true]) {
  const rates = [];
  for (const hz of [30, 60, 120]) {
    const speed = reverse ? -profile.reverseSpeed : profile.maxSpeed;
    const r = rig(profile.id, speed, hz);
    let peak = 0, moving;
    for (let i = 0; i < 8 * hz; i++) { moving = r.tick(); peak = Math.max(peak, moving.live); }
    assert.ok(moving.live > 20 && peak < 300);
    assert.ok(new Set(r.data.particles.filter(p => p.age < p.life).map(p => Math.floor(p.rotation * 10))).size > 4);
    const ageWidths = r.data.particles.filter(p => p.age < p.life).map(p => p.width);
    assert.ok(Math.max(...ageWidths) / Math.min(...ageWidths) > 1.7);
    r.setPaused(true); const paused = r.snapshot(); r.tick(); assert.equal(r.snapshot(), paused); r.setPaused(false);
    r.state.speed = 0;
    const stop = [];
    for (let i = 1; i <= 3 * hz; i++) {
      const result = r.tick();
      if ([.25, .75, 1.5, 2.25, 3].some(t => i === Math.round(t * hz))) stop.push(result.opacity);
    }
    assert.equal(stop.at(-1), 0);
    assert.ok(stop.slice(1).every((value, i) => value < stop[i] || value === 0));
    r.state.speed = speed; for (let i = 0; i < hz; i++) r.tick();
    r.state.resetId++; const reset = r.tick(); assert.equal(reset.live, 0);
    rates.push({ hz, peak, movingLive: moving.live, movingOpacity: moving.opacity, stop });
  }
  assert.ok(Math.max(...rates.map(r => r.movingLive)) - Math.min(...rates.map(r => r.movingLive)) <= 4);
  report.push({ boat: profile.id, reverse, rates });
}
writeFileSync(new URL('./wake-callback-audit-95.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: 18, finite: true, pauseUnchanged: true, stopClearBy3s: true,
  resetImmediate: true, seaSurfaceOnly: true, pool: 300, peakLive: Math.max(...report.flatMap(r => r.rates.map(x => x.peak))) }));
