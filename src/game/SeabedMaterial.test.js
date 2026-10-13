import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Color } from "three";
import {
  SEABED_GRID, ISLAND_SAND_PALETTE, COAST_SAND_ALBEDO,
  createSeabedGeometry, createSeabedFieldTexture, createSeabedMaterialTexture, seabedSiltWeightAt,
} from "./Seabed.js";

const hash = array => createHash("sha256").update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
test("material classification preserves the held physical terrain and collision field byte for byte", () => {
  const geometry = createSeabedGeometry(), height = createSeabedFieldTexture();
  // Recorded from held source 93 before material-field extraction. These cover
  // every physical vertex, normal, triangle index, and GPU depth-field sample.
  assert.equal(hash(geometry.attributes.position.array), "8e6a42d919a239999d944acee5feff22965ac6126827ad4554fb5abdee76ea17");
  assert.equal(hash(geometry.attributes.normal.array), "7f16edb56fa85d363e16d5ac9de80a276892218243a5ed9d6caaa0da8cf1ef8a");
  assert.equal(hash(geometry.index.array), "eada82cb26f4319005be39ecc7421362eccd29663c70c5c088ade953934b6e75");
  assert.equal(hash(height.image.data), "d890b68d713adde721241d683125b12e2561f6f4b91aada4fc3e1353907e27e6");
  geometry.dispose(); height.dispose();
});

test("underwater coastal sand uses the island's actual wet-edge palette", () => {
  const islandWetEdge = new Color(ISLAND_SAND_PALETTE.dry).lerp(new Color(ISLAND_SAND_PALETTE.wet), ISLAND_SAND_PALETTE.wetBlend).toArray();
  assert.deepEqual(COAST_SAND_ALBEDO, islandWetEdge);
  assert.ok(COAST_SAND_ALBEDO[0] > 0.7 && COAST_SAND_ALBEDO[1] > 0.6);
  assert.ok(Object.isFrozen(ISLAND_SAND_PALETTE) && Object.isFrozen(COAST_SAND_ALBEDO));
});

test("ordinary coastal shelves remain sand while authored reef lobes retain silt", () => {
  for (const [x, z] of [[14, -12], [18, -12], [0, -0.1], [23, -35], [40, 20]]) assert.equal(seabedSiltWeightAt(x, z), 0);
  assert.ok(seabedSiltWeightAt(-19.15, -13.4) > 0.99);
  assert.ok(seabedSiltWeightAt(-10.05, -1.95) > 0.99);
  const mixed = seabedSiltWeightAt(-15.55, -6.25);
  assert.ok(mixed > 0 && mixed < 1);
  const texture = createSeabedMaterialTexture();
  assert.ok([...texture.image.data].every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  texture.dispose();
});

test("CPU and GPU material interpolation follow the physical triangles continuously", () => {
  const geometry = createSeabedGeometry(), texture = createSeabedMaterialTexture();
  const p = geometry.attributes.position, ix = geometry.index, weights = texture.image.data;
  let maxError = 0;
  for (let i = 0; i < ix.count; i += 21) {
    const a = ix.getX(i), b = ix.getX(i + 1), c = ix.getX(i + 2);
    const x = p.getX(a) * 0.21 + p.getX(b) * 0.37 + p.getX(c) * 0.42;
    const z = p.getZ(a) * 0.21 + p.getZ(b) * 0.37 + p.getZ(c) * 0.42;
    const interpolatedWeight = weights[a] * 0.21 + weights[b] * 0.37 + weights[c] * 0.42;
    maxError = Math.max(maxError, Math.abs(interpolatedWeight - seabedSiltWeightAt(x, z)));
  }
  assert.ok(maxError < 1e-10, `material/physical triangle error ${maxError}`);
  const { x, z, step } = SEABED_GRID;
  // Both triangle diagonals and grid boundaries must meet without color seams.
  for (let i = 20; i < 90; i++) {
    const px = x + i * step, pz = z + i * step * 1.7;
    assert.ok(Math.abs(seabedSiltWeightAt(px - 1e-6, pz) - seabedSiltWeightAt(px + 1e-6, pz)) < 1e-4);
  }
  geometry.dispose(); texture.dispose();
});
