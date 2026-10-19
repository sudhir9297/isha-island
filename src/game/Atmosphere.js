import { windDirection } from './WindField.js';

// World-space canopies on the main island; shared by leaves and rustling audio.
export const WIND_GROVES = Object.freeze([
  { x: -9, z: -11.1, height: 4.8 }, { x: 9, z: -11.4, height: 4.9 },
  { x: -5.4, z: -16.9, height: 5 }, { x: 4.4, z: -18.2, height: 4.5 },
  { x: -8.3, z: -8.8, height: 3.8 },
  { x: 64.2, z: -48.65, height: 4.2 },
]);
const clamp = value => Math.max(0, Math.min(1, value));
export function sampleWeather(time, result = {}) {
  const phase = (1 - Math.cos(time * Math.PI * 2 / 180)) / 2;
  result.cloud = phase * phase * (3 - 2 * phase);
  result.wind = 0.28 + result.cloud * 0.44;
  result.sun = 3.2 - result.cloud * 1.05;
  return result;
}
function hash(x, z) { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz) * (1 - u) + hash(ix + 1, iz) * u;
  const b = hash(ix, iz + 1) * (1 - u) + hash(ix + 1, iz + 1) * u;
  return a * (1 - v) + b * v;
}
export function sampleGust(x, z, time) {
  const dx = windDirection.x * time * 0.055, dz = windDirection.z * time * 0.055;
  return noise(x * .1 - dx, z * .1 - dz) + noise(x * .05 - dx * .2, z * .05 - dz * .2) - 1;
}
export function windExposure(x, z) {
  // A soft lee behind the raised gate walls, never a sudden audio boundary.
  return 1 - 0.65 * Math.exp(-(((x - 3) / 5) ** 2) - ((z + 15) / 3) ** 2);
}
export function grassInteractionTarget(traveler, reducedMotion) {
  return !reducedMotion && traveler.mode === 'walking' && !traveler.jumping
    ? clamp(Math.hypot(traveler.velocityX, traveler.velocityZ) / 2) : 0;
}
export function createLeafPool(count = 18) {
  return { next: 0.6, leaves: Array.from({ length: count }, () => ({ active: false, age: 0, duration: 7, x: 0, y: 0, z: 0, phase: 0 })) };
}
export function stepLeaves(pool, delta, focus, time, strength, groundAt, random = Math.random) {
  if (delta <= 0) return;
  for (const leaf of pool.leaves) {
    if (!leaf.active) continue;
    leaf.age += delta;
    const gust = 0.7 + sampleGust(leaf.x, leaf.z, time) * 0.5;
    leaf.x += windDirection.x * delta * (0.18 + strength * gust);
    leaf.z += windDirection.z * delta * (0.18 + strength * gust);
    leaf.y -= delta * 0.36;
    if (leaf.age >= leaf.duration || leaf.y < Math.max(0, groundAt(leaf.x, leaf.z)) + 0.08) leaf.active = false;
  }
  pool.next -= delta;
  if (pool.next > 0) return;
  const groves = WIND_GROVES.filter(g => Math.hypot(g.x - focus.x, g.z - focus.z) < 23);
  const leaf = pool.leaves.find(l => !l.active);
  pool.next = 0.65 + random() * 1.1;
  if (!groves.length || !leaf) return;
  const grove = groves[Math.floor(random() * groves.length)];
  const x = grove.x + (random() - .5) * 2, z = grove.z + (random() - .5) * 2;
  Object.assign(leaf, { active: true, age: 0, duration: 6 + random() * 3, x, z, y: groundAt(x, z) + grove.height, phase: random() * Math.PI * 2 });
}
