import test from "node:test";
import assert from "node:assert/strict";
import { waterPaths, waterRadiance, waterReceiverRadiance, waterNormal, waterHeight, waterSurfaceRoughness, waterFresnel, waterSunSpecular, WATER_OPTICS_GLSL, DIRECT_ATTENUATION, BACKSCATTER, OCEAN_SEA_LEVEL, OCEAN_WAVE_BANDS, sampleOceanSurface, createCausticField } from "./WaterOptics.js";
import { seabedHeightAt, seabedSampleAt, SEABED_GRID, createSeabedFieldTexture } from "./Seabed.js";
import { SEABED_Y } from "./WorldConfig.js";
const normalize = v => v.map(x => x / Math.hypot(...v));
const sun = normalize([22, 28, -22]);

test("zero water depth preserves linear object radiance without adding a veil", () => {
  const input = [0.53, 0.18, 0.74];
  for (const view of [0, 0.001, 0.18, 0.745, 1]) {
    assert.deepEqual(waterPaths(0, view, sun[1]), { view: 0, sun: 0 });
    assert.deepEqual(waterRadiance(input, [0.1, 0.25, 0.3], 0, view, sun[1]), input);
  }
});

test("sun and view transmission loses red faster while separate path radiance fills shade", () => {
  const transmitted = waterRadiance([1, 1, 1], [0, 0, 0], 1.5, 0.745, sun[1]);
  assert.ok(transmitted[0] < transmitted[1] && transmitted[1] < transmitted[2]);
  const shaded = waterRadiance([0, 0, 0], [0.1, 0.25, 0.3], 1.5, 0.745, sun[1]);
  assert.ok(shaded.every(v => v > 0));
  assert.ok(shaded[0] < shaded[1] && shaded[1] < shaded[2]);
  assert.notDeepEqual(DIRECT_ATTENUATION, BACKSCATTER);
  for (let depth = 0.05; depth <= 3; depth += 0.05) {
    const before = waterRadiance([1, 1, 1], [0, 0, 0], depth - 0.05, 0.745, sun[1]);
    const after = waterRadiance([1, 1, 1], [0, 0, 0], depth, 0.745, sun[1]);
    assert.ok(after.every((v, i) => v <= before[i]));
  }
});

test("default and grazing views retain finite wave normals, refraction, and rough reflections", () => {
  const views = [normalize([-12, 30, 24]), normalize([-12, 0.001, 24]), [0, 1, 0]];
  let maximumSpecular = 0, maximumNormalVariation = 0;
  for (let t = 0; t < 30; t += 2) for (let x = -28; x <= 24; x += 1.7) {
    const normal = waterNormal(x, -12 + x * 0.43, t);
    assert.ok(normal.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-12);
    assert.ok(normal[1] > 0.9);
    maximumNormalVariation = Math.max(maximumNormalVariation, Math.hypot(normal[0], normal[2]));
    for (const view of views) {
      const cosine = normal.reduce((sum, v, i) => sum + v * view[i], 0);
      const specular = waterSunSpecular(normal, view, sun, waterSurfaceRoughness(x, -12 + x * 0.43, t));
      maximumSpecular = Math.max(maximumSpecular, specular);
      assert.ok(Number.isFinite(specular) && specular >= 0);
      const fresnel = waterFresnel(cosine);
      assert.ok(Number.isFinite(fresnel) && fresnel >= 0 && fresnel <= 1);
      for (const depth of [0, 0.16, 0.83, 1.5, 2.4]) {
        const paths = waterPaths(depth, cosine, sun[1]);
        assert.ok(Object.values(paths).every(Number.isFinite));
        assert.ok(paths.view <= depth * 1.514 + 1e-8);
        assert.ok(waterRadiance([1, 0.2, 0.5], [0.1, 0.25, 0.3], depth, cosine, sun[1]).every(v => Number.isFinite(v) && v >= 0));
      }
    }
  }
  assert.ok(maximumNormalVariation > 0.06);
  assert.ok(maximumSpecular > 0.01);
  assert.ok(waterFresnel(0.1) > waterFresnel(0.745));
});

test("GPU coefficients and wave field come from the tested optical model", () => {
  for (const coefficients of [DIRECT_ATTENUATION, BACKSCATTER]) for (const value of coefficients) assert.ok(WATER_OPTICS_GLSL.includes(value.toFixed(5)));
  assert.ok(WATER_OPTICS_GLSL.includes("waterIntegratedDensity"));
  assert.ok(WATER_OPTICS_GLSL.includes("normalize(vec3(-slope.x,1.,-slope.y))"));
});


test("wave normals are derivatives of one advected irregular height field", () => {
  const epsilon = 0.00001;
  for (let i = 0; i < 80; i++) {
    const x = -27 + i * 0.63, z = -35 + i * 0.41, time = i * 0.19;
    const dx = (waterHeight(x + epsilon, z, time) - waterHeight(x - epsilon, z, time)) / (2 * epsilon);
    const dz = (waterHeight(x, z + epsilon, time) - waterHeight(x, z - epsilon, time)) / (2 * epsilon);
    const normal = waterNormal(x, z, time);
    assert.ok(Math.abs(dx + normal[0] / normal[1]) < 1e-6);
    assert.ok(Math.abs(dz + normal[2] / normal[1]) < 1e-6);
    const roughness = waterSurfaceRoughness(x, z, time);
    assert.ok(roughness >= 0.32 && roughness <= 0.44);
    assert.ok(Math.abs(waterHeight(x, z, time + 0.001) - waterHeight(x, z, time)) < 0.0001);
  }
});

test("clear near-surface crowns and grey swimmers retain direct material contrast", () => {
  const bright = waterRadiance([0.6, 0.4, 0.2], [0.01, 0.24, 0.28], 0.3, 0.745, sun[1]);
  const shade = waterRadiance([0.2, 0.15, 0.1], [0.01, 0.24, 0.28], 0.3, 0.745, sun[1]);
  assert.ok(bright[0] - shade[0] > 0.36);
  const grey = waterRadiance([0.3, 0.3, 0.3], [0.01, 0.24, 0.28], 1.5, 0.745, sun[1]);
  assert.ok(grey[0] > grey[1] * 0.6, `grey body collapsed to green ${grey}`);
});


test("receiver caustics retain material color and cannot illuminate black or shadowed surfaces", () => {
  const material = [0.64, 0.23, 0.08];
  for (const depth of [0, 0.16, 0.55, 0.83, 1.5, 2.4]) {
    for (const focusing of [0, 0.25, 1]) {
      const focused = waterReceiverRadiance(material, focusing, 0.25, depth, 1);
      assert.ok(focused.every(Number.isFinite));
      assert.ok(Math.abs(focused[0] / material[0] - focused[2] / material[2]) < 1e-12);
      assert.deepEqual(waterReceiverRadiance([0, 0, 0], focusing, 0.25, depth, 1), [0, 0, 0]);
      assert.deepEqual(waterReceiverRadiance(material, focusing, 0.25, depth, 0), material);
      const visible = waterRadiance(focused, [0, 0, 0], depth, 0.745, sun[1]);
      assert.ok(visible.every((value, i) => value <= focused[i] + 1e-12));
    }
  }
  assert.ok(WATER_OPTICS_GLSL.includes("waterReceiverRadiance"));
});

test("caustic focusing redistributes measured sunlight without changing mean radiance", () => {
  const samples = [0, 0.01, 0.12, 0.35, 0.67, 1];
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const material = [0.3, 0.2, 0.1];
  for (const depth of [0, 0.16, 0.55, 1.5, 2.4]) {
    const average = material.map((_, i) => samples.reduce((sum, focus) => sum
      + waterReceiverRadiance(material, focus, mean, depth, 1)[i], 0) / samples.length);
    assert.ok(average.every((value, i) => Math.abs(value - material[i]) < 1e-12));
  }
  assert.deepEqual(waterReceiverRadiance(material, 1, mean, 0, 1), material);
  assert.deepEqual(waterReceiverRadiance(material, 1, mean, 2.4, 1), material);
  assert.ok(waterReceiverRadiance(material, 1, mean, 0.55, 1)[0] > material[0]);
});

// This evaluator rounds each arithmetic operation as a GLSL highp float does.
// It catches CPU/GPU phase drift that double-precision sine hashes conceal.
const f32 = Math.fround;
const fadd = (a, b) => f32(f32(a) + f32(b));
const fsub = (a, b) => f32(f32(a) - f32(b));
const fmul = (a, b) => f32(f32(a) * f32(b));
const fdiv = (a, b) => f32(f32(a) / f32(b));
function shaderNoise(x, z) {
  const mod = n => fsub(n, fmul(Math.floor(fdiv(n, 289)), 289));
  const permute = n => { n = mod(n); return mod(fmul(fadd(fmul(34, n), 1), n)); };
  const hash = (x, z) => fsub(fdiv(permute(fadd(permute(x), mod(z))), 144), 1);
  const fade = t => fmul(fmul(fmul(t, t), t), fadd(fmul(t, fsub(fmul(t, 6), 15)), 10));
  const derivative = t => fmul(fmul(fmul(fmul(30, t), t), fsub(t, 1)), fsub(t, 1));
  const mix = (a, b, t) => fadd(a, fmul(fsub(b, a), t));
  const ix = Math.floor(x), iz = Math.floor(z), u = fsub(x, ix), v = fsub(z, iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  const fu = fade(u), fv = fade(v), lo = mix(a, b, fu), hi = mix(c, d, fu);
  return [mix(lo, hi, fv), fmul(mix(fsub(b, a), fsub(d, c), fv), derivative(u)), fmul(fsub(hi, lo), derivative(v))];
}
const testBedTexture = createSeabedFieldTexture();
const bedField = testBedTexture.image.data;
testBedTexture.dispose();
function shaderBed(x, z) {
  const { x: ox, z: oz, step, columns, rows } = SEABED_GRID;
  const gx = fdiv(fsub(x, ox), step), gz = fdiv(fsub(z, oz), step);
  if (gx < 0 || gz < 0 || gx >= columns - 1 || gz >= rows - 1) return {height:SEABED_Y,slopeX:0,slopeZ:0};
  const ix = Math.floor(gx), iz = Math.floor(gz), u = fsub(gx, ix), v = fsub(gz, iz), i = iz * columns + ix;
  const a = bedField[i], b = bedField[i + 1], c = bedField[i + columns], d = bedField[i + columns + 1];
  return fadd(u, v) <= 1
    ? {height:fadd(fadd(a,fmul(fsub(b,a),u)),fmul(fsub(c,a),v)),slopeX:fdiv(fsub(b,a),step),slopeZ:fdiv(fsub(c,a),step)}
    : {height:fadd(fadd(d,fmul(fsub(c,d),fsub(1,u))),fmul(fsub(b,d),fsub(1,v))),slopeX:fdiv(fsub(d,c),step),slopeZ:fdiv(fsub(d,b),step)};
}
function shaderSurface(x, z, time) {
  let height = 0, dx = 0, dz = 0, longHeight = 0, longDx = 0, longDz = 0;
  for (const [frequency, amplitude, angle, vx, vz, seed] of OCEAN_WAVE_BANDS) {
    const c = f32(Number(Math.cos(angle).toFixed(9))), s = f32(Number(Math.sin(angle).toFixed(9)));
    const qx = fadd(fadd(fmul(fadd(fmul(x, c), fmul(z, s)), frequency), fmul(time, vx)), seed);
    const qz = fadd(fadd(fmul(fadd(fmul(x, -s), fmul(z, c)), frequency), fmul(time, vz)), seed * 1.7);
    const n = shaderNoise(qx, qz), strength = Number((frequency * amplitude).toFixed(9));
    height = fadd(height, fmul(amplitude, n[0]));
    dx = fadd(dx, fmul(strength, fsub(fmul(n[1], c), fmul(n[2], s))));
    dz = fadd(dz, fmul(strength, fadd(fmul(n[1], s), fmul(n[2], c))));
    if (frequency === OCEAN_WAVE_BANDS[0][0]) { longHeight = height; longDx = dx; longDz = dz; }
  }
  const bed = shaderBed(x, z);
  const t = Math.max(0, Math.min(1, fdiv(fsub(fsub(OCEAN_SEA_LEVEL, bed.height), .025), .625)));
  const shallow = fmul(fmul(t, t), fsub(3, fmul(2, t))), ds = fdiv(fmul(fmul(6, t), fsub(1, t)), .625);
  const dryT = Math.max(0, Math.min(1, fdiv(fadd(fsub(OCEAN_SEA_LEVEL, bed.height), .045), .05)));
  const dry = fmul(fmul(dryT,dryT), fsub(3,fmul(2,dryT))), dryDerivative = fdiv(fmul(fmul(6,dryT),fsub(1,dryT)),.05);
  const swash = fmul(fmul(.35,fsub(1,shallow)),dry), swashDerivative = fmul(.35,fadd(fmul(-ds,dry),fmul(fsub(1,shallow),dryDerivative)));
  dx = fsub(fadd(fsub(fmul(dx,shallow),fmul(fmul(height,ds),bed.slopeX)),fmul(longDx,swash)),fmul(fmul(longHeight,swashDerivative),bed.slopeX));
  dz = fsub(fadd(fsub(fmul(dz,shallow),fmul(fmul(height,ds),bed.slopeZ)),fmul(longDz,swash)),fmul(fmul(longHeight,swashDerivative),bed.slopeZ));
  height = fadd(fmul(height,shallow),fmul(longHeight,swash));
  const fade = p => {
    const t = Math.max(0, Math.min(1, fdiv(fsub(Math.abs(p), 38), 10)));
    return [fsub(1, fmul(fmul(t, t), fsub(3, fmul(2, t)))), fmul(fdiv(fmul(fmul(-6, t), fsub(1, t)), 10), Math.sign(p))];
  };
  const [fx, dfx] = fade(x), [fz, dfz] = fade(z), weight = fmul(fx, fz);
  const dweightX = fmul(dfx, fz);
  const dweightZ = fmul(fx, dfz);
  return [fadd(OCEAN_SEA_LEVEL, fmul(height, weight)), fadd(fmul(dx, weight), fmul(height, dweightX)), fadd(fmul(dz, weight), fmul(height, dweightZ))];
}

test("float32 shader field agrees with buoyancy through negative cells, shore triangles, and far taper", () => {
  const points = [[-28, -36], [-12.25, -12.25], [-12.125, -12.125], [12.125, -12.125], [-50, 50], [44.5, -39.25]];
  for (let i = 0; i < 240; i++) points.push([f32(-45 + (i * 9.713) % 90), f32(-39 + (i * 13.417) % 87)]);
  let visibleDisplacement = 0;
  for (const [x, z] of points) for (const time of [0, 1.5, 17.7, 140]) {
    const cpu = sampleOceanSurface(x, z, time), gpu = shaderSurface(x, z, f32(time));
    assert.ok(Math.abs(cpu.height - gpu[0]) < .00002, `height mismatch at ${x},${z},${time}`);
    assert.ok(Math.abs(cpu.slopeX - gpu[1]) < .00015, `X slope mismatch at ${x},${z},${time}`);
    assert.ok(Math.abs(cpu.slopeZ - gpu[2]) < .00015, `Z slope mismatch at ${x},${z},${time}`);
    visibleDisplacement = Math.max(visibleDisplacement, Math.abs(cpu.height - OCEAN_SEA_LEVEL));
    if (Math.abs(x) >= 48 || Math.abs(z) >= 48 || seabedHeightAt(x, z) >= OCEAN_SEA_LEVEL + .045) {
      assert.equal(cpu.height, OCEAN_SEA_LEVEL);
      assert.ok(Math.abs(cpu.normal[0]) === 0 && cpu.normal[1] === 1 && Math.abs(cpu.normal[2]) === 0);
    }
  }
  assert.ok(visibleDisplacement > .035);
});

test("rendered .24m triangles track the physical wave field within a centimeter", () => {
  const target = { normal: [0, 1, 0] };
  let maximum = 0, total = 0;
  for (let i = 0; i < 4000; i++) {
    const x = -35.8 + (i * 17.73) % 71.6, z = -35.8 + (i * 9.174) % 71.6, time = (i % 70) * .24;
    const x0 = -36 + Math.floor((x + 36) / .24) * .24, z0 = -36 + Math.floor((z + 36) / .24) * .24;
    const u = (x - x0) / .24, v = (z - z0) / .24;
    const a = sampleOceanSurface(x0, z0, time, target).height, b = sampleOceanSurface(x0 + .24, z0, time, target).height;
    const c = sampleOceanSurface(x0, z0 + .24, time, target).height, d = sampleOceanSurface(x0 + .24, z0 + .24, time, target).height;
    const triangle = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    const error = Math.abs(triangle - sampleOceanSurface(x, z, time, target).height);
    maximum = Math.max(maximum, error); total += error;
  }
  assert.ok(maximum < .01, `maximum triangle residual ${maximum}`);
  assert.ok(total / 4000 < .002, `mean triangle residual ${total / 4000}`);
});

test("transported caustic texture measures the mean used for material irradiance", () => {
  const field = createCausticField(64);
  let sum = 0, high = 0;
  for (let i = 0; i < field.data.length; i += 4) { sum += field.data[i]; high += field.data[i] > 200 ? 1 : 0; }
  assert.equal(field.meanFocusing, sum / (255 * field.size * field.size));
  assert.ok(field.meanFocusing > .08 && field.meanFocusing < .2);
  assert.ok(high > 8 && high < field.size * field.size * .15);
});


test("seabed sampler matches shader triangles at vertices, diagonals, and grid boundaries", () => {
  const points = [[-28,-36],[-28.125,-12],[-12.25,-12.25],[-12.125,-12.125],[24,-12],[10.125,-6.375]];
  for (let i=0;i<300;i++) points.push([f32(-28+(i*7.173)%52),f32(-36+(i*11.917)%48)]);
  for (const [x,z] of points) {
    const cpu=seabedSampleAt(x,z),gpu=shaderBed(x,z);
    assert.ok(Math.abs(cpu.height-gpu.height)<.000004);
    assert.ok(Math.abs(cpu.slopeX-gpu.slopeX)<.000002, `${x},${z} CPU ${cpu.slopeX} GPU ${gpu.slopeX}`);
    assert.ok(Math.abs(cpu.slopeZ-gpu.slopeZ)<.000002, `${x},${z} CPU ${cpu.slopeZ} GPU ${gpu.slopeZ}`);
  }
});

test("long swell reaches real shoreline elevation while high dry sand stays still", () => {
  let wetHeight=0, shoreSamples=0;
  for(let x=-12.6;x<12.6;x+=.025) {
    const z=-12,depth=OCEAN_SEA_LEVEL-seabedHeightAt(x,z);
    if(Math.abs(depth)<.018) {
      shoreSamples++;
      for(let time=0;time<90;time+=2) wetHeight=Math.max(wetHeight,Math.abs(waterHeight(x,z,time)));
    }
    if(depth<-.045) assert.equal(waterHeight(x,z,10),0);
  }
  assert.ok(shoreSamples>0);
  assert.ok(wetHeight>.006 && wetHeight<.024, `swash magnitude ${wetHeight}`);
});
