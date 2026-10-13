import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { addLeafWind, useIslandWind } from "./Wind.js";
import { shoreRadius, baseSandHeight, ISLAND_SAND_PALETTE } from "./Seabed.js";
import { makeIslandSandTextures } from "./IslandSand.js";
import { useFrame } from "@react-three/fiber";
import { createBeachWetting, BEACH_WETTING_KEY } from "./BeachWetting.js";
import CoastalDetails from "./CoastalDetails.jsx";
import { islandCover } from "./IslandHabitat.js";
import MalaiVasal from "./MalaiVasal.jsx";
import { gateGround } from "./MalaiVasalGeometry.js";
import { GATE, gateTerrainHeight } from "./GateTerrain.js";

const CENTER_Z = -12;
const TAU = Math.PI * 2;
function random(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AUTHORED_GARDENS = [
  { position: [-3.7, 0.42, 2.15], scale: 1.12, seed: 3211, flowers: false, composition: "porch" },
  { position: [4.2, 0.42, 2.8], scale: 0.8, seed: 3423, flowers: false, composition: "steps" },
  { position: [8.4, 0.42, 3.6], scale: 1, seed: 3706, flowers: true, composition: "harbour" },
];

function sandGroundingSites() {
  const sites = AUTHORED_GARDENS.flatMap((garden) =>
    GARDEN_COMPOSITIONS[garden.composition].roots.map(([x, y, z, size]) => ({
      x: garden.position[0] + x * garden.scale,
      z: garden.position[2] + z * garden.scale,
      rx: 0.54 * size,
      rz: 0.48 * size,
      floor: garden.position[1] + y,
      shade: 0.21,
    })),
  );
  const add = (x, z, rx, rz, shade, floor) => sites.push({x, z, rx, rz, shade, floor});
  [
    [-5.6, -0.3, 0.46], [5.2, -2.4, 0.45], [-2.6, -4.4, 0.46],
    [-7.4, -3.3, 0.38], [7, -4.9, 0.42],
    [-6.7, 3.2, 0.4],
  ].forEach(([x, z, floor]) => add(x, z, 0.43, 0.43, 0.19, floor - 0.015));
  add(-8.55, 2.3, 0.6, 0.43, 0.22);
  add(-8.2, 2.78, 0.35, 0.3, 0.22);
  add(-7.65, 2.47, 0.43, 0.36, 0.22);
  for (const side of [-1, 1]) {
    add(side * 2.25, 0.15, 0.65, 0.62, 0.28);
    add(side * 5.1, 0, 0.42, 0.5, 0.22);
  }
  add(-7.6, 3.4, 0.9, 0.65, 0.22);
  add(7.8, 1.5, 0.9, 0.65, 0.22);
  return sites;
}

function makeSand() {
  const radial = 36,
    segments = 160,
    positions = [],
    colors = [],
    indices = [],
    uv = [],
    grounding = [],
    sites = sandGroundingSites();
  const base = new THREE.Color(ISLAND_SAND_PALETTE.dry),
    wet = new THREE.Color(ISLAND_SAND_PALETTE.wet),
    groundCover = new THREE.Color("#79a66e");
  for (let j = 0; j <= radial; j++)
    for (let i = 0; i <= segments; i++) {
      const r = (j / radial) * 1.08,
        a = (i / segments) * TAU,
        s = shoreRadius(a);
      const x = Math.cos(a) * 12 * r * s,
        z = Math.sin(a) * 9 * r * s;
      const h = gateTerrainHeight(x, z, baseSandHeight(r, x, z));
      let raisedHeight = h, contact = 0, support = 0;
      const inland = 1 - THREE.MathUtils.smoothstep(r, 0.9, 0.975);
      for (const site of sites) {
        const distance = ((x - site.x) / site.rx) ** 2 + ((z - site.z) / site.rz) ** 2;
        if (distance > 12) continue;
        const falloff = Math.exp(-distance * 0.85) * inland;
        contact = Math.max(contact, site.shade * falloff);
        if (site.floor !== undefined) {
          raisedHeight = Math.max(raisedHeight, h + Math.max(0, site.floor - h) * falloff);
          support = Math.max(support, falloff);
        }
      }
      positions.push(x, raisedHeight, z);
      grounding.push(support);
      uv.push(x / 24 + 0.5, z / 18 + 0.5);
      const c = base
        .clone()
        .lerp(wet, Math.min(1, Math.max(0, (r - 0.81) / 0.27)) * ISLAND_SAND_PALETTE.wetBlend);
      c.multiplyScalar(1 + 0.012 * Math.sin(x * 6.3 + z * 3.7) + 0.032 * Math.sin(x * 0.31 + z * 0.19) * Math.cos(z * 0.24));
      c.lerp(groundCover, islandCover(x, z) * 0.86);
      c.multiplyScalar(1 - contact);
      colors.push(
        c.r,
        c.g,
        c.b,
        1 - THREE.MathUtils.smoothstep(r, 1.015, 1.08),
      );
      if (j < radial && i < segments) {
        const v = j * (segments + 1) + i;
        indices.push(
          v,
          v + 1,
          v + segments + 1,
          v + 1,
          v + segments + 2,
          v + segments + 1,
        );
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Shallow beach dunes should not shade like a vertical seawall at the waterline.
  const normals = g.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3(
      normals.getX(i) * (0.35 + grounding[i] * 0.4),
      Math.max(0.5, normals.getY(i)),
      normals.getZ(i) * (0.35 + grounding[i] * 0.4),
    ).normalize();
    normals.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

function canvasTexture(type) {
  const canvas = document.createElement("canvas");
  canvas.width = type === "sand" ? 256 : 512;
  canvas.height = type === "sand" ? 256 : 128;
  const ctx = canvas.getContext("2d"), rnd = random(type === "sand" ? 512 : 987);
  ctx.fillStyle = type === "sand" ? "#fff9e8" : "#dbc08e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (type === "sand") {
    for (let i = 0; i < 3800; i++) {
      ctx.globalAlpha = 0.05 + rnd() * 0.12;
      ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#624526";
      const size = 0.5 + rnd() * 1.2;
      ctx.fillRect(rnd() * 256, rnd() * 256, size, size);
    }
  } else {
    // Six tonal strands remain distinct when a plank is only a few pixels deep.
    for (let i = 0; i < 6; i++) {
      const y = 11 + (i / 6) * 112 + rnd() * 5;
      ctx.globalAlpha = i % 3 ? 0.12 + rnd() * 0.06 : 0.16;
      ctx.strokeStyle = i % 3 ? "#624526" : "#fff8e7";
      ctx.lineWidth = i % 3 ? 6 + rnd() * 5 : 4 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(160, y + rnd() * 9 - 4.5, 360, y - rnd() * 9 + 4.5, 512, y + rnd() * 5 - 2.5);
      ctx.stroke();
    }
    const knotX = 275 + rnd() * 80, knotY = 53 + rnd() * 18;
    for (let ring = 0; ring < 3; ring++) {
      ctx.globalAlpha = 0.08 + ring * 0.018;
      ctx.strokeStyle = "#70532f";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(knotX, knotY, 12 + ring * 12, 3 + ring * 3.5, -0.025, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const edge = ctx.createLinearGradient(0, 0, 0, 128);
    edge.addColorStop(0, "rgba(255,248,231,0.28)");
    edge.addColorStop(0.075, "rgba(255,248,231,0)");
    edge.addColorStop(0.925, "rgba(85,62,35,0)");
    edge.addColorStop(1, "rgba(85,62,35,0.18)");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 512, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(type === "sand" ? 8 : 1, type === "sand" ? 8 : 1);
  tex.anisotropy = type === "sand" ? 4 : 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function finishLeafNormals(geometry, rows, columns, halves = 1) {
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal, positions = geometry.attributes.position;
  const halfSize = rows * columns, sum = new THREE.Vector3(), normal = new THREE.Vector3();
  // Collapsed tips have degenerate triangles. Every coincident vertex needs the
  // same valid shading normal, including vertices with no nonzero face area.
  for (const row of [0, rows - 1]) {
    sum.set(0, 0, 0);
    for (let half = 0; half < halves; half++)
      for (let column = 0; column < columns; column++)
        sum.add(normal.fromBufferAttribute(normals, half * halfSize + row * columns + column));
    sum.normalize();
    for (let half = 0; half < halves; half++)
      for (let column = 0; column < columns; column++)
        normals.setXYZ(half * halfSize + row * columns + column, sum.x, sum.y, sum.z);
  }
  if (halves !== 2) return;
  // The two palm halves sample the curved midrib at unequal intervals. Blend
  // their normals at the same longitudinal position without welding the outline.
  const seams = [0, 1].map((half) => Array.from({ length: rows }, (_, row) => {
    const vertex = half * halfSize + row * columns;
    return { z: positions.getZ(vertex), normal: new THREE.Vector3().fromBufferAttribute(normals, vertex) };
  }));
  for (let half = 0; half < 2; half++) {
    const opposite = seams[1 - half];
    seams[half].forEach((sample, row) => {
      let upper = 1;
      while (upper < rows - 1 && opposite[upper].z < sample.z) upper++;
      const low = opposite[upper - 1], high = opposite[upper];
      const t = THREE.MathUtils.clamp((sample.z - low.z) / (high.z - low.z), 0, 1);
      normal.copy(low.normal).lerp(high.normal, t).add(sample.normal).normalize();
      normals.setXYZ(half * halfSize + row * columns, normal.x, normal.y, normal.z);
    });
  }
}

const LEAF_STEPS = 12;
const LEAF_COLUMNS = 7;

function makeLeaf(length, width, lift, droop, seed = 1) {
  const steps = LEAF_STEPS,
    across = LEAF_COLUMNS,
    p = [],
    c = [],
    thinness = [],
    surface = [],
    ix = [],
    col = new THREE.Color(),
    rnd = random(seed);
  const leafFamily = Math.abs(seed) % 5;
  const leafLights = ["#9acb82", "#81bc78", "#64a977", "#96c47a", "#73b794"];
  const leafDarks = ["#44845d", "#397d60", "#306d56", "#4d8c64", "#3c8167"];
  const light = new THREE.Color(leafLights[leafFamily]),
    dark = new THREE.Color(leafDarks[leafFamily]);
  const shoulder = THREE.MathUtils.clamp(0.34 + rnd() * 0.17 + [0.025, -0.1, 0.015, -0.05, -0.01][leafFamily], 0.25, 0.54);
  const bend = (rnd() - 0.5) * width * 0.54;
  const roll = (rnd() - 0.5) * 0.68;
  const imbalance = (rnd() - 0.5) * 0.26;
  const fold = (0.25 + rnd() * 0.18) * [0.55, 0.8, 0.63, 0.85, 0.65][leafFamily];
  const camber = 0.08 + rnd() * 0.09;
  const phase = rnd() * TAU;
  const leafTone = 0.39 + rnd() * 0.23;
  const tail = [0.94, 1.15, 0.88, 0.98, 1.1][leafFamily];
  const basePower = shoulder * tail / (1 - shoulder);
  const peak = Math.pow(shoulder, basePower) * Math.pow(1 - shoulder, tail);
  const widthScale = [0.94, 0.68, 0.84, 0.75, 0.97][leafFamily];
  const edgeCurl = [0.18, 0.34, 0.22, 0.41, 0.1][leafFamily] * (0.72 + (0.5 + Math.sin(phase) * 0.5) * 0.5);
  const tipCurl = [0.025, 0.07, 0.018, 0.09, 0.02][leafFamily];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      // Smooth spade, lance and rolled forms share a continuous curved shoulder.
      breadth = Math.pow(t, basePower) * Math.pow(1 - t, tail) / peak * width * widthScale,
      hookedTip = Math.pow(THREE.MathUtils.smoothstep(t, 0.58, 1), 3);
    for (let j = 0; j < across; j++) {
      const side = (j / (across - 1)) * 2 - 1;
      p.push(
        side * breadth * (1 + side * imbalance) + bend * t * t + width * 0.035 * Math.sin(t * TAU) +
          width * Math.sin(phase) * 0.11 * hookedTip,
        Math.sin(Math.PI * t) * lift -
          t * t * droop -
          side * side * breadth * fold +
          Math.pow(Math.abs(side), 3.4) * breadth * edgeCurl * (0.45 + Math.sin(t * Math.PI) * 0.55) +
          breadth * camber * Math.sin(t * Math.PI * 1.6 + phase) * (1 - side * side) +
          side * breadth * roll * t + Math.pow(t, 5) * width * 0.12 + hookedTip * tipCurl * length,
        t * length + side * breadth * imbalance * 0.5 - hookedTip * tipCurl * length * 0.5,
      );
      col.copy(dark).lerp(light, leafTone + (1 - Math.abs(side)) * 0.13 + t * 0.13);
      c.push(col.r, col.g, col.b);
      surface.push(j / (across - 1), t);
      thinness.push((0.15 + Math.pow(Math.abs(side), 1.3) * 0.8) * THREE.MathUtils.smoothstep(t, 0.04, 0.3));
    }
    if (i < steps) {
      for (let j = 0; j < across - 1; j++) {
        const k = i * across + j;
        ix.push(k, k + across, k + 1, k + 1, k + across, k + across + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  g.setAttribute("leafThinness", new THREE.Float32BufferAttribute(thinness, 1));
  g.setAttribute("leafSurface", new THREE.Float32BufferAttribute(surface, 2));
  g.setIndex(ix);
  finishLeafNormals(g, steps + 1, across);
  return g;
}

function thinLeafLighting(shader) {
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `
    #include <common>
    attribute float leafThinness;
    attribute vec2 leafSurface;
    varying float vLeafThinness;
    varying vec2 vLeafSurface;
  `).replace("#include <begin_vertex>", `
    #include <begin_vertex>
    vLeafThinness = leafThinness;
    vLeafSurface = leafSurface;
  `);
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
    #include <common>
    varying float vLeafThinness;
    varying vec2 vLeafSurface;
    float leafVeinRelief(vec2 surface) {
      float lateral = surface.x * 2.0 - 1.0;
      float rib = exp(-lateral * lateral * 85.0);
      float phase = (surface.y - abs(lateral) * 0.16) * 150.0;
      // Derivative filtering prevents distant veins from becoming dotted stripes.
      float detail = 1.0 - smoothstep(0.5, 2.5, fwidth(phase));
      float secondary = cos(phase) * (1.0 - rib) * detail;
      float taper = sin(clamp(surface.y, 0.0, 1.0) * PI);
      return (rib * 0.0008 + secondary * 0.00028) * taper;
    }
  `).replace("#include <roughnessmap_fragment>", `
    #include <roughnessmap_fragment>
    float leafLateral = vLeafSurface.x * 2.0 - 1.0;
    roughnessFactor = clamp(roughnessFactor + 0.07 * leafLateral * leafLateral -
      0.035 * exp(-leafLateral * leafLateral * 30.0), 0.35, 1.0);
  `).replace("#include <normal_fragment_maps>", `
    #include <normal_fragment_maps>
    float relief = leafVeinRelief(vLeafSurface);
    vec3 leafDx = dFdx(-vViewPosition), leafDy = dFdy(-vViewPosition);
    vec3 leafR1 = cross(leafDy, normal), leafR2 = cross(normal, leafDx);
    float leafDet = dot(leafDx, leafR1);
    if (abs(leafDet) > 1e-10) {
      vec3 gradient = sign(leafDet) * (dFdx(relief) * leafR1 + dFdy(relief) * leafR2);
      normal = normalize(abs(leafDet) * normal - gradient);
    }
  `).replace("#include <lights_physical_pars_fragment>", `
    #include <lights_physical_pars_fragment>
    void RE_Direct_Leaf(const in IncidentLight directLight, const in vec3 geometryPosition,
      const in vec3 geometryNormal, const in vec3 geometryViewDir,
      const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material,
      inout ReflectedLight reflectedLight) {
      RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir,
        geometryClearcoatNormal, material, reflectedLight);
      float grazing = saturate(0.5 - 0.5 * dot(geometryNormal, directLight.direction));
      float leafScatter = grazing * grazing * (0.18 + vLeafThinness * 0.82) * 0.46;
      vec3 thinPigment = mix(material.diffuseColor, vec3(0.34, 0.49, 0.16), vLeafThinness * 0.2);
      reflectedLight.directDiffuse += directLight.color * thinPigment * RECIPROCAL_PI * leafScatter;
    }
    #undef RE_Direct
    #define RE_Direct RE_Direct_Leaf
  `);
}

function useFoliageDisposal(data) {
  useEffect(() => () => Object.values(data).forEach((resource) => {
    if (resource?.isBufferGeometry) resource.dispose();
  }), [data]);
}

function addColors(g, color) {
  const c = new THREE.Color(color),
    a = [];
  for (let i = 0; i < g.attributes.position.count; i++) a.push(c.r, c.g, c.b);
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  return g;
}
function joined(geoms) {
  const g = mergeGeometries(geoms);
  geoms.forEach((x) => x.dispose());
  return g;
}

function frondCenter(t, length, lift, droop, sway) {
  return new THREE.Vector3(sway * t * t, Math.sin(Math.PI * t) * lift - t * t * (0.45 + t * 0.55) * droop, t * length);
}

function makePalmFrond(length, width, lift, droop, sway, seed) {
  const positions = [], colors = [], thinness = [], surface = [], indices = [], rnd = random(seed);
  const light = new THREE.Color(seed % 2 ? "#92c681" : "#80b979");
  const dark = new THREE.Color(seed % 3 ? "#427e59" : "#397456");
  const tone = 0.42 + rnd() * 0.31;
  const roll = (rnd() - 0.5) * 1.02;
  const shoulder = 0.28 + rnd() * 0.18;
  const taper = 0.94 + rnd() * 0.5;
  const fold = 0.065 + rnd() * 0.11;
  const camber = 0.1 + rnd() * 0.12;
  const phase = rnd() * TAU;
  const edgeCurl = 0.2 + (0.5 + Math.sin(phase) * 0.5) * 0.15 + (seed % 4 === 0 ? 0.13 : 0);
  const widthScale = seed % 4 === 0 ? 0.76 : 1;
  const basePower = shoulder * taper / (1 - shoulder);
  const peak = Math.pow(shoulder, basePower) * Math.pow(1 - shoulder, taper);
  const lobes = 5 + (seed % 4), rows = 37, columns = 7;
  // Rounded swept lobes retain the miniature's broad fronds. Their shallow cuts
  // vary across the two sides without a sawtooth outline or a sharp center fold.
  for (const side of [-1, 1]) {
    const faceTone = tone + (rnd() - 0.5) * 0.1;
    const asymmetry = 0.92 + rnd() * 0.16;
    const edgePhase = rnd() * 1.3, notchDepth = 0.075 + rnd() * 0.105;
    const offset = positions.length / 3;
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1);
      const root = frondCenter(t, length, lift, droop, sway);
      const profile = Math.pow(t, basePower) * Math.pow(1 - t, taper) / peak;
      const envelope = profile * width * asymmetry * widthScale;
      const scallop = Math.pow(0.5 + 0.5 * Math.sin(t * TAU * lobes + edgePhase + Math.sin(t * TAU) * 0.32), 3);
      const edge = 1 - notchDepth * scallop * Math.sin(Math.PI * t);
      for (let column = 0; column < columns; column++) {
        const lateral = column / (columns - 1);
        const reach = envelope * lateral * (1 - (1 - edge) * Math.pow(lateral, 3));
        positions.push(
          root.x + side * reach,
          root.y - envelope * lateral * lateral * (fold + t * 0.1) +
            envelope * edgeCurl * Math.pow(lateral, 3.4) * Math.sin(t * Math.PI) +
            side * reach * roll * t * (0.35 + Math.sin(t * Math.PI) * 0.65) +
            envelope * camber * Math.sin(t * Math.PI * 1.7 + phase) * lateral * lateral * (1 - lateral),
          root.z + reach * (0.21 + t * 0.16),
        );
        // A shared midrib pigment keeps the two separately shaped halves seamless.
        const color = dark.clone().lerp(light, THREE.MathUtils.lerp(tone + 0.1, faceTone, lateral) + t * 0.08);
        colors.push(color.r, color.g, color.b);
        surface.push(0.5 + side * lateral * 0.5, t);
        thinness.push((0.12 + lateral * lateral * 0.83) * THREE.MathUtils.smoothstep(t, 0.03, 0.27));
        if (row < rows - 1 && column < columns - 1) {
          const k = offset + row * columns + column;
          if (side === 1) indices.push(k, k + columns, k + 1, k + 1, k + columns, k + columns + 1);
          else indices.push(k, k + 1, k + columns, k + 1, k + columns + 1, k + columns);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("leafThinness", new THREE.Float32BufferAttribute(thinness, 1));
  geometry.setAttribute("leafSurface", new THREE.Float32BufferAttribute(surface, 2));
  geometry.setIndex(indices);
  finishLeafNormals(geometry, rows, columns, 2);
  return geometry;
}

function Palm({ position, height = 5, lean = 0.8, seed = 1, scale = 1 }) {
  const [wind, windRoot] = useIslandWind(height, 0.115, thinLeafLighting);
  const data = useMemo(() => {
    const rnd = random(seed),
      direction = rnd() * TAU;
    const top = new THREE.Vector3(
      Math.cos(direction) * lean,
      height,
      Math.sin(direction) * lean,
    );
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(top.x * 0.08, height * 0.34, top.z * 0.08),
      new THREE.Vector3(top.x * 0.45, height * 0.72, top.z * 0.45),
      top,
    ]);
    const trunk = new THREE.TubeGeometry(curve, 20, 0.16, 9, false);
    const rings = [];
    for (let i = 1; i < 19; i++) {
      const t = i / 20,
        ring = new THREE.TorusGeometry(0.165 - t * 0.018, 0.018, 3, 9),
        q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          curve.getTangent(t),
        );
      ring.applyQuaternion(q);
      ring.translate(...curve.getPoint(t).toArray());
      rings.push(ring);
    }
    const leaves = [],
      stems = [],
      bladeCount = 9 + Math.floor(rnd() * 3),
      crownTurn = rnd() * TAU,
      crownBias = rnd() * TAU;
    for (let i = 0; i < bladeCount; i++) {
      const a = (i / bladeCount) * TAU + crownTurn + (rnd() - 0.5) * 0.58;
      const upright =
        i === bladeCount - 1 || (i === bladeCount - 2 && seed % 2 === 0);
      const exposure = 0.5 + Math.cos(a - crownBias) * 0.5;
      const len = upright ? 1.1 + rnd() * 0.8 : 1.75 + rnd() * 0.92 + exposure * 0.25;
      const drop = upright ? -0.35 - rnd() * 0.52 : 0.42 + rnd() * 0.92 + (1 - exposure) * 0.22;
      const lift = upright ? 0.4 + rnd() * 0.33 : 0.22 + rnd() * 0.64 + exposure * 0.1;
      const sway = (rnd() - 0.5) * 0.65;
      const g = makePalmFrond(len, upright ? 0.27 + rnd() * 0.1 : 0.43 + rnd() * 0.15, lift, drop, sway, seed + i);
      g.rotateY(a);
      g.translate(top.x, top.y, top.z);
      addLeafWind(g, top, len);
      leaves.push(g);
      const points = Array.from({ length: 15 }, (_, k) => {
        const p = frondCenter(k / 14, len, lift + 0.008, drop, sway);
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
        return p.add(top);
      });
      stems.push(
        addLeafWind(new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          14,
          0.011,
          3,
          false,
        ), top, len),
      );
    }
    return {
      top,
      trunk,
      rings: joined(rings),
      leaves: joined(leaves),
      stems: joined(stems),
    };
  }, [height, lean, seed]);
  useFoliageDisposal(data);
  return (
    <group ref={windRoot} position={position} scale={scale}>
      <mesh geometry={data.trunk} castShadow receiveShadow {...wind.mesh}>
        <meshStandardMaterial color="#9c8563" roughness={1} onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} />
      </mesh>
      <mesh geometry={data.rings} castShadow {...wind.mesh}>
        <meshStandardMaterial color="#75684f" onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} />
      </mesh>
      <mesh geometry={data.leaves} castShadow receiveShadow {...wind.leafMesh}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.71}
          onBeforeCompile={wind.leafShader}
          customProgramCacheKey={wind.leafKey}
        />
      </mesh>
      <mesh geometry={data.stems} {...wind.leafMesh}>
        <meshStandardMaterial color="#7caa71" roughness={0.82} onBeforeCompile={wind.stemShader} customProgramCacheKey={wind.stemKey} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[
            data.top.x + Math.sin(i * 2.1) * 0.2,
            height - 0.15,
            data.top.z + Math.cos(i * 2.1) * 0.2,
          ]}
          castShadow
          {...wind.mesh}
        >
          <sphereGeometry args={[0.19, 9, 6]} />
          <meshStandardMaterial color={i % 2 ? "#7e6a33" : "#887437"} onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} />
        </mesh>
      ))}
    </group>
  );
}

function makePetal(length, width, cup, color, seed = 1) {
  const positions = [], colors = [], indices = [];
  const rnd = random(seed), base = new THREE.Color(color);
  const cream = color === "#fff1cf";
  const tip = new THREE.Color(cream ? "#fffbed" : "#ffd1df");
  const throat = new THREE.Color(cream ? "#e4bc6d" : "#ca658e");
  const shoulder = 0.62 + rnd() * 0.13;
  const curl = 0.2 + rnd() * 0.15;
  const sweep = (rnd() - 0.5) * 0.28;
  const petalTone = 0.12 + rnd() * 0.18;
  for (let row = 0; row <= 10; row++) {
    const t = row / 10;
    const breadth = (t < shoulder
      ? Math.pow(Math.sin(t / shoulder * Math.PI * 0.5), 0.82)
      : Math.pow(Math.cos((t - shoulder) / (1 - shoulder) * Math.PI * 0.5), 0.48)) * width;
    for (let column = 0; column < 5; column++) {
      const side = column / 2 - 1;
      positions.push(
        side * breadth + sweep * width * t * t,
        cup * THREE.MathUtils.smoothstep(t, 0.13, 0.96) - cup * 0.14 * Math.sin(Math.PI * t) +
          side * side * breadth * curl + side * breadth * sweep * Math.sin(t * Math.PI),
        length * t - side * side * breadth * 0.15,
      );
      const c = throat.clone().lerp(base, THREE.MathUtils.smoothstep(t, 0.02, 0.48));
      c.lerp(tip, petalTone + t * t * 0.22 + Math.abs(side) * 0.08);
      colors.push(c.r, c.g, c.b);
      if (row < 10 && column < 4) {
        const k = row * 5 + column;
        indices.push(k, k + 5, k + 1, k + 1, k + 5, k + 6);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const GARDEN_COMPOSITIONS = {
  porch: {
    roots: [[-0.42, 0, 0.3, 0.92], [0.32, 0.02, -0.34, 0.86], [0.85, 0.07, 0.35, 0.7]],
    blooms: [[-0.62, 0.67, 0.45, 1.1, 0], [0.2, 0.88, -0.15, 0.85, 0], [0.75, 0.72, 0.2, 0.62, 1], [-0.8, 0.55, -0.35, 0.75, 2]],
  },
  steps: {
    roots: [[-0.65, 0.02, -0.24, 0.85], [0.1, 0.03, 0.18, 1], [0.8, 0.04, 0.74, 0.78]],
    blooms: [[-0.46, 0.73, -0.12, 0.88, 0], [0.22, 0.89, 0.3, 1.12, 0], [0.8, 0.67, 0.69, 0.76, 1], [0.37, 0.59, -0.42, 0.78, 2]],
  },
  harbour: {
    roots: [[-1.05, 0, 0.42, 0.75], [-0.45, 0.06, 0.65, 0.78], [0.45, 0.03, 0.47, 0.85], [1.03, 0.02, 0.17, 0.65]],
    blooms: [[-0.72, 0.69, 0.52, 0.82, 0], [0.52, 0.86, 0.52, 1.1, 0], [0.95, 0.58, 0.1, 0.63, 1], [-0.28, 0.84, 0.7, 0.8, 2]],
  },
};

function PlantBed({ position, scale = 1, seed = 1, flowers = true, composition }) {
  const [wind, windRoot] = useIslandWind(0.9, 0.045, thinLeafLighting);
  const geometries = useMemo(() => {
    const rnd = random(seed), leaves = [], petals = [], cores = [];
    const authored = GARDEN_COMPOSITIONS[composition];
    if (authored) {
      authored.roots.forEach(([x, y, z, size], root) => {
        const turn = rnd() * TAU;
        // Wide folded leaves form a low skirt; four slender leaves rise through it.
        for (let i = 0; i < 12; i++) {
          const upright = i >= 8;
          const a = turn + (i / (upright ? 4 : 8)) * TAU + (rnd() - 0.5) * 0.24;
          const g = makeLeaf(
            (upright ? 0.83 : 0.91) * size * (0.85 + rnd() * 0.28),
            (upright ? 0.23 : 0.34) * size * (0.88 + rnd() * 0.2),
            (upright ? 0.49 : 0.24) * size,
            (upright ? -0.12 : 0.18) * size,
            seed + root * 131 + i * 17,
          );
          const leafColors = g.attributes.color;
          for (let vertex = 0; vertex < leafColors.count; vertex++) {
            const t = Math.floor(vertex / LEAF_COLUMNS) / LEAF_STEPS;
            const depth = 0.7 + THREE.MathUtils.smoothstep(t, 0.04, 0.55) * 0.33;
            leafColors.setXYZ(vertex, leafColors.getX(vertex) * depth, leafColors.getY(vertex) * depth, leafColors.getZ(vertex) * depth);
          }
          finishLeafNormals(g, LEAF_STEPS + 1, LEAF_COLUMNS);
          g.rotateX(upright ? -0.36 : (rnd() - 0.5) * 0.16);
          g.rotateY(a);
          g.translate(x, y + (upright ? 0.09 : 0.045), z);
          addLeafWind(g);
          leaves.push(g);
        }
      });
    } else {
      const turn = rnd() * TAU;
      for (let tier = 0; tier < 3; tier++) {
        const count = tier === 2 ? 6 : 8;
        for (let i = 0; i < count; i++) {
          const a = turn + (i / count) * TAU + tier * 0.38 + (rnd() - 0.5) * 0.2;
          const length = [0.91, 0.79, 0.56][tier] * (0.9 + rnd() * 0.28);
          const width = [0.35, 0.3, 0.24][tier] * (0.85 + rnd() * 0.3);
          const r = [0.14, 0.09, 0.04][tier];
          const g = makeLeaf(length, width, [0.25, 0.43, 0.58][tier] + rnd() * 0.08, [0.16, 0.07, -0.06][tier], seed + tier * 131 + i * 17);
          g.rotateX(-0.06 - tier * 0.1);
          g.rotateY(a);
          g.translate(Math.sin(a) * r, 0.045 + tier * 0.13, Math.cos(a) * r);
          addLeafWind(g);
          leaves.push(g);
        }
      }
    }
    const blooms = authored?.blooms ?? Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, i) => [(rnd() - 0.5) * 1.15, 0.67 + rnd() * 0.43, (rnd() - 0.5) * 1.15, 0.7 + rnd() * 0.72, i === 2 ? 2 : 0]);
    if (flowers) blooms.forEach(([x, y, z, size, form], i) => {
      if (form === 2) {
        // Closed buds break up the repeated open-flower silhouette.
        const bud = addColors(new THREE.SphereGeometry(1, 10, 8), "#d78368");
        bud.deleteAttribute("uv");
        bud.scale(0.105 * size, 0.19 * size, 0.1 * size);
        bud.rotateZ(-0.22);
        bud.translate(x, y + 0.04, z);
        petals.push(bud);
        return;
      }
      const turn = rnd() * TAU;
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * TAU + turn;
        const petalSeed = seed + i * 131 + j * 37;
        const petalRandom = random(petalSeed);
        const g = makePetal(
          (form === 1 ? 0.29 : 0.32) * size * (0.94 + petalRandom() * 0.13),
          (form === 1 ? 0.105 : 0.15) * size * (0.94 + petalRandom() * 0.14),
          (form === 1 ? 0.075 : 0.13) * size * (0.82 + petalRandom() * 0.3),
          form === 1 ? "#fff1cf" : i % 2 ? "#f0be95" : "#e6a482",
          petalSeed,
        );
        g.rotateY(a + (form === 1 ? 0.2 : 0));
        g.rotateX(-0.15 + i * 0.04);
        g.translate(x, y, z);
        petals.push(g);
      }
      const core = new THREE.SphereGeometry((form === 1 ? 0.066 : 0.067) * size, 10, 6);
      const coreColors = [], warm = new THREE.Color("#eab061"), pale = new THREE.Color("#fff0c4");
      const corePositions = core.attributes.position;
      for (let vertex = 0; vertex < corePositions.count; vertex++) {
        const height = corePositions.getY(vertex) / ((form === 1 ? 0.066 : 0.067) * size);
        const color = warm.clone().lerp(pale, THREE.MathUtils.smoothstep(height, -0.5, 0.85));
        coreColors.push(color.r, color.g, color.b);
      }
      core.setAttribute("color", new THREE.Float32BufferAttribute(coreColors, 3));
      core.scale(1, form === 1 ? 0.8 : 0.95, 1);
      core.translate(x, y + 0.055 * size, z);
      cores.push(core);
    });
    return { leaves: joined(leaves), petals: petals.length ? joined(petals) : null, cores: cores.length ? joined(cores) : null };
  }, [seed, flowers, composition]);
  useFoliageDisposal(geometries);
  return (
    <group ref={windRoot} position={position} scale={scale}>
      <mesh geometry={geometries.leaves} castShadow receiveShadow {...wind.leafMesh}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.74} onBeforeCompile={wind.leafShader} customProgramCacheKey={wind.leafKey} />
      </mesh>
      {geometries.petals && <mesh geometry={geometries.petals} castShadow receiveShadow {...wind.mesh}><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.84} onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} /></mesh>}
      {geometries.cores && <mesh geometry={geometries.cores} receiveShadow {...wind.mesh}><meshStandardMaterial vertexColors roughness={0.82} onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} /></mesh>}
    </group>
  );
}

function Broadleaf({ position, scale = 1, seed = 1 }) {
  const [wind, windRoot] = useIslandWind(3, 0.06, thinLeafLighting);
  const data = useMemo(() => {
    const rnd = random(seed),
      leaves = [],
      branches = [];
    for (let i = 0; i < 18; i++) {
      const a = rnd() * TAU,
        y = 1.5 + rnd() * 1.5,
        r = 0.1 + rnd() * 0.7;
      const g = makeLeaf(
        1 + rnd() * 0.5,
        0.38 + rnd() * 0.16,
        0.22,
        0.25,
        seed + i,
      );
      g.rotateX((rnd() - 0.6) * 0.7);
      g.rotateY(a);
      g.translate(Math.sin(a) * r, y, Math.cos(a) * r);
      addLeafWind(g);
      leaves.push(g);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU,
        curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.7, 0),
          new THREE.Vector3(Math.sin(a) * 0.3, 1.4, Math.cos(a) * 0.3),
          new THREE.Vector3(Math.sin(a) * 0.6, 2.2, Math.cos(a) * 0.6),
        ]);
      branches.push(new THREE.TubeGeometry(curve, 6, 0.04, 5, false));
    }
    return { leaves: joined(leaves), branches: joined(branches) };
  }, [seed]);
  useFoliageDisposal(data);
  return (
    <group ref={windRoot} position={position} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow {...wind.mesh}>
        <cylinderGeometry args={[0.09, 0.15, 2, 7]} />
        <meshStandardMaterial color="#746246" onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} />
      </mesh>
      <mesh geometry={data.branches} castShadow {...wind.mesh}>
        <meshStandardMaterial color="#716443" onBeforeCompile={wind.shader} customProgramCacheKey={wind.key} />
      </mesh>
      <mesh geometry={data.leaves} castShadow={seed % 3 === 2} receiveShadow {...wind.leafMesh}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.74}
          onBeforeCompile={wind.leafShader}
          customProgramCacheKey={wind.leafKey}
        />
      </mesh>
    </group>
  );
}

function Rope({ points }) {
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        16,
        0.018,
        5,
        false,
      ),
    [points],
  );
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#ddc493" />
    </mesh>
  );
}
function Lantern({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.19, 0.26, 0.19]} />
        <meshStandardMaterial
          color="#ffd77a"
          emissive="#ffbf47"
          emissiveIntensity={0.22}
        />
      </mesh>
      <mesh position={[0, 0.19, 0]} castShadow>
        <coneGeometry args={[0.19, 0.16, 4]} />
        <meshStandardMaterial color="#514a31" />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <boxGeometry args={[0.24, 0.045, 0.24]} />
        <meshStandardMaterial color="#514a31" />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 0.1, 0.025, z * 0.1]}>
            <boxGeometry args={[0.027, 0.29, 0.027]} />
            <meshStandardMaterial color="#514a31" />
          </mesh>
        )),
      )}
    </group>
  );
}

function harborTimberGeometry(width, height, depth, color, bevel = 0.012) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 1, bevel);
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (const group of geometry.groups) {
    for (let i = group.start; i < group.start + group.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const face = group.materialIndex;
      // Keep the former box's planar grain projection on every broad face.
      const u = face === 0 ? 0.5 - z / depth : face === 1 ? 0.5 + z / depth : face === 5 ? 0.5 - x / width : 0.5 + x / width;
      const v = face === 2 ? 0.5 - z / depth : face === 3 ? 0.5 + z / depth : 0.5 + y / height;
      uv.setXY(i, u, v);
    }
  }
  const base = new THREE.Color(color), colors = [];
  const normals = geometry.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    const up = normals.getY(i);
    // Distinguish the pale worn edge, broad upper face and darker sawn sides.
    const response = up > 0.94 ? 1 : up > 0.12 ? 1.13 : up < -0.94 ? 0.67 : 0.82;
    colors.push(base.r * response, base.g * response, base.b * response);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function Pier({ wood }) {
  const deck = useMemo(() => {
    const rnd = random(779);
    const planks = Array.from({ length: 26 }, (_, i) => {
      const pigment = new THREE.Color(i % 4 === 0 ? "#d1a567" : "#dbb77b").multiplyScalar(0.88 + rnd() * 0.25);
      const g = harborTimberGeometry(2.45 + Math.sin(i * 4.4) * 0.07, 0.13, 0.23, pigment);
      g.translate(0, 0.53, i * 0.25 - 0.15);
      return g;
    });
    // Short timber landing beds into the sand; it is part of the dock batch.
    for (let i = 0; i < 6; i++) {
      const z = -0.4 - i * 0.25;
      const xIsland = 7 - Math.sin(0.16) * z;
      const zIsland = 7.15 + Math.cos(0.16) * z;
      const y = Math.max(0.53, gateGround(xIsland, zIsland) + 0.09);
      const g = harborTimberGeometry(2.38 - i * 0.025, 0.14, 0.24, "#c5a574");
      g.translate(0, y, z); planks.push(g);
    }
    return joined(planks);
  }, []);
  return (
    <group position={[7, 0, 7.15]} rotation={[0, -0.16, 0]}>
      {/* The pier extends beyond the south shoreline. */}
      <mesh geometry={deck} receiveShadow castShadow>
        <meshStandardMaterial vertexColors map={wood} roughness={0.51} bumpMap={wood} bumpScale={0.018} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 0.96, 0.29, 3]} castShadow>
          <boxGeometry args={[0.16, 0.25, 6.7]} />
          <meshStandardMaterial color="#8d6237" roughness={0.82} />
        </mesh>
      ))}
      {[-1, 1].flatMap((side) =>
        [0, 2.2, 4.4, 6.2].map((z, i) => (
          <group key={`${side}${z}`} position={[side * 1.12, 0, z]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <cylinderGeometry args={[0.105, 0.12, 1.6, 8]} />
              <meshStandardMaterial color="#987348" map={wood} bumpMap={wood} bumpScale={0.012} roughness={0.76} />
            </mesh>
            <mesh position={[0, 1.21, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 0.07, 8]} />
              <meshStandardMaterial color="#c6a56b" roughness={0.63} />
            </mesh>
            {i % 2 === 0 && <Lantern position={[0, 1.45, 0]} />}
            <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.115, 0.035, 5, 10]} />
              <meshStandardMaterial color="#d8c293" />
            </mesh>
          </group>
        )),
      )}
      {[-1, 1].flatMap((side) =>
        [0, 2.2, 4.4].map((z, i) => (
          <Rope
            key={`${side}-${z}`}
            points={[
              [side * 1.12, 0.95, z],
              [side * 1.13, 0.77, z + (i === 2 ? 0.9 : 1.1)],
              [side * 1.12, 0.95, i === 2 ? 6.2 : z + 2.2],
            ]}
          />
        )),
      )}
      <mesh position={[0.6, 0.65, 5.75]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.29, 0.055, 6, 22]} />
        <meshStandardMaterial color="#dfc996" />
      </mesh>
      <mesh position={[-0.56, 0.66, 4.9]} rotation={[0, 0.12, 0]}>
        <boxGeometry args={[0.6, 0.16, 0.4]} />
        <meshStandardMaterial color="#448a79" />
      </mesh>
    </group>
  );
}

function BeachDetails() {
  const specs = useMemo(() => {
    const rnd = random(4492);
    return Array.from({ length: 31 }, (_, i) => {
      const a = rnd() * TAU,
        r = 0.69 + rnd() * 0.22;
      return {
        x: Math.cos(a) * r * 12,
        z: Math.sin(a) * r * 9,
        size: 0.08 + rnd() * 0.2,
        a: rnd() * TAU,
        kind: i % 3,
      };
    });
  }, []);
  return (
    <>
      {specs.map((s, i) => (
        <group key={i} position={[s.x, 0.2, s.z]} rotation={[0, s.a, 0]}>
          {s.kind === 0 ? (
            <mesh scale={[1.4, 0.6, 1]} castShadow>
              <icosahedronGeometry args={[s.size, 0]} />
              <meshStandardMaterial
                color={i % 2 ? "#a9a694" : "#dad3b8"}
                roughness={0.78}
                flatShading
                emissive="#b9b7ab"
                emissiveIntensity={0.025}
              />
            </mesh>
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0.3]} scale={[1, 0.7, 1]}>
              <sphereGeometry args={[s.size * 0.35, 8, 6, 0, Math.PI]} />
              <meshStandardMaterial color={i % 2 ? "#f7e4c4" : "#e8baa1"} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

// Closely spaced trees and rooted beds close both ends of the gate wall.
function GateGrove() {
  return [-1, 1].flatMap((side) => [0, 1, 2].map((i) => {
    const x = GATE.x + side * (8.45 + (i % 2) * 0.65);
    const z = GATE.z + Math.floor(i / 2) * 1.25 - 0.6;
    const y = gateTerrainHeight(x, z, 0.4);
    return <group key={`${side}-${i}`}>
      <Broadleaf position={[x, y, z]} scale={(side < 0 ? 1.16 : 0.78) + i * 0.06} seed={1640 + i * 77 + side} />
      <PlantBed position={[x, y, z]} scale={0.85} seed={2840 + i * 71 + side} flowers={false} />
      <mesh position={[x, y + 0.18, z]} scale={[0.83, 0.4, 0.68]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#b1bd9d" roughness={0.93} flatShading />
      </mesh>
    </group>;
  }));
}

export default function Island() {
  const sandProbe = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("sandProbe") : null;
  const sand = useMemo(() => makeSand(), []);
  const sandTextures = useMemo(() => makeIslandSandTextures(sandGroundingSites()), []);
  const beachWetting = useMemo(() => createBeachWetting(), []);
  useFrame(({ clock }) => beachWetting.advance(clock.elapsedTime));
  useEffect(() => () => beachWetting.dispose(), [beachWetting]);
  useEffect(() => () => Object.values(sandTextures).forEach(texture => texture.dispose()), [sandTextures]);
  const wood = useMemo(() => canvasTexture("wood"), []);
  const planting = useMemo(() => {
    const rnd = random(884);
    const list = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU,
        r = 0.43 + rnd() * 0.27,
        x = Math.cos(a) * r * 11,
        z = Math.sin(a) * r * 8;
      if (z < 0 && Math.abs(x) < 2.6) continue;
      if (Math.abs(z) < 2 && Math.abs(x) < 8.6) continue;
      if (z > -5 && z < 4 && x > -3 && x < 3.6) continue;
      // Leave the dock-to-gate approach as an open sandy clearing.
      if (z > 2.5 && x > -3.7) continue;
      list.push({
        position: [x, 0.43, z],
        scale: 0.6 + rnd() * 0.38,
        seed: i * 99 + 71,
        flowers: rnd() > 0.86,
      });
    }
    list.push(...AUTHORED_GARDENS);
    return list;
  }, []);
  return (
    <group position={[0, 0, CENTER_Z]}>
      <mesh geometry={sand} receiveShadow renderOrder={1}>
        <meshStandardMaterial
          vertexColors
          map={sandProbe === "color" ? null : sandTextures.color}
          bumpMap={sandProbe === "bump" ? null : sandTextures.relief}
          bumpScale={sandProbe === "bump" ? 0 : 0.055}
          roughnessMap={sandProbe === "roughness" ? null : sandTextures.roughness}
          roughness={1}
          transparent
          depthWrite
          emissive="#c8c6bd"
          emissiveIntensity={0.025}
          onBeforeCompile={beachWetting.apply}
          customProgramCacheKey={() => BEACH_WETTING_KEY}
        />
      </mesh>
      <MalaiVasal />
      <CoastalDetails />
      {/* Small trees frame the rear path without filling the central passage. */}
      {[[-3.2, -3.6, 0.85], [3.1, -5.8, 0.8]].map(([x, z, scale], i) =>
        <Broadleaf key={`path-tree-${i}`} position={[x, gateGround(x, z), z]} scale={scale} seed={5862 + i * 113} />)}
      <GateGrove />
      <Pier wood={wood} />
      <BeachDetails />
      {[
        [-8.55, 0.34, 2.3, 0.62, 0.35, 0.48],
        [-8.2, 0.32, 2.78, 0.37, 0.28, 0.32],
        [-7.65, 0.33, 2.47, 0.43, 0.3, 0.41],
        [8.3, 0.33, -2.8, 0.65, 0.48, 0.5],
        [7.8, 0.34, -2.25, 0.38, 0.32, 0.46],
        [-4.8, 0.45, -5.8, 0.65, 0.5, 0.54],
        [-2.65, 0.42, 3.45, 0.38, 0.26, 0.34],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh
          key={`rock${i}`}
          position={[x, gateTerrainHeight(x, z, y), z]}
          scale={[sx, sy, sz]}
          rotation={[0.12, i * 1.1, 0.05]}
          castShadow
          receiveShadow={i > 2}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={
              i % 3 === 0 ? "#c3c49d" : i % 3 === 1 ? "#a9b597" : "#d8cda8"
            }
            roughness={0.76}
            flatShading
            emissive="#bab8ad"
            emissiveIntensity={0.035}
          />
        </mesh>
      ))}
      {planting.map((p, i) => (
        <PlantBed key={i} {...p} position={[p.position[0], gateTerrainHeight(p.position[0], p.position[2], p.position[1]), p.position[2]]} />
      ))}
      {[
        [-9.0, 0.46, 0.9, 5.7, -0.7, 71],
        [9.0, 0.45, 0.6, 5.8, 0.85, 381],
        [-5.4, 0.46, -4.9, 5.9, 0.7, 171],
        [4.4, 0.4, -6.2, 5.2, 0.85, 493],
        [-7.4, 0.38, -3.3, 4.6, 1.0, 674],
        [7, 0.42, -4.9, 4.4, 0.8, 24],
        [-8.3, 0.4, 3.2, 4.2, -0.7, 102],
        [-4.5, 0.4, -6.8, 4.6, 0.7, 675],
      ].map(([x, y, z, h, l, s]) => (
        <Palm key={s} position={[x, gateTerrainHeight(x, z, y), z]} height={h} lean={l} seed={s} />
      ))}
      {[
        [-8.1, 0.37, -1.2, 0.72],
        [-5, 0.42, -4.8, 0.9],
        [-8.6, 0.45, -2.5, 0.8],
        [4.5, 0.42, -5.2, 0.95],
        [7.4, 0.39, -1.5, 0.7],
      ].map(([x, y, z, s], i) => (
        <Broadleaf key={i} position={[x, gateTerrainHeight(x, z, y), z]} scale={s} seed={218 + i * 44} />
      ))}
    </group>
  );
}
