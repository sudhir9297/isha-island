import * as THREE from "three";
import { gateTerrainHeight } from "./GateTerrain.js";
import { baseSandHeight, shoreRadius } from "./Seabed.js";

export function gateGround(x, z) {
  const a = Math.atan2(z / 9, x / 12);
  const radius = Math.hypot(x / 12, z / 9) / shoreRadius(a);
  return gateTerrainHeight(x, z, baseSandHeight(radius, x, z));
}
export function makeEntrancePath(sandGeometry) {
  const terrain = new THREE.Mesh(sandGeometry), ray = new THREE.Raycaster();
  const origin = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const heightAt = (x, z) => {
    ray.set(origin.set(x, 12, z), down);
    return ray.intersectObject(terrain, false)[0]?.point.y ?? gateGround(x, z);
  };
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(7, 0, 7.15), new THREE.Vector3(5.8, 0, 5.2), new THREE.Vector3(2.25, 0, 3.85),
    new THREE.Vector3(0, 0, 2.3), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3.3),
  ], false, "centripetal");
  const positions = [], colors = [], uv = [], indices = [], rows = 32, columns = 3;
  const shades = ["#d0c4a6", "#d5c9ac", "#c9bda0", "#c3b99d", "#d8caac"];
  const sample = (t, across) => {
    const p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const halfWidth = 0.96 + 0.52 * (1 - THREE.MathUtils.smoothstep(Math.abs(p.x), 0.5, 2));
    const x = p.x + tangent.z * across * halfWidth, z = p.z - tangent.x * across * halfWidth;
    return [x, heightAt(x, z) + 0.05, z];
  };
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const t0 = (row + 0.02) / rows, t1 = (row + 0.98) / rows;
    const a0 = -1 + (col + 0.018) * 2 / columns, a1 = -1 + (col + 0.982) * 2 / columns;
    const corners = [sample(t0, a0), sample(t1, a0), sample(t1, a1), sample(t0, a1)];
    const center = sample((t0 + t1) / 2, (a0 + a1) / 2), start = positions.length / 3;
    const c = new THREE.Color(shades[(row * 7 + col * 3) % shades.length]);
    for (const p of [center, ...corners]) { positions.push(...p); colors.push(c.r, c.g, c.b); uv.push(p[0] * 0.6, p[2] * 0.6); }
    for (let k = 0; k < 4; k++) indices.push(start, start + 1 + k, start + 1 + (k + 1) % 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
