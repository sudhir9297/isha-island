import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWind, createWindLines, stepWindLines, windRibbonWidth, WIND, windDirection } from './WindField.js';

test('wind freezes for pause and reduced motion and clamps tab-resume deltas', () => {
  assert.equal(advanceWind(4, 1 / 60, true, false), 4);
  assert.equal(advanceWind(4, 1 / 60, false, true), 4);
  assert.equal(advanceWind(4, 30, false, false), 4.05);
  assert.equal(advanceWind(4, -1, false, false), 4);
  assert.ok(Math.abs(Math.hypot(windDirection.x, windDirection.z) - 1) < 1e-12);
});

test('ribbon pulse starts and ends invisible, keeps tapered tips, and travels forward', () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    assert.equal(windRibbonWidth(t, 0), 0);
    assert.equal(windRibbonWidth(t, 1), 0);
    assert.equal(windRibbonWidth(0, t), 0);
    assert.equal(windRibbonWidth(1, t), 0);
  }
  assert.ok(windRibbonWidth(0.25, 0.4) > windRibbonWidth(0.75, 0.4));
  assert.ok(windRibbonWidth(0.75, 0.6) > windRibbonWidth(0.25, 0.6));
});

test('trails spawn near the current focus and above land or water', () => {
  const state = createWindLines();
  const focus = { x: 120, z: -80 };
  stepWindLines(state, 0.5, focus, () => 6, () => 0.5);
  const line = state.lines[0];
  assert.equal(line.x, focus.x);
  assert.equal(line.z, focus.z);
  assert.ok(line.y > 7.8);
  const before = structuredClone(state);
  stepWindLines(state, 0, { x: 0, z: 0 }, () => 0);
  assert.deepEqual(state, before);
});

test('trail pool stays bounded and reuses expired slots after long playback', () => {
  const state = createWindLines(), originals = [...state.lines];
  for (let i = 0; i < 60 * 120; i++) {
    stepWindLines(state, 1 / 60, { x: i / 60, z: 0 }, () => -2, () => 0.2);
    assert.equal(state.lines.length, WIND.poolSize);
    assert.ok(state.lines.every(line => line.age < WIND.duration || !line.active));
  }
  state.lines.forEach((line, i) => assert.equal(line, originals[i]));
  assert.ok(state.lines.some(line => line.x > 110));
});
