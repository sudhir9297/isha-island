import { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  Object3D,
  LatheGeometry,
  Vector2,
  SphereGeometry,
  CircleGeometry,
  TorusGeometry,
  CylinderGeometry,
  Vector3,
  Vector4,
  CanvasTexture,
  RepeatWrapping,
  DoubleSide,
  ShaderChunk,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SEABED_Y } from "./WorldConfig.js";
import {
  seabedHeightAt, createReefHeightField, createSeabedFieldTexture,
  createSeabedMaterialTexture, SEABED_GRID, SEABED_GLSL, SEABED_MAX_Y,
  COAST_SAND_ALBEDO,
} from "./Seabed.js";

function random(seed) {
  let n = seed;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function coralVertexTones(geometry, tone) {
  const positions = geometry.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) colors.push(...tone(positions.getX(i), positions.getY(i), positions.getZ(i)));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}
function reefStoneGeometry() {
  const positions = [0.1, 1, -0.08], colors = [1.22, 1.18, 1.1], indices = [];
  const segments = 16;
  // Rounded shoulders break the descent into short rubble terraces. Warm silt
  // lightens the lower stones where they meet the floor. The buried foot is opaque.
  const rings = [
    [0.46, 0.85, [1.18, 1.15, 1.08]],
    [0.75, 0.59, [1.12, 1.09, 1.01]],
    [0.94, 0.43, [1.28, 1.16, 1.04]],
    [1.12, 0.21, [1.65, 1.3, 1.07]],
    [1.25, 0.075, [2.1, 1.45, 1.09]],
    [1.3, -0.035, [2.5, 1.6, 1.1]],
  ];
  rings.forEach(([radius, height, tone], ring) => {
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const outline = 1 + Math.sin(angle * 3 + 0.4) * 0.11 + Math.cos(angle * 5 - 0.3) * 0.07
        + (ring > 1 ? Math.sin(angle * 7 + ring * 0.8) * 0.035 : 0);
      const terrace = ring === rings.length - 1 ? 0 : Math.sin(angle * 3 + 0.5) * (ring < 2 ? 0.065 : 0.025)
        + (ring > 1 ? Math.cos(angle * 6 - ring) * 0.017 : 0);
      positions.push(Math.cos(angle) * radius * outline + (1 - radius) * 0.1,
        height + terrace,
        Math.sin(angle) * radius * outline - (1 - radius) * 0.08);
      const facet = 0.96 + Math.cos(angle * 5 + ring) * 0.04;
      colors.push(tone[0] * facet, tone[1] * facet, tone[2] * facet);
    }
  });
  for (let i = 0; i < segments; i++) {
    const a = 1 + i, b = 1 + (i + 1) % segments;
    indices.push(0, b, a);
    for (let ring = 0; ring < rings.length - 1; ring++) {
      const c = a + ring * segments, d = b + ring * segments;
      indices.push(c, d, c + segments, d, d + segments, c + segments);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  // Shared normals across adjacent facets keep the shoulder rounded; the actual
  // triangle positions remain available for precise coral-root attachment.
  geometry.computeVertexNormals();
  const triangles = geometry.toNonIndexed();
  geometry.dispose();
  return triangles;
}

function rockSurfaceAt(geometry, rock, x, z) {
  const dx = x - rock.position[0], dz = z - rock.position[2];
  const angle = rock.angle || 0, c = Math.cos(angle), s = Math.sin(angle);
  const px = (dx * c - dz * s) / rock.scale[0];
  const pz = (dx * s + dz * c) / rock.scale[2];
  if (Math.hypot(px, pz) > 1.7) return -Infinity;
  const p = geometry.attributes.position;
  let highest = -Infinity;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1), cx = p.getX(i + 2), cz = p.getZ(i + 2);
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-8) continue;
    const a = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / denominator;
    const b = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / denominator;
    const third = 1 - a - b;
    if (a >= -1e-5 && b >= -1e-5 && third >= -1e-5) {
      highest = Math.max(highest, rock.position[1] + (a * p.getY(i) + b * p.getY(i + 1) + third * p.getY(i + 2)) * rock.scale[1]);
    }
  }
  return highest;
}

function trueInstanceTop(geometry, d) {
  const p = geometry.attributes.position, tilt = d.tilt || 0;
  const sin = Math.sin(tilt), cos = Math.cos(tilt);
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) top = Math.max(top, d.position[1] + p.getX(i) * d.scale[0] * sin + p.getY(i) * d.scale[1] * cos);
  return top;
}

function contactTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const fade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.35, "rgba(255,255,255,.68)");
  fade.addColorStop(0.72, "rgba(255,255,255,.2)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}
function rosetteGeometry() {
  const positions = [], colors = [], indices = [];
  const sides = 48, rings = 7;
  // Each shelf has a curled rim and a thin hanging edge, visible from above.
  for (let layer = 0; layer < 5; layer++) {
    const base = positions.length / 3;
    const radius = 0.72 - layer * 0.115;
    for (let ring = 0; ring <= rings + 1; ring++) {
      const t = Math.min(ring / rings, 1);
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2;
        const ripple = Math.sin(a * 8 + layer * 0.8) * 0.065 + Math.sin(a * 15) * 0.025;
        const rad = radius * t * (1 + ripple);
        const edge = ring === rings + 1;
        positions.push(
          Math.cos(a) * rad,
          layer * 0.13 + 0.065 * t * t + ripple * t * t - (edge ? 0.045 : 0),
          Math.sin(a) * rad,
        );
        const light = edge ? 0.73 : 0.9 + Math.pow(t, 4) * 0.1;
        const upper = layer / 4;
        const pleat = 0.96 + Math.sin(a * 8 + layer * 0.8) * 0.04;
        colors.push(light * (0.77 + upper * 0.23) * pleat, light * (1.09 - upper * 0.03), light * (1.19 - upper * 0.15) * pleat);
      }
    }
    for (let ring = 0; ring <= rings; ring++) {
      for (let j = 0; j < sides; j++) {
        const a = base + ring * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function mergeParts(parts) {
  const g = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return g;
}
function bulbCoralGeometry() {
  const parts = [], r = random(82);
  // Dense, rounded fingers form a low yellow head, with gaps between its lobes.
  for (let i = 0; i < 27; i++) {
    const a = i * 2.39996, radius = 0.48 * Math.sqrt(i / 27);
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = 0.27 + (1 - radius / 0.65) * 0.25 + r() * 0.07;
    const lobe = new SphereGeometry(1, 9, 7);
    const variation = 0.93 + (i % 7) * 0.02;
    coralVertexTones(lobe, (px, py, pz) => {
      const top = (py + 1) * 0.5;
      const grain = variation + Math.sin(px * 8 + pz * 6 + i) * 0.035;
      return [grain * (0.74 + top * 0.3), grain * (0.96 + top * 0.08), grain * (1.13 - top * 0.27)];
    });
    lobe.scale(0.11 + r() * 0.025, h, 0.115 + r() * 0.03);
    lobe.rotateZ(-x * 0.5);
    lobe.rotateX(z * 0.5);
    lobe.translate(x, h * 0.69, z);
    parts.push(lobe);
  }
  return mergeParts(parts);
}
function petalCoralGeometry() {
  const positions = [], indices = [], colors = [], r = random(155);
  const rows = 10, columns = 5;
  for (let leaf = 0; leaf < 7; leaf++) {
    const angle = (leaf - 3) * 0.31, height = 0.7 + r() * 0.23;
    const width = 0.17 + r() * 0.055, depth = (leaf % 3 - 1) * 0.13;
    const base = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const t = row / rows, spread = Math.pow(Math.sin(t * Math.PI), 0.75);
      for (let column = 0; column < columns; column++) {
        const cross = (column - 2) / 2;
        const roundedFold = 1 - cross * cross;
        const x = cross * width * spread + Math.sin(t * Math.PI) * (leaf % 2 ? 0.035 : -0.035);
        const y = height * t;
        // A broad rounded fold and even curl give a soft upper plane without a thin bright ridge.
        const z = depth * t - t * t * 0.35 + roundedFold * 0.045 * spread;
        positions.push(x * Math.cos(angle) + y * Math.sin(angle), y * Math.cos(angle) - x * Math.sin(angle), z);
        const shade = (0.94 + roundedFold * 0.06) * (0.8 + Math.pow(t, 0.7) * 0.23);
        colors.push(shade * (0.8 + t * 0.2), shade * (0.92 + t * 0.1), shade * (1.02 - t * 0.03));
      }
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns - 1; column++) {
      const a = base + row * columns + column, b = a + columns;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function branchingCoralGeometry() {
  const parts = [], r = random(908), up = new Vector3(0, 1, 0);
  const segment = (start, end, width, taper) => {
    const g = new CylinderGeometry(width * taper, width, start.distanceTo(end), 7);
    const o = new Object3D();
    o.position.copy(start).lerp(end, 0.5);
    o.quaternion.setFromUnitVectors(up, end.clone().sub(start).normalize());
    o.updateMatrix();
    g.applyMatrix4(o.matrix);
    parts.push(g);
  };
  for (let stem = 0; stem < 8; stem++) {
    const a = stem * 2.39996;
    const root = new Vector3(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    const knee = new Vector3(Math.cos(a) * 0.25, 0.35 + r() * 0.12, Math.sin(a) * 0.25);
    const end = new Vector3(Math.cos(a) * 0.4, 0.75 + r() * 0.25, Math.sin(a) * 0.4);
    segment(root, knee, 0.06, 0.72);
    segment(knee, end, 0.043, 0.48);
    for (let fork = 0; fork < 2; fork++) {
      const join = knee.clone().lerp(end, 0.3 + fork * 0.26);
      const tip = join.clone().add(new Vector3(Math.cos(a + (fork ? 1.2 : -1.2)) * 0.2, 0.22 + r() * 0.14, Math.sin(a + (fork ? 1.2 : -1.2)) * 0.2));
      segment(join, tip, 0.027, 0.4);
    }
  }
  return coralVertexTones(mergeParts(parts), (x, y, z) => {
    const top = Math.min(1, Math.max(0, y));
    const stripe = 0.96 + Math.sin(Math.atan2(z, x) * 5 + y * 8) * 0.04;
    return [stripe * (0.76 + top * 0.27), stripe * (1.08 - top * 0.06), stripe * (1.18 - top * 0.3)];
  });
}
function foldedCupGeometry() {
  const positions = [], colors = [], indices = [], sides = 40, rings = 8;
  for (let wall = 0; wall < 2; wall++) {
    for (let row = 0; row <= rings; row++) {
      const t = row / rings;
      for (let side = 0; side <= sides; side++) {
        const a = side / sides * Math.PI * 2;
        const folds = Math.sin(a * 9) * 0.065 + Math.sin(a * 15) * 0.02;
        const lipWidth = 0.026 + Math.pow(t, 7) * 0.035;
        const radius = 0.09 + Math.pow(t, 1.8) * 0.35 + folds * t - wall * lipWidth;
        positions.push(Math.cos(a) * radius, (t * 0.65 + Math.sin(a * 9) * 0.035 * t * t - wall * Math.pow(t, 4) * 0.022) * 0.72, Math.sin(a) * radius);
        const ridge = Math.sin(a * 9) * 0.065 * Math.sqrt(t);
        const shade = (wall ? 0.72 + Math.pow(t, 1.5) * 0.4 : 0.84 + Math.pow(t, 3) * 0.22) + ridge;
        colors.push(shade * (0.73 + t * 0.27), shade * (1.12 - t * 0.085), shade * (1.19 - t * 0.19));
      }
    }
  }
  const stride = sides + 1, wallSize = stride * (rings + 1);
  for (let wall = 0; wall < 2; wall++) for (let row = 0; row < rings; row++) for (let side = 0; side < sides; side++) {
    const a = wall * wallSize + row * stride + side, b = a + stride;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  for (let side = 0; side < sides; side++) {
    const a = rings * stride + side, b = a + wallSize;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function ridgedBrainGeometry() {
  const g = new SphereGeometry(1, 32, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), b = Math.acos(Math.max(-1, Math.min(1, y)));
    const ridge = 1 + Math.sin(a * 15 + Math.sin(b * 5) * 1.8) * 0.055 * Math.sin(b) + Math.cos(b * 17 + Math.sin(a * 4)) * 0.035;
    p.setXYZ(i, x * ridge, y * ridge, z * ridge);
  }
  g.computeVertexNormals();
  return coralVertexTones(g, (x, y, z) => {
    const a = Math.atan2(z, x), b = Math.acos(Math.max(-1, Math.min(1, y)));
    const grain = 0.92 + Math.sin(a * 15 + Math.sin(b * 5) * 1.8) * 0.1;
    const top = (y + 1) * 0.5;
    return [grain * (0.82 + top * 0.2), grain, grain * (1.1 - top * 0.19)];
  });
}
function spongeGeometry() {
  const profile = [
    [0.12, 0], [0.17, 0.1], [0.135, 0.62], [0.185, 0.95],
    [0.18, 1.02], [0.11, 1.03], [0.085, 0.96], [0.075, 0.62],
    [0.07, 0.2], [0.12, 0],
  ].map(([x, y]) => new Vector2(x, y));
  const g = new LatheGeometry(profile, 24), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const flute = 1 + Math.sin(a * 10 + y * 3) * 0.026;
    p.setXYZ(i, x * flute, y, z * flute);
  }
  g.computeVertexNormals();
  return coralVertexTones(g, (x, y, z) => {
    const top = Math.min(1, Math.max(0, y / 1.03));
    const a = Math.atan2(z, x), radius = Math.hypot(x, z);
    const cavity = radius < 0.105 && y > 0.18 ? 0.73 + top * 0.18 : 1;
    const grain = (0.94 + Math.sin(a * 7 + y * 5) * 0.06) * cavity;
    return [grain * (0.8 + top * 0.25), grain * (1.26 - top * 0.2), grain * (1.18 - top * 0.23)];
  });
}
function capGeometry() {
  const stem = coralVertexTones(new SphereGeometry(1, 10, 7), (x, y) => {
    const top = (y + 1) * 0.5;
    return [0.8 + top * 0.12, 1.14 - top * 0.12, 1.15 - top * 0.05];
  });
  stem.scale(0.12, 0.27, 0.12);
  stem.translate(0, 0.23, 0);
  const cap = coralVertexTones(new SphereGeometry(1, 24, 12), (x, y, z) => {
    const top = (y + 1) * 0.5;
    const grain = 0.94 + Math.sin(Math.atan2(z, x) * 7 + y * 11) * 0.06;
    return [grain * (0.83 + top * 0.2), grain * (0.97 + top * 0.1), grain * (1.13 - top * 0.08)];
  });
  cap.scale(0.56, 0.14, 0.49);
  cap.translate(0, 0.47, 0);
  return mergeParts([stem, cap]);
}
function capDotsGeometry() {
  const parts = [];
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39996, rad = 0.88 * Math.sqrt((i + 0.5) / 20);
    const dot = new SphereGeometry(1, 6, 4);
    dot.scale(0.031, 0.015, 0.031);
    dot.translate(Math.cos(a) * rad * 0.56, 0.47 + Math.sqrt(1 - rad * rad) * 0.14, Math.sin(a) * rad * 0.49);
    parts.push(dot);
  }
  return mergeParts(parts);
}
function bladeGeometry() {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -0.055, 0, 0, 0.055, 0, 0, -0.04, 0.3, 0.035, 0.04, 0.3, 0.035, -0.02,
        0.6, 0.11, 0.02, 0.6, 0.11, 0, 0.9, 0.22,
      ],
      3,
    ),
  );
  g.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 4, 6, 5]);
  g.computeVertexNormals();
  return g;
}
function starGeometry() {
  const p = [0, 0.08, 0],
    ix = [];
  for (let i = 0; i < 10; i++) {
    let a = (i / 10) * 6.28,
      rad = i % 2 ? 0.18 : 0.58;
    p.push(Math.cos(a) * rad, 0.01, Math.sin(a) * rad);
  }
  for (let i = 0; i < 10; i++) ix.push(0, i + 1, ((i + 1) % 10) + 1);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
function brainTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#dedede";
  ctx.lineWidth = 4;
  for (let x = -20; x < 280; x += 14) {
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 2) {
      const dx = x + Math.sin(y * 0.075 + x) * 6 + Math.sin(y * 0.033 + x) * 4;
      if (y === 0) ctx.moveTo(dx, y);
      else ctx.lineTo(dx, y);
    }
    ctx.stroke();
  }
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}
// Preserve each species' color in shaded folds instead of applying one blue glow.
function tintCoralFill(shader) {
  shader.vertexShader = "varying float reefWaterDepth;\n" + shader.vertexShader.replace(
    "#include <project_vertex>",
    `#include <project_vertex>
    vec4 reefWorld = vec4(transformed, 1.);
    #ifdef USE_INSTANCING
      reefWorld = instanceMatrix * reefWorld;
    #endif
    reefWaterDepth = max(0., -.08 - (modelMatrix * reefWorld).y);`,
  );
  shader.fragmentShader = "varying float reefWaterDepth;\n" + shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
      totalEmissiveRadiance *= vColor.rgb;
    #endif`,
  ).replace(
    "#include <lights_fragment_begin>",
    "float reefShadowSpread = 1. + min(reefWaterDepth, 2.4) * .55;\n" + ShaderChunk.lights_fragment_begin.replaceAll(
      "directionalLightShadow.shadowRadius", "(directionalLightShadow.shadowRadius * reefShadowSpread)",
    ),
  );
}

// Stones share the actual sediment material at their contact, rather than
// carrying a cyan water tint in their albedo before Ocean applies immersion.
function reefStoneMaterialField() {
  const field = createSeabedFieldTexture(), material = createSeabedMaterialTexture();
  return {
    uniforms: {
      uSeabedField: { value: field }, uSeabedMaterial: { value: material },
      uSeabedGrid: { value: new Vector4(SEABED_GRID.x, SEABED_GRID.z, SEABED_GRID.step, SEABED_Y) },
      uSeabedSize: { value: new Vector2(SEABED_GRID.columns, SEABED_GRID.rows) },
      uSeabedMaxHeight: { value: SEABED_MAX_Y },
      uStoneSand: { value: new Color().fromArray(COAST_SAND_ALBEDO) },
    },
    dispose() { field.dispose(); material.dispose(); },
  };
}
function tintReefStone(shader, field) {
  tintCoralFill(shader);
  Object.assign(shader.uniforms, field.uniforms);
  shader.vertexShader = "varying vec3 reefStoneWorld;\n" + shader.vertexShader.replace(
    "reefWaterDepth = max(0., -.08 - (modelMatrix * reefWorld).y);",
    "reefStoneWorld = (modelMatrix * reefWorld).xyz;\n    reefWaterDepth = max(0., -.08 - reefStoneWorld.y);",
  );
  shader.fragmentShader = `varying vec3 reefStoneWorld;
    uniform vec3 uStoneSand;
    ${SEABED_GLSL}
    float stoneHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float stoneNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(stoneHash(i),stoneHash(i+vec2(1.,0.)),f.x),
        mix(stoneHash(i+vec2(0.,1.)),stoneHash(i+vec2(1.,1.)),f.x),f.y);
    }
    ` + shader.fragmentShader.replace(
    "#include <color_fragment>",
    `#include <color_fragment>
    float stoneGrain=stoneNoise(reefStoneWorld.xz*1.8)*.65+stoneNoise(reefStoneWorld.xz*4.6)*.35;
    vec3 mineral=mix(vec3(.23,.27,.23),vec3(.34,.35,.27),stoneGrain);
    vec3 silt=mix(vec3(.18,.24,.20),vec3(.29,.33,.245),stoneGrain);
    vec3 sand=uStoneSand*(.97+.06*stoneGrain);
    vec3 sediment=mix(sand,silt,seabedSiltWeight(reefStoneWorld.xz));
    float exposure=max(0.,reefStoneWorld.y-seabedHeight(reefStoneWorld.xz));
    float contact=1.-smoothstep(.025,.24,exposure);
    diffuseColor.rgb=mix(mineral,sediment,contact);`,
  );
}

const CORAL_ROUGHNESS = {
  rock: 0.94,
  cap: 0.66, cup: 0.78, sponge: 0.72, spongeLip: 0.55,
  brain: 0.9, rosette: 0.82, bulb: 0.86, branch: 0.8, fan: 0.9,
};
// Small species-colored fill keeps shaded bodies legible; contact patches remain unlit.
const CORAL_FILL = {
  rock: 0, sponge: 0.085, cup: 0.105, branch: 0.09,
  brain: 0.065, cap: 0.055, bulb: 0.055, rosette: 0.07, fan: 0.12,
};
const CORAL_SHADOW_CASTERS = new Set(["cap", "brain", "bulb", "sponge", "cup", "branch"]);

function Instances({ geometry, data, roughness = 1, bumpMap, opacity = 1, map, castShadows = false, fill = 0.04, stoneField }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const o = new Object3D();
    data.forEach((d, i) => {
      o.position.set(...d.position);
      o.scale.set(...d.scale);
      o.rotation.set(0, d.angle || 0, d.tilt || 0);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(i, new Color(d.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    // Instance transforms span the whole shore. Refresh bounds after every layout update.
    ref.current.computeBoundingSphere();
    ref.current.computeBoundingBox();
  }, [data, geometry]);
  return (
    <instancedMesh ref={ref} args={[geometry, null, data.length]} castShadow={castShadows} receiveShadow={!map} renderOrder={map ? 1 : 0}>
      <meshStandardMaterial
        roughness={roughness}
        emissive="#ffffff"
        emissiveIntensity={map ? 0 : fill}
        onBeforeCompile={stoneField ? (shader) => tintReefStone(shader, stoneField) : tintCoralFill}
        customProgramCacheKey={() => stoneField ? "reef-stone-sediment-v1" : "reef-coral-fill-v1"}
        transparent={opacity < 1}
        opacity={opacity}
        map={map}
        alphaTest={map ? 0.01 : geometry.attributes.color?.itemSize === 4 ? 0.02 : 0}
        vertexColors={Boolean(geometry.attributes.color)}
        side={DoubleSide}
        bumpMap={bumpMap}
        bumpScale={bumpMap ? 0.065 : 0}
      />
    </instancedMesh>
  );
}
export default function Reef({ onTerrainReady }) {
  const assets = useMemo(() => ({
    rock: reefStoneGeometry(),
    stoneField: reefStoneMaterialField(),
    contact: new CircleGeometry(1, 24).rotateX(-Math.PI / 2),
    contactMap: contactTexture(),
    rosette: rosetteGeometry(),
    bulb: bulbCoralGeometry(),
    fan: petalCoralGeometry(),
    branch: branchingCoralGeometry(),
    cup: foldedCupGeometry(),
    sponge: spongeGeometry(),
    spongeLip: new TorusGeometry(0.148, 0.022, 5, 16).rotateX(Math.PI / 2).translate(0, 1.015, 0),
    cap: capGeometry(),
    capDots: capDotsGeometry(),
    brain: ridgedBrainGeometry(),
    grass: bladeGeometry(),
    star: starGeometry(),
    bump: brainTexture(),
  }), []);
  const layout = useMemo(() => {
    const r = random(42);
    const data = Object.fromEntries(["rock", "contact", "rosette", "bulb", "fan", "branch", "cup", "sponge", "spongeLip", "cap", "capDots", "brain", "grass", "star"].map((type) => [type, []]));
    const palette = {
      rosette: ["#3ebfa6", "#56c1a0", "#30a7ab"],
      bulb: ["#e5d586", "#d4d58b", "#d7c776"],
      fan: ["#dc90b2", "#c68daf", "#e4a6b8"],
      branch: ["#78b49d", "#d9c690", "#8293b3"],
      cup: ["#6488a9", "#639eac", "#a67aa4"],
      sponge: ["#7971b8", "#667fb8", "#419fba"],
      cap: ["#ad75a4", "#a16c9f", "#b67da9"],
      brain: ["#c5b98b", "#b5b78b", "#bb9f98"],
    };
    const shallowPalette = {
      rosette: ["#3ac9b0", "#57cda8", "#39bbc1"],
      bulb: ["#f2df89", "#e8db88", "#edcf7f"],
      fan: ["#ee87b8", "#d37cb9", "#f1a2bc"],
      branch: ["#88c8a8", "#edd39a", "#8e94c4"],
      cup: ["#78a0c4", "#80bfc0", "#c683b8"],
      sponge: ["#7a68c4", "#667dca", "#439bbd"],
      cap: ["#bb7fbd", "#bd77b3", "#cd8bc0"],
      brain: ["#c9b494", "#c1b393", "#c49ca7"],
    };
    const add = (type, x, z, size = 1, y = -1.92, deep = false, surfaceCeiling = -0.2) => {
      const colors = y > -1.8 && !deep ? shallowPalette[type] : palette[type];
      if (type === "cap") size *= 0.8;
      const rootY = y + r() * 0.06;
      const d = {
        position: [x, rootY, z],
        scale: [size, Math.min(size * (type === "sponge" ? 0.8 + r() * 0.65 : type === "fan" ? 0.95 : type === "rosette" ? 0.9 : 1), (surfaceCeiling - rootY) / (type === "branch" ? 1.15 : type === "sponge" ? 1.035 : type === "fan" ? 0.95 : type === "cup" ? 0.7 : type === "cap" ? 0.65 : 1)), size],
        angle: r() * Math.PI * 2,
        color: deep ? (type === "fan" || type === "sponge" ? "#1a5367" : "#225f69") : colors[Math.floor(r() * colors.length)],
      };
      data[type].push(d);
      if (type === "cap") data.capDots.push({ ...d, color: deep ? "#346d77" : y > -1.8 ? "#efd0df" : "#d9b7cf" });
      if (type === "sponge" && y > -1.8 && !deep) data.spongeLip.push({ ...d, color: r() > 0.6 ? "#d6dc8e" : "#85d4cf" });
    };
    const grassTuft = (x, z, size = 1, y = -2.04, deep = false) => {
      for (let k = 0; k < 5; k++) data.grass.push({
        position: [x + (r() - 0.5) * 0.16, y, z + (r() - 0.5) * 0.16],
        scale: [0.48 + r() * 0.4, size * (0.58 + r() * 0.45), 0.7],
        angle: r() * Math.PI * 2,
        tilt: (r() - 0.5) * 0.45,
        color: deep ? "#297b80" : r() > 0.5 ? "#48ad9a" : "#419f94",
      });
    };
    const garden = (x, z, size, index, hero = false) => {
      const y = hero ? [-1.82, -1.5, -1.08][index % 3] : -2.05;
      const surfaceCeiling = hero ? [-0.65, -0.4, -0.2][index % 3] : -0.2;
      if (hero) {
        // Interlocking pieces make a recognizable garden, with cracks and open edges.
        const stones = index === 0
          ? [[-0.7, 0.1, 0.78, 0.65], [0.65, 0.26, 0.73, 0.66], [0.18, -0.76, 0.66, 0.5]]
          : [[-0.58, 0.12, 0.96, 0.71], [0.57, 0.22, 0.83, 0.78], [0.12, -0.64, 0.79, 0.57]];
        for (let j = 0; j < stones.length; j++) {
          const [dx, dz, sx, sz] = stones[j];
          const vertical = [0.72, 0.63, 0.68][j];
          const crest = [0.18, 0.25, 0.11][j];
          data.rock.push({
            position: [x + dx * size, y + crest - vertical, z + dz * size],
            scale: [sx * size, vertical, sz * size], angle: index * 0.6 + j * 1.5,
            color: index === 0 ? (j === 1 ? "#548a7a" : "#448180") : j === 1 ? "#4b8274" : "#43817d",
          });
          data.contact.push({
            position: [x + dx * size, y - 0.83, z + dz * size],
            scale: [sx * size * 0.78, 1, sz * size * 0.76],
            angle: index * 0.6 + j * 1.5, color: "#1c6170",
          });
        }
      }
      // Motifs emphasize different heights instead of repeating a uniform circular mix.
      const motifs = [
        [["sponge", -0.9, 0.1, 0.67], ["sponge", 0.3, -0.72, 0.46], ["cap", -0.9, -0.56, 0.72], ["fan", 0.84, -0.48, 0.82], ["bulb", 1.0, 0.45, 0.73], ["rosette", 0.22, 0.75, 0.46], ["branch", 0.47, 0.16, 0.77], ["fan", -1.15, 0.62, 0.5], ["rosette", -0.44, -1.12, 0.4], ["bulb", 0.75, -1.08, 0.43], ["cup", -0.26, 0.12, 0.65]],
        [["fan", -0.93, -0.35, 0.94], ["sponge", -0.27, 0.38, 0.77], ["sponge", 0.7, -0.45, 0.42], ["bulb", 0.93, 0.47, 0.7], ["cap", -0.81, 0.73, 0.64], ["rosette", 0.18, -0.75, 0.42], ["brain", 0.39, 0.22, 0.7], ["fan", 1.14, -0.94, 0.57], ["rosette", -1.35, 0.16, 0.38], ["cup", 0.77, 1.0, 0.56]],
        [["rosette", -0.88, 0.28, 0.49], ["fan", -0.45, -0.67, 0.86], ["sponge", 0.4, 0.48, 0.61], ["cap", 0.47, -0.28, 0.75], ["bulb", 1.02, -0.61, 0.66], ["cup", -0.25, 0.62, 0.63], ["sponge", -1.3, -0.23, 0.4], ["fan", 0.95, 0.84, 0.46], ["bulb", -0.86, -1.14, 0.38], ["rosette", 1.25, 0.2, 0.4]],
      ];
      const shoulder = [
        ["rosette", -1.26, 0.75, 0.36], ["bulb", 0.35, -1.12, 0.46],
        ["fan", 0.93, -0.02, 0.58], ["branch", -1.05, -0.15, 0.59],
        ["sponge", 1.18, 0.2, 0.47], ["rosette", -0.24, 1.0, 0.33],
        ["fan", -0.05, 0.2, 0.54],
      ];
      const motif = [...motifs[index % 3], ...shoulder], count = hero ? motif.length : 5 + index % 3;
      for (let j = 0; j < count; j++) {
        const a = j * 2.39996 + index * 0.9;
        const radius = Math.sqrt((j + 0.4) / count);
        const type = hero ? motif[j][0] : ["rosette", "bulb", "fan", "sponge", "cap", "brain"][(j + index) % 6];
        const cx = x + (hero ? motif[j][1] : Math.cos(a) * radius * 1.55) * size;
        const cz = z + (hero ? motif[j][2] : Math.sin(a) * radius * 1.15) * size;
        const s = size * (hero ? motif[j][3] : 0.36 + r() * 0.28);
        if (!hero && type !== "rosette") {
          const rad = s * (type === "sponge" ? 0.78 : type === "bulb" ? 0.64 : 0.45);
          data.rock.push({ position: [cx, y - 0.3, cz], scale: [rad, 0.55, rad * 0.8], angle: a, color: "#3a7978" });
          data.contact.push({ position: [cx, y - 0.78, cz], scale: [rad * 0.78, 1, rad * 0.76], angle: a, color: "#1f6773" });
        }
        if (type === "sponge") {
          for (let k = 0; k < (hero ? 4 : 2); k++) add(type, cx + (r() - 0.5) * size * 0.38, cz + (r() - 0.5) * size * 0.34, s * (0.62 + r() * 0.45), y, false, surfaceCeiling);
        } else if (type === "brain") {
          data.brain.push({ position: [cx, y + s * 0.28, cz], scale: [s * 0.34, s * 0.39, s * 0.34], angle: a, color: (hero ? shallowPalette : palette).brain[index % 3] });
        } else add(type, cx, cz, s, y, false, surfaceCeiling);
      }
      if (hero) {
        // A low tangled seam crosses the exposed stones and binds the taller families together.
        for (let j = 0; j < 9; j++) {
          const dx = -1.0 + j * 0.24, dz = Math.sin(j * 0.88 + index) * 0.25;
          grassTuft(x + dx * size, z + dz * size, size * (0.42 + r() * 0.2), y - 0.1);
          if (j % 3 === 0) add("branch", x + dx * size, z + dz * size, size * 0.28, y);
        }
      }
      for (let j = 0; j < (hero ? 17 : 5); j++) {
        const a = r() * Math.PI * 2, radius = 0.7 + r() * 1.15;
        grassTuft(x + Math.cos(a) * size * radius, z + Math.sin(a) * size * radius * 0.8, size * (hero ? 0.95 : 0.65), y - 0.15);
      }
    };
    // Three focal gardens on the west/south shore, with open sailing water between them.
    [[-19, -13.5, 1.72], [-15.6, -6.3, 1.62], [-10, -1.9, 1.66]].forEach(([x, z, size], i) => garden(x, z, size, i, true));
    // Smaller knots elsewhere never compete with the foreground gardens.
    [[-13, -23, 0.58], [-7, -24, 0.7], [0, -25, 0.56], [10, -23, 0.64], [16, -16, 0.77], [15, -7, 0.59], [8, 0.4, 0.63], [-3, 1.5, 0.5]].forEach(([x, z, size], i) => garden(x, z, size, i + 3));
    // Small individual colonies and paired tubes connect the garden edges.
    for (let i = 0; i < 76; i++) {
      const a = r() * Math.PI * 2, d = 1.15 + r() * 0.68;
      const x = Math.cos(a) * 12 * d, z = -12 + Math.sin(a) * 9 * d;
      const type = ["rosette", "sponge", "bulb", "fan"][i % 4];
      add(type, x, z, 0.18 + r() * 0.18, -2.0);
      if (i % 4 === 1) add(type, x + 0.15, z - 0.05, 0.18 + r() * 0.17, -2.0);
      if (i % 3 === 0) grassTuft(x + 0.35, z, 0.65);
    }
    // Deep water carries only a few subdued low shelf silhouettes, never repeated tube bouquets.
    [[-27, -4, 0.62], [-24, -20, 0.73], [-20, 10, 0.63], [-4, 14, 0.55], [24, -4, 0.7], [21, -28, 0.67]].forEach(([x, z, size], i) => {
      for (let j = 0; j < 2; j++) {
        data.rosette.push({
          position: [x + j * size * 0.8, SEABED_Y + 0.005, z + j * size * 0.27],
          scale: [size, size * 0.3, size * 0.88], angle: i * 0.9 + j,
          color: j ? "#226a76" : "#246b73",
        });
      }
    });
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2;
      data.star.push({ position: [Math.cos(a) * 16, -2.2, -12 + Math.sin(a) * 13], scale: [0.45, 0.45, 0.45], angle: r() * 6.28, color: "#bdac72" });
    }
    // Sediment carries the garden's elevation. Rocks retain their authored crowns
    // and expose only their upper shoulders above the actual irregular floor.
    const anchorRock = (rock, crown) => {
      const p = assets.rock.attributes.position, c = Math.cos(rock.angle), s = Math.sin(rock.angle);
      let foot = seabedHeightAt(rock.position[0], rock.position[2]);
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) >= 0) continue;
        const dx = p.getX(i) * rock.scale[0], dz = p.getZ(i) * rock.scale[2];
        foot = Math.min(foot, seabedHeightAt(rock.position[0] + dx * c + dz * s, rock.position[2] - dx * s + dz * c));
      }
      rock.position[1] = foot - 0.012;
      rock.scale[1] = Math.max(0.12, crown - rock.position[1]);
    };
    for (let i = 0; i < data.rock.length; i++) {
      const rock = data.rock[i];
      const crown = i < 9 ? rock.position[1] + rock.scale[1] : seabedHeightAt(rock.position[0], rock.position[2]) + 0.28;
      anchorRock(rock, crown);
    }
    // The real bed receives the contact shadows; planar decals would intersect its slope.
    data.contact.length = 0;
    // Place each colony's lowest real vertex at its stone or at the floor.
    // Only hero edge colonies need extra support; their narrow rubble stays inside
    // the garden's existing colony footprint and is buried in the local sediment.
    const colonyTypes = ["rosette", "bulb", "fan", "branch", "cup", "sponge", "cap", "brain"];
    for (const type of colonyTypes) {
      const geometry = assets[type];
      geometry.computeBoundingBox();
      const pair = type === "cap" ? assets.capDots : type === "sponge" ? assets.spongeLip : null;
      if (pair) pair.computeBoundingBox();
      const lowestLocal = geometry.boundingBox.min.y;
      const highestLocal = Math.max(geometry.boundingBox.max.y, pair?.boundingBox.max.y ?? -Infinity);
      for (const d of data[type]) {
        let support = -Infinity;
        for (const rock of data.rock) support = Math.max(support, rockSurfaceAt(assets.rock, rock, d.position[0], d.position[2]));
        if (!Number.isFinite(support) && d.position[1] > -1.9) {
          const width = Math.max(0.32, d.scale[0] * 0.7);
          const floor = seabedHeightAt(d.position[0], d.position[2]);
          const crown = Math.min(d.position[1] + lowestLocal * d.scale[1] + 0.02, floor + 0.25);
          const rock = {
            position: [d.position[0] - width * 0.1, floor, d.position[2] + width * 0.08],
            scale: [width, Math.max(0.12, crown - floor), width * 0.82],
            angle: d.angle, color: "#477d7b",
          };
          anchorRock(rock, Math.max(crown, floor + 0.12));
          data.rock.push(rock);
          support = rockSurfaceAt(assets.rock, rock, d.position[0], d.position[2]);
        }
        const base = Math.max(seabedHeightAt(d.position[0], d.position[2]) + 0.005, Number.isFinite(support) ? support - 0.02 : -Infinity);
        d.scale[1] = Math.min(d.scale[1], (-0.24 - base) / (highestLocal - lowestLocal));
        d.position[1] = base - lowestLocal * d.scale[1];
      }
    }
    // Seagrass and stars sit on the same floor or on a rock face, with no floating roots.
    for (const type of ["grass", "star"]) {
      assets[type].computeBoundingBox();
      for (const d of data[type]) {
        let support = seabedHeightAt(d.position[0], d.position[2]) + 0.005;
        for (const rock of data.rock) support = Math.max(support, rockSurfaceAt(assets.rock, rock, d.position[0], d.position[2]) - 0.02);
        d.position[1] = support - assets[type].boundingBox.min.y * d.scale[1];
      }
    }
    // Check true vertices, including tilted grass and linked sponge lips/cap dots.
    for (const [type, instances] of Object.entries(data)) {
      if (type === "contact") continue;
      for (const d of instances) {
        const top = trueInstanceTop(assets[type], d);
        if (top > -0.24) d.position[1] -= top + 0.24;
      }
    }
    Object.defineProperty(data, "environment", { value: createReefHeightField(assets.rock, data.rock) });
    return data;
  }, [assets]);
  useEffect(() => { onTerrainReady?.(layout.environment); }, [layout, onTerrainReady]);
  useEffect(() => () => { Object.values(assets).forEach((a) => a.dispose()); }, [assets]);
  return (
    <>
      {Object.keys(layout).filter((type) => layout[type].length > 0).map((type) => (
        <Instances
          key={type}
          geometry={assets[type]}
          data={layout[type]}
          roughness={CORAL_ROUGHNESS[type] ?? 1}
          bumpMap={type === "brain" ? assets.bump : null}
          castShadows={CORAL_SHADOW_CASTERS.has(type)}
          opacity={type === "contact" ? 0.075 : 1}
          fill={CORAL_FILL[type] ?? 0.04}
          stoneField={type === "rock" ? assets.stoneField : null}
          map={type === "contact" ? assets.contactMap : null}
        />
      ))}
    </>
  );
}
export function Fish({ boatState }) {
  const bodies = useRef(),
    tails = useRef(),
    eyes = useRef();
  const fish = useMemo(() => {
    const r = random(93);
    return Array.from({ length: 22 }, (_, i) => ({
      group: i < 13 ? 0 : 1,
      phase: (i < 13 ? 0.2 : 1.8) + r() * 0.8,
      radius: 1.3 + r() * 1.5,
      offsetX: (r() - 0.5) * 3.2,
      offsetZ: (r() - 0.5) * 2.6,
      speed: 0.13 + r() * 0.05,
      y: -0.6 - r() * 0.85,
      color: i % 3 ? "#d1c59d" : "#b8d6d3",
      size: 0.12 + r() * 0.09,
    }));
  }, []);
  const resources = useMemo(() => {
    const transform = new Object3D();
    const body = new Object3D();
    body.scale.set(0.45, 0.4, 1.2);
    const tail = new Object3D();
    tail.position.set(0, 0, 1.2);
    tail.rotation.x = Math.PI / 2;
    const eye = new Object3D();
    eye.position.set(0.4, 0.1, -0.7);
    transform.add(body, tail, eye);
    return {
      bodyGeometry: new SphereGeometry(1, 10, 6),
      tailGeometry: new CylinderGeometry(0, 0.6, 1.1, 3),
      eyeGeometry: new SphereGeometry(0.12, 6, 6),
      transform, body, tail, eye,
    };
  }, []);
  useLayoutEffect(() => {
    fish.forEach((d, i) => {
      const color = new Color(d.color);
      bodies.current.setColorAt(i, color);
      tails.current.setColorAt(i, color);
    });
    bodies.current.instanceColor.needsUpdate = true;
    tails.current.instanceColor.needsUpdate = true;
  }, [fish]);
  useEffect(() => () => {
    resources.bodyGeometry.dispose();
    resources.tailGeometry.dispose();
    resources.eyeGeometry.dispose();
  }, [resources]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { transform, body, tail, eye } = resources;
    fish.forEach((d, i) => {
      const a = t * d.speed + d.phase,
        x = -8 + (d.group ? 1.7 : -1.6) + d.offsetX + Math.sin(t * 0.055) * 1.2 + Math.cos(a) * d.radius,
        z = 8 + (d.group ? 1.3 : -1.0) + d.offsetZ + Math.sin(t * 0.07) * 0.8 + Math.sin(a) * d.radius * 0.65;
      transform.position.set(x, d.y + Math.sin(t + i) * 0.07, z);
      const vx = -Math.sin(a) * d.radius * d.speed + Math.cos(t * 0.055) * 0.066;
      const vz = Math.cos(a) * d.radius * d.speed * 0.65 + Math.cos(t * 0.07) * 0.056;
      transform.rotation.y = Math.atan2(-vx, -vz);
      transform.scale.setScalar(d.size);
      tail.rotation.y = Math.sin(t * 9 + i) * 0.5;
      const b = boatState.current.position;
      if (Math.hypot(x - b.x, z - b.z) < 2.4)
        transform.position.y -= 0.18 * Math.sin(t * 4 + i) ** 2;
      // Preserve the original parent scale/heading and each part's local transform.
      transform.updateMatrixWorld(true);
      bodies.current.setMatrixAt(i, body.matrixWorld);
      tails.current.setMatrixAt(i, tail.matrixWorld);
      eyes.current.setMatrixAt(i, eye.matrixWorld);
    });
    // Moving instances need fresh aggregate bounds before both scene passes cull them.
    for (const ref of [bodies, tails, eyes]) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
      ref.current.computeBoundingBox();
    }
  }, -0.75);
  return (
    <group>
      <instancedMesh ref={bodies} args={[resources.bodyGeometry, null, fish.length]}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[resources.tailGeometry, null, fish.length]}>
        <meshStandardMaterial side={DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[resources.eyeGeometry, null, fish.length]}>
        <meshStandardMaterial color="#183c3b" />
      </instancedMesh>
    </group>
  );
}
