import { windDirection } from "./WindField.js";
import { seabedSampleAt } from "./Seabed.js";

export const WAVE_FADE_START = 180;
export const WAVE_FADE_END = 190;
export const OCEAN_SEA_LEVEL = -0.08;
// Scene-scale coefficients are calibrated separately for direct transmission and
// path radiance. They are not measurements of a particular ocean water sample.
export const WATER_IOR = 1.333;
export const DIRECT_ATTENUATION = Object.freeze([0.28, 0.12, 0.08]);
export const BACKSCATTER = Object.freeze([0.16, 0.24, 0.28]);
export const OCEAN_WAVE_BANDS = Object.freeze([
  [0.33, 0.057, 0.27, 0.035, -0.011, 11.7],
  [1.15, 0.0276, -0.64, -0.064, 0.019, 29.3],
  [2.63, 0.0108, 1.13, 0.105, 0.041, 53.9],
  [5.3, 0.003, -1.41, -0.121, 0.084, 81.2],
]);
const CLEAR_LAYER = 0.55, DENSE_LAYER = 1.65;
const DIRECT_BASE_DENSITY = 0.4, SCATTER_BASE_DENSITY = 0.55;
const SUNLIGHT_FRACTION = 0.55;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function refractedCosine(cosine) {
  const c = clamp(Math.abs(cosine), 0, 1);
  return Math.sqrt(1 - (1 - c * c) / (WATER_IOR * WATER_IOR));
}
export function waterPaths(depth, viewCosine, sunCosine) {
  const d = Math.max(0, depth);
  return { view: d / refractedCosine(viewCosine), sun: d / refractedCosine(sunCosine) };
}
function integratedDensity(depth, base) {
  const d = Math.max(0, depth), width = DENSE_LAYER - CLEAR_LAYER;
  const t = clamp((d - CLEAR_LAYER) / width, 0, 1);
  const transition = width * (t ** 3 - 0.5 * t ** 4) + Math.max(0, d - DENSE_LAYER);
  return base * d + (1 - base) * transition;
}
// Focusing redistributes only direct sunlight. It changes reflected material
// radiance, never adds an albedo-independent color over the water path.
export function waterReceiverRadiance(radiance, focusing, meanFocusing, depth, sunVisibility) {
  const smooth = (lo, hi, value) => {
    const t = clamp((value - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const visibility = smooth(0.02, 0.2, depth) * (1 - smooth(0.55, 1.8, depth));
  const irradiance = 1 + SUNLIGHT_FRACTION * 0.5 * clamp(sunVisibility, 0, 1)
    * (clamp(focusing, 0, 1) - clamp(meanFocusing, 0, 1)) * visibility;
  return radiance.map(value => Math.max(0, value) * irradiance);
}
export function waterRadiance(radiance, scatterColor, depth, viewCosine, sunCosine) {
  const direct = waterPaths(integratedDensity(depth, DIRECT_BASE_DENSITY), viewCosine, sunCosine);
  const scatterPath = integratedDensity(depth, SCATTER_BASE_DENSITY) / refractedCosine(viewCosine);
  return radiance.map((value, i) => Math.max(0, value) * Math.exp(-direct.view * DIRECT_ATTENUATION[i])
    * (1 - SUNLIGHT_FRACTION + SUNLIGHT_FRACTION * Math.exp(-direct.sun * DIRECT_ATTENUATION[i]))
    + scatterColor[i] * (1 - Math.exp(-scatterPath * BACKSCATTER[i])));
}
// Integer permutation stays exactly representable in GPU float32, including
// negative lattice coordinates. A sine hash would diverge from CPU buoyancy.
const mod289 = value => ((value % 289) + 289) % 289;
const permute = value => { const n = mod289(value); return mod289((34 * n + 1) * n); };
const noiseHash = (x, z) => permute(permute(x) + mod289(z)) / 144 - 1;
const waveFade = t => t * t * t * (t * (t * 6 - 15) + 10);
const waveDerivative = t => 30 * t * t * (t - 1) * (t - 1);
function waveNoise(x, z, out = [0, 0, 0]) {
  const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
  const a = noiseHash(ix, iz), b = noiseHash(ix + 1, iz), c = noiseHash(ix, iz + 1), d = noiseHash(ix + 1, iz + 1);
  const fu = waveFade(u), fv = waveFade(v), lo = a + (b - a) * fu, hi = c + (d - c) * fu;
  out[0] = lo + (hi - lo) * fv;
  out[1] = ((b - a) * (1 - fv) + (d - c) * fv) * waveDerivative(u);
  out[2] = (hi - lo) * waveDerivative(v);
  return out;
}
const waveScratch = [0, 0, 0];
const surfaceScratch = { normal: [0, 1, 0] };
const fadeWithDerivative = (low, high, value, out) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  out[0] = t * t * (3 - 2 * t);
  out[1] = 6 * t * (1 - t) / (high - low);
};
const fadeScratch = [0, 0];
const bedScratch = {};
// Absolute height and slope are shared by the rendered surface and buoyant bodies.
// A caller-provided target reuses its normal array throughout the frame loop.
export function sampleOceanSurface(x, z, time, target = {}) {
  let height = 0, dx = 0, dz = 0, longHeight = 0, longDx = 0, longDz = 0;
  for (const [frequency, amplitude, angle, vx, vz, seed] of OCEAN_WAVE_BANDS) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const n = waveNoise((x * c + z * s) * frequency + time * vx + seed,
      (-x * s + z * c) * frequency + time * vz + seed * 1.7, waveScratch);
    height += amplitude * n[0];
    dx += amplitude * frequency * (n[1] * c - n[2] * s);
    dz += amplitude * frequency * (n[1] * s + n[2] * c);
    if (frequency === OCEAN_WAVE_BANDS[0][0]) { longHeight = height; longDx = dx; longDz = dz; }
  }
  const bed = seabedSampleAt(x, z, bedScratch);
  const depth = OCEAN_SEA_LEVEL - bed.height;
  fadeWithDerivative(0.025, 0.65, depth, fadeScratch);
  const shallow = fadeScratch[0], shallowDerivative = fadeScratch[1];
  const bedDx = bed.slopeX, bedDz = bed.slopeZ;
  // The long swell can wash a few millimeters onto the sand. Fine ripples still
  // flatten in shallow water, and the swash disappears above the wet edge.
  fadeWithDerivative(-0.045, 0.005, depth, fadeScratch);
  const dryFade = fadeScratch[0], dryDerivative = fadeScratch[1];
  const swash = 0.35 * (1 - shallow) * dryFade;
  const swashDerivative = 0.35 * (-shallowDerivative * dryFade + (1 - shallow) * dryDerivative);
  dx = dx * shallow - height * shallowDerivative * bedDx + longDx * swash - longHeight * swashDerivative * bedDx;
  dz = dz * shallow - height * shallowDerivative * bedDz + longDz * swash - longHeight * swashDerivative * bedDz;
  height = height * shallow + longHeight * swash;
  fadeWithDerivative(WAVE_FADE_START, WAVE_FADE_END, Math.abs(x), fadeScratch);
  const farX = 1 - fadeScratch[0], farDx = -fadeScratch[1] * Math.sign(x);
  fadeWithDerivative(WAVE_FADE_START, WAVE_FADE_END, Math.abs(z), fadeScratch);
  const farZ = 1 - fadeScratch[0], farDz = -fadeScratch[1] * Math.sign(z);
  const fade = farX * farZ;
  dx = dx * fade + height * farDx * farZ;
  dz = dz * fade + height * farX * farDz;
  target.height = OCEAN_SEA_LEVEL + height * fade;
  target.slopeX = dx;
  target.slopeZ = dz;
  const length = Math.hypot(dx, 1, dz);
  const normal = target.normal ?? (target.normal = [0, 1, 0]);
  normal[0] = -dx / length; normal[1] = 1 / length; normal[2] = -dz / length;
  return target;
}
export function waterHeight(x, z, time) {
  return sampleOceanSurface(x, z, time, surfaceScratch).height - OCEAN_SEA_LEVEL;
}
export function waterNormal(x, z, time) {
  return sampleOceanSurface(x, z, time).normal;
}
// Periodic refracted-ray transport. Curved folds emerge where coherent surface
// slopes compress the incident ray distribution; no Voronoi edges are drawn.
export function createCausticField(size = 256) {
  const density = new Float32Array(size * size), samples = size * 3;
  const waves = [[3, 1, .030, .7], [1, 4, .022, 2.1], [-2, 3, .024, 4.7],
    [5, -2, .009, 1.4], [4, 4, .007, 3.2], [-6, 1, .007, 5.3]];
  const tau = Math.PI * 2;
  const cosines = waves.map(([kx, ky, , phase]) => {
    const values = new Float64Array(samples);
    for (let i = 0; i < samples; i++) values[i] = Math.cos(i / samples * tau + phase);
    return { kx, ky, values };
  });
  for (let y = 0; y < samples; y++) for (let x = 0; x < samples; x++) {
    let sx = 0, sy = 0;
    for (let i = 0; i < waves.length; i++) {
      const { kx, ky, values } = cosines[i];
      const index = ((x * kx + y * ky) % samples + samples) % samples;
      const slope = waves[i][2] * tau * values[index];
      sx += kx * slope; sy += ky * slope;
    }
    const px = ((x / samples - sx * .09) % 1 + 1) % 1 * size;
    const py = ((y / samples - sy * .09) % 1 + 1) % 1 * size;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const nextX = (ix + 1) % size, nextY = (iy + 1) % size;
    density[iy * size + ix] += (1 - fx) * (1 - fy);
    density[iy * size + nextX] += fx * (1 - fy);
    density[nextY * size + ix] += (1 - fx) * fy;
    density[nextY * size + nextX] += fx * fy;
  }
  const data = new Uint8Array(size * size * 4);
  let sum = 0;
  for (let i = 0; i < density.length; i++) {
    const irradiance = density[i] / 9;
    const value = Math.round(255 * clamp((irradiance - .75) / 3.4, 0, 1));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255; sum += value;
  }
  return { data, size, meanFocusing: sum / (255 * density.length) };
}
export function waterSurfaceRoughness(x, z, time) {
  return 0.32 + 0.087 * (waveNoise(x * 0.11 + time * 0.008 + 71.3, z * 0.11 - time * 0.004 + 38.1)[0] * 0.5 + 0.5)
    + 0.033 * (waveNoise(x * 0.9 - time * 0.014 + 19.7, z * 0.9 + time * 0.021 + 92.4)[0] * 0.5 + 0.5);
}
export function waterFresnel(cosine) {
  const f0 = ((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2;
  return f0 + (1 - f0) * (1 - clamp(cosine, 0, 1)) ** 5;
}
export function waterSunSpecular(normal, view, sun, roughness = 0.38) {
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const h = view.map((v, i) => v + sun[i]), length = Math.hypot(...h);
  if (length < 1e-8) return 0;
  const half = h.map(v => v / length);
  const nv = clamp(dot(normal, view), 0.001, 1), nl = clamp(dot(normal, sun), 0, 1);
  if (nl === 0) return 0;
  const nh = clamp(dot(normal, half), 0, 1), vh = clamp(dot(view, half), 0, 1);
  const alpha = roughness * roughness, a2 = alpha * alpha + 0.0025;
  const wind = [windDirection.x, 0, windDirection.z], projection = dot(wind, normal);
  const tangent = wind.map((value, i) => value - normal[i] * projection);
  const tangentLength = Math.hypot(...tangent);
  for (let i = 0; i < 3; i++) tangent[i] /= tangentLength;
  const bitangent = [normal[1] * tangent[2] - normal[2] * tangent[1], normal[2] * tangent[0] - normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]];
  const ax = Math.sqrt(a2) * 0.75, ay = Math.sqrt(a2) / 0.75;
  const shape = (dot(half, tangent) / ax) ** 2 + (dot(half, bitangent) / ay) ** 2 + nh * nh;
  const distribution = 1 / (Math.PI * ax * ay * shape * shape);
  const g = cosine => 2 * cosine / (cosine + Math.sqrt(a2 + (1 - a2) * cosine * cosine));
  return distribution * g(nv) * g(nl) * waterFresnel(vh) / (4 * nv);
}
export function paletteRadianceForNeutral(linearDisplay) {
  const minimum = Math.max(0, Math.min(...linearDisplay));
  const offset = minimum < 0.04 ? 0.4 * Math.sqrt(minimum) - minimum : 0.04;
  return linearDisplay.map(value => value + offset);
}
const vec3 = values => `vec3(${values.map(v => v.toFixed(5)).join(",")})`;
export const WATER_OPTICS_GLSL = `
vec3 paletteRadianceForNeutral(vec3 color){
 float minimum=max(0.,min(color.r,min(color.g,color.b)));
 float offset=minimum<.04?.4*sqrt(minimum)-minimum:.04;
 return color+offset;
}
float waterRefractedCos(float c){c=clamp(abs(c),0.,1.);return sqrt(1.-(1.-c*c)/${(WATER_IOR * WATER_IOR).toFixed(6)});}
float waterIntegratedDensity(float depth,float base){
 float d=max(0.,depth),width=${(DENSE_LAYER-CLEAR_LAYER).toFixed(5)};
 float t=clamp((d-${CLEAR_LAYER.toFixed(5)})/width,0.,1.);
 float transition=width*(t*t*t-.5*t*t*t*t)+max(0.,d-${DENSE_LAYER.toFixed(5)});
 return base*d+(1.-base)*transition;
}
vec3 waterReceiverRadiance(vec3 radiance,float focusing,float meanFocusing,float depth,float sunVisibility){
 float visibility=smoothstep(.02,.2,depth)*(1.-smoothstep(.55,1.8,depth));
 float irradiance=1.+${SUNLIGHT_FRACTION.toFixed(5)}*.5*clamp(sunVisibility,0.,1.)
  *(clamp(focusing,0.,1.)-clamp(meanFocusing,0.,1.))*visibility;
 return max(radiance,vec3(0.))*irradiance;
}
vec3 waterRadiance(vec3 radiance,vec3 scatterColor,float depth,float viewCos,float sunCos){
 float d=waterIntegratedDensity(depth,${DIRECT_BASE_DENSITY.toFixed(5)});
 float viewPath=d/waterRefractedCos(viewCos),sunPath=d/waterRefractedCos(sunCos);
 float scatterPath=waterIntegratedDensity(depth,${SCATTER_BASE_DENSITY.toFixed(5)})/waterRefractedCos(viewCos);
 return max(radiance,vec3(0.))*exp(-viewPath*${vec3(DIRECT_ATTENUATION)})
  *(vec3(${(1-SUNLIGHT_FRACTION).toFixed(5)})+${SUNLIGHT_FRACTION.toFixed(5)}*exp(-sunPath*${vec3(DIRECT_ATTENUATION)}))
  +scatterColor*(vec3(1.)-exp(-scatterPath*${vec3(BACKSCATTER)}));
}
float waveMod289(float x){return x-floor(x/289.)*289.;}
float wavePermute(float x){float n=waveMod289(x);return waveMod289((34.*n+1.)*n);}
float waveHash(vec2 p){return wavePermute(wavePermute(p.x)+waveMod289(p.y))/144.-1.;}
vec3 waveNoise(vec2 p){
 vec2 i=floor(p),t=fract(p);
 vec2 f=t*t*t*(t*(t*6.-15.)+10.);
 vec2 df=30.*t*t*(t-1.)*(t-1.);
 float a=waveHash(i),b=waveHash(i+vec2(1.,0.)),c=waveHash(i+vec2(0.,1.)),d=waveHash(i+1.);
 float lo=mix(a,b,f.x),hi=mix(c,d,f.x);
 return vec3(mix(lo,hi,f.y),mix(b-a,d-c,f.y)*df.x,(hi-lo)*df.y);
}
vec3 waterSurface(vec2 p,float time,vec3 bed){
 float height=0.;vec2 slope=vec2(0.);
 ${OCEAN_WAVE_BANDS.map(([frequency, amplitude, angle, vx, vz, seed],i) => {
const c=Math.cos(angle),ss=Math.sin(angle);
return `vec2 q${i}=vec2(dot(p,vec2(${c.toFixed(9)},${ss.toFixed(9)})),dot(p,vec2(${(-ss).toFixed(9)},${c.toFixed(9)})))*${frequency.toFixed(5)}+time*vec2(${vx.toFixed(5)},${vz.toFixed(5)})+vec2(${seed.toFixed(5)},${(seed*1.7).toFixed(5)});
 vec3 n${i}=waveNoise(q${i});height+=${amplitude.toFixed(6)}*n${i}.x;
 slope+=${(frequency*amplitude).toFixed(9)}*vec2(n${i}.y*${c.toFixed(9)}-n${i}.z*${ss.toFixed(9)},n${i}.y*${ss.toFixed(9)}+n${i}.z*${c.toFixed(9)});`;
}).join("\n ")}
 float depth=-.08-bed.x;
 float t=clamp((depth-.025)/.625,0.,1.);
 float shallow=t*t*(3.-2.*t),shallowDerivative=6.*t*(1.-t)/.625;
 float dryT=clamp((depth+.045)/.05,0.,1.);
 float dryFade=dryT*dryT*(3.-2.*dryT),dryDerivative=6.*dryT*(1.-dryT)/.05;
 float swash=.35*(1.-shallow)*dryFade;
 float swashDerivative=.35*(-shallowDerivative*dryFade+(1.-shallow)*dryDerivative);
 float longHeight=${OCEAN_WAVE_BANDS[0][1].toFixed(6)}*n0.x;
 vec2 longSlope=${(OCEAN_WAVE_BANDS[0][0]*OCEAN_WAVE_BANDS[0][1]).toFixed(9)}*vec2(
  n0.y*${Math.cos(OCEAN_WAVE_BANDS[0][2]).toFixed(9)}-n0.z*${Math.sin(OCEAN_WAVE_BANDS[0][2]).toFixed(9)},
  n0.y*${Math.sin(OCEAN_WAVE_BANDS[0][2]).toFixed(9)}+n0.z*${Math.cos(OCEAN_WAVE_BANDS[0][2]).toFixed(9)});
 slope=slope*shallow-height*shallowDerivative*bed.yz+longSlope*swash-longHeight*swashDerivative*bed.yz;
 height=height*shallow+longHeight*swash;
 vec2 farT=clamp((abs(p)-${WAVE_FADE_START.toFixed(1)})/${(WAVE_FADE_END - WAVE_FADE_START).toFixed(1)},0.,1.);
 vec2 far=vec2(1.)-farT*farT*(3.-2.*farT);
 vec2 farDerivative=-6.*farT*(1.-farT)/10.*sign(p);
 return vec3(height*far.x*far.y,slope*far.x*far.y+height*farDerivative*far.yx);

}
vec3 waterNormal(vec2 p,float time,vec3 bed){
 vec2 slope=waterSurface(p,time,bed).yz;
 return normalize(vec3(-slope.x,1.,-slope.y));
}
float waterSurfaceRoughness(vec2 p,float time){
 return .32+.087*(waveNoise(p*.11+time*vec2(.008,-.004)+vec2(71.3,38.1)).x*.5+.5)
  +.033*(waveNoise(p*.9+time*vec2(-.014,.021)+vec2(19.7,92.4)).x*.5+.5);
}
float waterFresnel(float cosine){return ${(((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2).toFixed(8)}+(1.-${(((WATER_IOR - 1) / (WATER_IOR + 1)) ** 2).toFixed(8)})*pow(1.-clamp(cosine,0.,1.),5.);}
float waterSunSpecular(vec3 n,vec3 v,vec3 light,float roughness){
 vec3 sum=v+light;
 vec3 h=sum/max(length(sum),.000001);
 float nv=clamp(dot(n,v),.001,1.),nl=clamp(dot(n,light),0.,1.);
 float nh=clamp(dot(n,h),0.,1.),vh=clamp(dot(v,h),0.,1.);
 float alpha=roughness*roughness,a2=alpha*alpha+.0025;
 vec3 wind=vec3(${windDirection.x.toFixed(9)},0.,${windDirection.z.toFixed(9)});
 vec3 tangent=normalize(wind-n*dot(wind,n));
 vec3 bitangent=cross(n,tangent);
 float ax=sqrt(a2)*.75,ay=sqrt(a2)/.75;
 float hx=dot(h,tangent)/ax,hy=dot(h,bitangent)/ay;
 float shape=hx*hx+hy*hy+nh*nh;
 float distribution=1./(3.14159265*ax*ay*shape*shape);
 float gv=2.*nv/(nv+sqrt(a2+(1.-a2)*nv*nv));
 float gl=2.*nl/max(.000001,nl+sqrt(a2+(1.-a2)*nl*nl));
 return distribution*gv*gl*waterFresnel(vh)/(4.*nv);
}
`;
