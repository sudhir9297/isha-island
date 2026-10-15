import { BufferGeometry, Float32BufferAttribute, DataTexture, FloatType, RedFormat, NearestFilter, Color } from "three";
import { ADIYOGI_ISLAND, adiyogiRadiusAt, adiyogiTerrainHeight } from "./AdiyogiTerrain.js";
import { SEABED_Y } from "./WorldConfig.js";

export const SEABED_GRID = Object.freeze({ x: -28, z: -120, step: 0.25, columns: 829, rows: 529 });
export const ISLAND_CENTER_Z = -12;
export const ISLAND_SAND_PALETTE = Object.freeze({ dry: "#f9dc99", wet: "#dfbc80", wetBlend: 0.55 });
export const COAST_SAND_ALBEDO = Object.freeze(new Color(ISLAND_SAND_PALETTE.dry)
  .lerp(new Color(ISLAND_SAND_PALETTE.wet), ISLAND_SAND_PALETTE.wetBlend).toArray());
export function shoreRadius(angle) {
  return 1 + 0.028 * Math.sin(angle * 5 + 0.7) + 0.016 * Math.cos(angle * 9) + 0.012 * Math.sin(angle * 13);
}
export function baseSandHeight(radius, x, z) {
  return radius > 1 ? 0.035 - 0.37 * ((radius - 1) / 0.08)
    : 0.035 + 0.58 * Math.pow(Math.max(0, 1 - radius), 1.08)
      + 0.03 * Math.sin(x * 0.9) * Math.cos(z * 0.8) * (1 - radius);
}
export function coastalRadiusAt(x, z) {
  const qx = x / 12, qz = (z - ISLAND_CENTER_Z) / 9;
  return Math.hypot(qx, qz) / shoreRadius(Math.atan2(qz, qx));
}
export function worldCoastalRadiusAt(x, z) {
  return Math.min(coastalRadiusAt(x, z), adiyogiRadiusAt(x, z));
}
function smoothstep(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
function coastalHeight(x, z, radius) {
  if (radius <= 1.08) return baseSandHeight(radius, x, z - ISLAND_CENTER_Z) - 0.012;
  const angle = Math.atan2((z - ISLAND_CENTER_Z) / 9, x / 12);
  const width = 0.58 + Math.sin(angle * 2 + 0.8) * 0.085 + Math.cos(angle * 5 - 0.7) * 0.045;
  const t = Math.min(1, (radius - 1.08) / width);
  const start = baseSandHeight(1.08, x, z - ISLAND_CENTER_Z) - 0.012;
  // Cubic Hermite joins the sand edge's actual height and downward slope,
  // then reaches the lagoon floor with zero slope. Cove widths are unequal.
  return SEABED_Y + (start - SEABED_Y) * (2 * t * t * t - 3 * t * t + 1)
    - (0.37 / 0.08) * width * (t * t * t - 2 * t * t + t);
}
// Unequal overlapping lobes describe accumulated silt, with room for the three
// reef crowns. Each lobe and its derivative reach zero at its outer boundary.
const SEDIMENT_LOBES = [
  [-19.15, -13.4, 4.4, 3.6, 0.22, 0.5],
  [-20.5, -12.8, 2.8, 2.0, -0.32, 0.22],
  [-15.55, -6.25, 4.3, 3.6, -0.25, 0.81],
  [-14.1, -6.8, 2.7, 2.2, 0.55, 0.28],
  [-10.05, -1.95, 4.2, 3.45, 0.32, 1.19],
  [-11.4, -2.8, 2.7, 2.4, -0.45, 0.38],
];
function sedimentRelief(x, z) {
  let volume = 0;
  for (const [cx, cz, rx, rz, angle, height] of SEDIMENT_LOBES) {
    const dx = x - cx, dz = z - cz, c = Math.cos(angle), s = Math.sin(angle);
    const u = (dx * c + dz * s) / rx, v = (-dx * s + dz * c) / rz;
    const shoulder = Math.max(0, 1 - u * u - v * v);
    const lobe = height * shoulder * shoulder;
    volume += lobe * lobe * lobe;
  }
  return Math.cbrt(volume);
}
function sedimentHeight(x, z) {
  const sediment = sedimentRelief(x, z);
  const radius = coastalRadiusAt(x, z), coast = coastalHeight(x, z, radius);
  if (radius <= 1.08) return coast;
  const coastalRelief = Math.max(0, coast - SEABED_Y);
  return SEABED_Y + Math.pow(coastalRelief ** 6 + sediment ** 6 * smoothstep(1.08, 1.25, radius), 1 / 6);
}
const { x: originX, z: originZ, step, columns, rows } = SEABED_GRID;
const heights = new Float32Array(columns * rows);
const siltWeights = new Float32Array(columns * rows);
for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < columns; ix++) {
  const x = originX + ix * step, z = originZ + iz * step;
  heights[iz * columns + ix] = Math.max(sedimentHeight(x, z), adiyogiTerrainHeight(x, z) - 0.012);
  const radius = coastalRadiusAt(x, z);
  if (radius > 1.08) {
    const coastContribution = Math.max(0, coastalHeight(x, z, radius) - SEABED_Y) ** 6;
    const siltContribution = sedimentRelief(x, z) ** 6 * smoothstep(1.08, 1.25, radius);
    const total = coastContribution + siltContribution;
    siltWeights[iz * columns + ix] = total > 1e-12 ? siltContribution / total : 0;
  }
}
let maximumHeight = SEABED_Y;
for (const height of heights) maximumHeight = Math.max(maximumHeight, height);
export const SEABED_MAX_Y = maximumHeight;

// This interpolation is the same diagonal used by the physical triangle mesh.
export function seabedHeightAt(x, z) {
  const gx = (x - originX) / step, gz = (z - originZ) / step;
  if (gx < 0 || gz < 0 || gx >= columns - 1 || gz >= rows - 1) return SEABED_Y;
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
  const i = iz * columns + ix;
  const a = heights[i], b = heights[i + 1], c = heights[i + columns], d = heights[i + columns + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
// The water surface and buoyant bodies need the same triangle slopes used by
// seabedSample in GLSL, including its branch at grid vertices and diagonals.
export function seabedSampleAt(x, z, target = {}) {
  const gx = (x - originX) / step, gz = (z - originZ) / step;
  const shaderX = Math.fround(Math.fround(Math.fround(x) - originX) / step);
  const shaderZ = Math.fround(Math.fround(Math.fround(z) - originZ) / step);
  if (shaderX < 0 || shaderZ < 0 || shaderX >= columns - 1 || shaderZ >= rows - 1) {
    target.height = SEABED_Y; target.slopeX = 0; target.slopeZ = 0;
    return target;
  }
  // Match the GPU's triangle selection even within float32 rounding of a
  // diagonal. Height interpolation retains the caller's continuous position.
  const ix = Math.floor(shaderX), iz = Math.floor(shaderZ), u = gx - ix, v = gz - iz;
  const shaderU = shaderX - ix, shaderV = shaderZ - iz;
  const i = iz * columns + ix;
  const a = heights[i], b = heights[i + 1], c = heights[i + columns], d = heights[i + columns + 1];
  if (Math.fround(shaderU + shaderV) <= 1) {
    target.height = a + (b - a) * u + (c - a) * v;
    target.slopeX = (b - a) / step; target.slopeZ = (c - a) / step;
  } else {
    target.height = d + (c - d) * (1 - u) + (b - d) * (1 - v);
    target.slopeX = (d - c) / step; target.slopeZ = (d - b) / step;
  }
  return target;
}
// Material weights follow the same triangle diagonal and grid as physical depth.
export function seabedSiltWeightAt(x, z) {
  const gx = (x - originX) / step, gz = (z - originZ) / step;
  if (gx < 0 || gz < 0 || gx >= columns - 1 || gz >= rows - 1) return 0;
  const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, i = iz * columns + ix;
  const a = siltWeights[i], b = siltWeights[i + 1], c = siltWeights[i + columns], d = siltWeights[i + columns + 1];
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
// A rectangle containing the entire body footprint gives a conservative floor
// bound, including triangle vertices just outside its edge. Wildlife uses this
// before entering raised ground, rather than checking only its body center.
export function seabedMaxHeightWithin(x, z, radius = 0) {
  if (!Number.isFinite(x + z + radius)) return SEABED_MAX_Y;
  const minX = Math.max(0, Math.floor((x - radius - originX) / step));
  const maxX = Math.min(columns - 1, Math.ceil((x + radius - originX) / step));
  const minZ = Math.max(0, Math.floor((z - radius - originZ) / step));
  const maxZ = Math.min(rows - 1, Math.ceil((z + radius - originZ) / step));
  let highest = SEABED_Y;
  for (let iz = minZ; iz <= maxZ; iz++) for (let ix = minX; ix <= maxX; ix++) highest = Math.max(highest, heights[iz * columns + ix]);
  return highest;
}
export function createSeabedGeometry() {
  const positions = [], indices = [];
  for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < columns; ix++) positions.push(originX + ix * step, heights[iz * columns + ix], originZ + iz * step);
  for (let iz = 0; iz < rows - 1; iz++) for (let ix = 0; ix < columns - 1; ix++) {
    const a = iz * columns + ix, b = a + 1, c = a + columns, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function createSeabedFieldTexture() {
  const texture = new DataTexture(heights.slice(), columns, rows, RedFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
export function createSeabedMaterialTexture() {
  const texture = new DataTexture(siltWeights.slice(), columns, rows, RedFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
// The GPU samples the same float field and the same triangle diagonal as the CPU.
export const SEABED_GLSL = `
uniform sampler2D uSeabedField,uSeabedMaterial;
uniform vec4 uSeabedGrid;
uniform vec2 uSeabedSize;
uniform float uSeabedMaxHeight;
float coastalRadius(vec2 p){
 vec2 q=(p-vec2(0.,-12.))/vec2(12.,9.);
 float angle=atan(q.y,q.x);
 float radius=1.+.028*sin(angle*5.+.7)+.016*cos(angle*9.)+.012*sin(angle*13.);
 return length(q)/radius;
}
float adiyogiRadius(vec2 p){
 vec2 q=(p-vec2(${ADIYOGI_ISLAND.x.toFixed(1)},${ADIYOGI_ISLAND.z.toFixed(1)}))/vec2(${ADIYOGI_ISLAND.radiusX.toFixed(1)},${ADIYOGI_ISLAND.radiusZ.toFixed(1)});
 float a=atan(q.y,q.x);
 return length(q)/(1.+.035*sin(a*3.+.4)+.018*cos(a*5.-.6));
}
float shore(vec2 p){return min(coastalRadius(p),adiyogiRadius(p))-(1.+(.035+.08)*.08/.37);}

vec3 seabedSample(vec2 p){
 vec2 grid=(p-uSeabedGrid.xy)/uSeabedGrid.z;
 if(any(lessThan(grid,vec2(0.)))||any(greaterThanEqual(grid,uSeabedSize-1.)))return vec3(uSeabedGrid.w,0.,0.);
 vec2 cell=floor(grid),f=fract(grid);
 float a=texture2D(uSeabedField,(cell+.5)/uSeabedSize).r;
 float b=texture2D(uSeabedField,(cell+vec2(1.5,.5))/uSeabedSize).r;
 float c=texture2D(uSeabedField,(cell+vec2(.5,1.5))/uSeabedSize).r;
 float d=texture2D(uSeabedField,(cell+1.5)/uSeabedSize).r;
 if(f.x+f.y<=1.)return vec3(a+(b-a)*f.x+(c-a)*f.y,(b-a)/uSeabedGrid.z,(c-a)/uSeabedGrid.z);
 return vec3(d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y),(d-c)/uSeabedGrid.z,(d-b)/uSeabedGrid.z);
}
float seabedHeight(vec2 p){return seabedSample(p).x;}
float seabedSiltWeight(vec2 p){
 vec2 grid=(p-uSeabedGrid.xy)/uSeabedGrid.z;
 if(any(lessThan(grid,vec2(0.)))||any(greaterThanEqual(grid,uSeabedSize-1.)))return 0.;
 vec2 cell=floor(grid),f=fract(grid);
 float a=texture2D(uSeabedMaterial,(cell+.5)/uSeabedSize).r;
 float b=texture2D(uSeabedMaterial,(cell+vec2(1.5,.5))/uSeabedSize).r;
 float c=texture2D(uSeabedMaterial,(cell+vec2(.5,1.5))/uSeabedSize).r;
 float d=texture2D(uSeabedMaterial,(cell+1.5)/uSeabedSize).r;
 return f.x+f.y<=1.?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
}

`;

export function createReefHeightField(geometry, rocks) {
  const p = geometry.attributes.position;
  const groups = rocks.map((rock) => {
    const triangles = [], c = Math.cos(rock.angle || 0), s = Math.sin(rock.angle || 0);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) * rock.scale[0], dz = p.getZ(i) * rock.scale[2];
      const x = rock.position[0] + dx * c + dz * s, y = rock.position[1] + p.getY(i) * rock.scale[1], z = rock.position[2] - dx * s + dz * c;
      triangles.push(x, y, z);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); maxY = Math.max(maxY, y);
    }
    return Object.freeze({ triangles: new Float32Array(triangles), minX, maxX, minZ, maxZ, maxY });
  });
  const heightAt = (x, z) => {
    let highest = seabedHeightAt(x, z);
    for (const group of groups) {
      if (x < group.minX || x > group.maxX || z < group.minZ || z > group.maxZ) continue;
      const p = group.triangles;
      for (let i = 0; i < p.length; i += 9) {
        const ax = p[i], az = p[i + 2], bx = p[i + 3], bz = p[i + 5], cx = p[i + 6], cz = p[i + 8];
        const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(denominator) < 1e-10) continue;
        const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
        const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator, third = 1 - a - b;
        if (a >= -1e-6 && b >= -1e-6 && third >= -1e-6) highest = Math.max(highest, a * p[i + 1] + b * p[i + 4] + third * p[i + 7]);
      }
    }
    return highest;
  };
  const maxHeightWithin = (x, z, radius = 0) => {
    let highest = seabedMaxHeightWithin(x, z, radius);
    for (const group of groups) {
      if (group.maxX < x - radius || group.minX > x + radius || group.maxZ < z - radius || group.minZ > z + radius) continue;
      const p = group.triangles;
      for (let i = 0; i < p.length; i += 9) {
        const minX = Math.min(p[i], p[i + 3], p[i + 6]), maxX = Math.max(p[i], p[i + 3], p[i + 6]);
        const minZ = Math.min(p[i + 2], p[i + 5], p[i + 8]), maxZ = Math.max(p[i + 2], p[i + 5], p[i + 8]);
        if (maxX < x - radius || minX > x + radius || maxZ < z - radius || minZ > z + radius) continue;
        highest = Math.max(highest, p[i + 1], p[i + 4], p[i + 7]);
      }
    }
    return highest;
  };
  return Object.freeze({ heightAt, maxHeightWithin, rockGroups: Object.freeze(groups), terrainMaxY: SEABED_MAX_Y });
}
