import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleWeather, sampleGust, windExposure, grassInteractionTarget, createLeafPool, stepLeaves, WIND_GROVES } from './Atmosphere.js';
import { createWindSamples, windAudioLevels } from './WindAudio.js';

test('weather cycles continuously between sunny/calm and overcast/breezy', () => {
  assert.deepEqual(sampleWeather(0), { cloud: 0, wind: .28, sun: 3.2 });
  assert.equal(sampleWeather(90).cloud, 1);
  assert.ok(Math.abs(sampleWeather(180).wind - sampleWeather(0).wind) < 1e-10);
  let previous = sampleWeather(0);
  for (let t = 1 / 60; t < 360; t += 1 / 60) {
    const w = sampleWeather(t);
    assert.ok(w.wind >= .28 && w.wind <= .72 && w.sun >= 2.15 && w.sun <= 3.2);
    assert.ok(Math.abs(w.cloud - previous.cloud) < .001);
    previous = w;
  }
});
test('gusts are bounded and coherent across nearby points and frames', () => {
  for (let x = -20; x < 20; x += .7) {
    const a = sampleGust(x, -12, 80);
    assert.ok(a >= -1 && a <= 1);
    assert.ok(Math.abs(a - sampleGust(x + .001, -12, 80.001)) < .01);
  }
});
test('grass only reacts to grounded walking and respects reduced motion', () => {
  const traveler = { mode: 'walking', jumping: false, velocityX: 3, velocityZ: 0 };
  assert.equal(grassInteractionTarget(traveler, false), 1);
  assert.equal(grassInteractionTarget(traveler, true), 0);
  for (const mode of ['aboard', 'resting']) assert.equal(grassInteractionTarget({ ...traveler, mode }, false), 0);
  assert.equal(grassInteractionTarget({ ...traveler, jumping: true }, false), 0);
  assert.equal(grassInteractionTarget({ ...traveler, velocityX: 0 }, false), 0);
});
test('leaves remain near trees, expire, and never grow their pool', () => {
  const pool = createLeafPool(), identities = [...pool.leaves];
  stepLeaves(pool, 1, { x: 100, z: 100 }, 1, .7, () => 0, () => .5);
  assert.equal(pool.leaves.filter(l => l.active).length, 0);
  const focus = WIND_GROVES[0];
  for (let i = 0; i < 60 * 60; i++) stepLeaves(pool, 1 / 60, focus, i / 60, .7, () => 0, () => .5);
  assert.equal(pool.leaves.length, 18);
  assert.ok(pool.leaves.some(l => l.active));
  pool.leaves.forEach((l, i) => { assert.equal(l, identities[i]); if (l.active) assert.ok(l.y >= .08 && l.age < l.duration); });
  const before = structuredClone(pool); stepLeaves(pool, 0, focus, 60, .7, () => 0);
  assert.deepEqual(pool, before);
});
test('wind audio grows near trees and quiets in the gate shelter', () => {
  const tree = WIND_GROVES[0];
  assert.ok(windAudioLevels(tree, .7, 10).rustle[0] > 0);
  assert.ok(windAudioLevels({ x: 100, z: 100 }, .7, 10).rustle.every(v => v === 0));
  assert.ok(windExposure(3, -15) < windExposure(30, 0));
  assert.ok(windAudioLevels(tree, .7, 10).air > windAudioLevels(tree, .28, 10).air);
});
test('synthesized wind loops are finite, deterministic, and quiet at the seam', () => {
  const a = createWindSamples(8000), b = createWindSamples(8000);
  assert.deepEqual(a, b);
  assert.equal(Math.abs(a[0]), 0); assert.equal(Math.abs(a.at(-1)), 0);
  assert.ok(a.every(v => Number.isFinite(v) && Math.abs(v) <= 1));
  assert.ok(a.some(v => Math.abs(v) > .05));
});
