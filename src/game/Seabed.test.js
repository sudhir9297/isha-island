import test from "node:test";
import assert from "node:assert/strict";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { SEABED_Y } from "./WorldConfig.js";
import { SEABED_GRID, SEABED_MAX_Y, seabedHeightAt, seabedMaxHeightWithin, createSeabedGeometry, createSeabedFieldTexture, createReefHeightField, coastalRadiusAt, shoreRadius, baseSandHeight } from "./Seabed.js";

test("shared height query intersects the actual indexed terrain triangles", () => {
  const geometry = createSeabedGeometry(), p = geometry.attributes.position, ix = geometry.index;
  let maximumError = 0;
  // Unequal barycentric coordinates exercise both diagonals, away from grid nodes.
  for (let i = 0; i < ix.count; i += 21) {
    const a = ix.getX(i), b = ix.getX(i + 1), c = ix.getX(i + 2);
    const x = p.getX(a) * 0.21 + p.getX(b) * 0.37 + p.getX(c) * 0.42;
    const z = p.getZ(a) * 0.21 + p.getZ(b) * 0.37 + p.getZ(c) * 0.42;
    const actualY = p.getY(a) * 0.21 + p.getY(b) * 0.37 + p.getY(c) * 0.42;
    maximumError = Math.max(maximumError, Math.abs(actualY - seabedHeightAt(x, z)));
  }
  assert.ok(maximumError < 1e-6, `triangle error ${maximumError}`);
  for (const attribute of Object.values(geometry.attributes)) assert.ok([...attribute.array].every(Number.isFinite));
  geometry.dispose();
});

test("coast and sediment have compact boundaries, broad slopes, and finite elevations", () => {
  assert.equal(seabedHeightAt(-30, -10), SEABED_Y);
  assert.ok(Math.abs(seabedHeightAt(-4, 4) - SEABED_Y) < 1e-6);
  assert.ok(SEABED_MAX_Y < 0.615 && SEABED_MAX_Y > 0.59);
  let steepest = 0;
  const { x, z, step, columns, rows } = SEABED_GRID;
  for (let iz = 0; iz < rows - 1; iz++) for (let ix = 0; ix < columns - 1; ix++) {
    const h = seabedHeightAt(x + ix * step, z + iz * step);
    steepest = Math.max(steepest, Math.abs(seabedHeightAt(x + (ix + 1) * step, z + iz * step) - h) / step, Math.abs(seabedHeightAt(x + ix * step, z + (iz + 1) * step) - h) / step);
  }
  assert.ok(steepest < Math.tan(35 * Math.PI / 180), `slope ${steepest}`);
});

test("GPU float field and triangle interpolation match the physical floor", () => {
  const texture = createSeabedFieldTexture(), values = texture.image.data;
  const { x, z, step, columns, rows } = SEABED_GRID;
  let maxError = 0;
  for (let iz = 1; iz < rows - 1; iz += 3) for (let ix = 1; ix < columns - 1; ix += 3) {
    for (const [u, v] of [[0.13, 0.42], [0.77, 0.69]]) {
      const i = iz * columns + ix;
      const a = values[i], b = values[i + 1], c = values[i + columns], d = values[i + columns + 1];
      const gpuY = Math.fround(u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v));
      maxError = Math.max(maxError, Math.abs(gpuY - seabedHeightAt(x + (ix + u) * step, z + (iz + v) * step)));
    }
  }
  assert.ok(maxError < 2e-7, `float field error ${maxError}`);
  texture.dispose();
});

test("full footprint floor bound contains the body perimeter and interior", () => {
  for (let i = 0; i < 80; i++) {
    const x = -25 + i % 10 * 2.2, z = -19 + Math.floor(i / 10) * 3, radius = 0.2 + i % 7 * 0.3;
    const highest = seabedMaxHeightWithin(x, z, radius);
    for (let j = 0; j < 96; j++) {
      const angle = j * 2.399963, r = radius * Math.sqrt(j / 95);
      assert.ok(seabedHeightAt(x + Math.cos(angle) * r, z + Math.sin(angle) * r) <= highest + 1e-7);
    }
  }
});

test("reef environment includes transformed real rock triangles and ignores buried rock", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, 0, -1, 1, 0, -1, -1, 1, 1], 3));
  const field = createReefHeightField(geometry, [
    { position: [24, -1.9, 14], scale: [2, 0.6, 1.5], angle: Math.PI / 2 },
    { position: [28, -3, 14], scale: [1, 0.3, 1], angle: 0 },
  ]);
  // Local point [-.3,.3,-.4] lies inside the slope and rotates to [-.6,.18,.6].
  assert.ok(Math.abs(field.heightAt(23.4, 14.6) - (-1.72)) < 1e-6);
  assert.equal(field.heightAt(28, 14), SEABED_Y);
  assert.equal(field.heightAt(40, 14), SEABED_Y);
  const bound = field.maxHeightWithin(24, 14, 1.9);
  assert.ok(bound >= -1.300001 && bound <= -1.299999);
  for (let i = 0; i < 70; i++) {
    const angle = i * 2.399963, radius = 1.9 * Math.sqrt(i / 69);
    assert.ok(field.heightAt(24 + Math.cos(angle) * radius, 14 + Math.sin(angle) * radius) <= bound + 1e-7);
  }
  assert.ok(Object.isFrozen(field));
  geometry.dispose();
});


test("coastal triangles meet the authored island sand edge and deepen continuously", () => {
  for (let i = 0; i < 160; i++) {
    const a = i / 160 * Math.PI * 2;
    const x = Math.cos(a) * 12 * 1.08 * shoreRadius(a), z = Math.sin(a) * 9 * 1.08 * shoreRadius(a);
    assert.ok(Math.abs(coastalRadiusAt(x, z - 12) - 1.08) < 1e-12);
    assert.ok(Math.abs(seabedHeightAt(x, z - 12) - (baseSandHeight(1.08, x, z) - 0.012)) < 0.003);
    let previous = seabedHeightAt(x, z - 12);
    // Mounds can rise locally on the west; the clear east shelf must descend smoothly.
    if (Math.cos(a) < 0) continue;
    for (let r = 1.1; r <= 1.9; r += 0.025) {
      const h = seabedHeightAt(Math.cos(a) * 12 * r * shoreRadius(a), Math.sin(a) * 9 * r * shoreRadius(a) - 12);
      assert.ok(h <= previous + 0.003);
      previous = h;
    }
    assert.ok(Math.abs(previous - SEABED_Y) < 1e-6);
  }
});

test("camera-ray bisection meets actual physical shelf at steep slopes", () => {
  let maximumError = 0;
  for (let x = -25; x < 22; x += 0.6) for (let z = -34; z < 10; z += 0.6) {
    let low = SEABED_Y, high = SEABED_MAX_Y;
    for (let i = 0; i < 13; i++) {
      const h = (low + high) * 0.5;
      if (h > seabedHeightAt(x + (h + 0.08) * -0.4, z + (h + 0.08) * 0.8)) high = h;
      else low = h;
    }
    const h = (low + high) * 0.5;
    maximumError = Math.max(maximumError, Math.abs(h - seabedHeightAt(x + (h + 0.08) * -0.4, z + (h + 0.08) * 0.8)));
  }
  assert.ok(maximumError < 0.0004, `ray/triangle residual ${maximumError}`);
});
