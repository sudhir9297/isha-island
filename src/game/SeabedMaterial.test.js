import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Color } from "three";
import {
  SEABED_GRID, ISLAND_SAND_PALETTE, COAST_SAND_ALBEDO,
  createSeabedGeometry, createSeabedFieldTexture, createSeabedMaterialTexture, seabedSiltWeightAt,
} from "./Seabed.js";

const hash = array => createHash("sha256").update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
test("material classification preserves the three-island terrain regression baseline", () => {
  const geometry = createSeabedGeometry(), height = createSeabedFieldTexture();
  // Updated for the intentional Neem Point terrain addition (19 October 2026).
  // Covers every physical vertex, normal, index and GPU depth sample; the
  // seabed tests separately verify original shoreline and CPU/GPU agreement.
  assert.equal(hash(geometry.attributes.position.array), "90a760e0788e71efbe87a3293e6090162c072d82542a13dcf9e8b8244bf9395f");
  assert.equal(hash(geometry.attributes.normal.array), "551e6e54863492cc1f513a25fcb8a28f7cf4335f47943609c33310c3edb6690d");
  assert.equal(hash(geometry.index.array), "9da826731e7c65a4ecdf42c0c97c80d524ef4180f8d4e31eb81c1f989863fac8");
  assert.equal(hash(height.image.data), "a817f324ca45a2bab7b4c8bc4550f7f9af644ee97acb000e774d20a844dedd60");
  geometry.dispose(); height.dispose();
});

test("underwater coastal sand uses the island's actual wet-edge palette", () => {
  const islandWetEdge = new Color(ISLAND_SAND_PALETTE.dry).lerp(new Color(ISLAND_SAND_PALETTE.wet), ISLAND_SAND_PALETTE.wetBlend).toArray();
  assert.deepEqual(COAST_SAND_ALBEDO, islandWetEdge);
  // Albedo is linear, not sRGB. Preserve the authored warm sand relationship
  // without imposing obsolete brightness thresholds from the old palette.
  assert.ok(COAST_SAND_ALBEDO.every(channel => channel > 0 && channel < 1));
  assert.ok(COAST_SAND_ALBEDO[0] > COAST_SAND_ALBEDO[1] && COAST_SAND_ALBEDO[1] > COAST_SAND_ALBEDO[2]);
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
