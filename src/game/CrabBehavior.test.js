import { crabWalkable } from './CrabNavigation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';

test('nearby player triggers a faster escape away from their position', () => {
  const crab = createCrabBehavior();
  const player = { x: crab.x - 1, z: crab.z };
  const start = Math.hypot(crab.x - player.x, crab.z - player.z);
  for (let i = 0; i < 20; i++) stepCrab(crab, player, 0.05);
  assert.equal(crab.mode, 'flee');
  assert.ok(crab.speed > 2);
  assert.ok(Math.hypot(crab.x - player.x, crab.z - player.z) > start + 1);
});

test('escape stays on the beach even when chased into its edges', () => {
  const crab = createCrabBehavior();
  for (let i = 0; i < 4000; i++) {
    stepCrab(crab, { x: crab.x - Math.cos(i * 0.02), z: crab.z - Math.sin(i * 0.02) }, 0.05);
    assert.ok(crabWalkable(crab.x, crab.z));
    assert.ok(Number.isFinite(crab.heading));
  }
});

test('calms down after the player leaves and varies its idle activities', () => {
  const crab = createCrabBehavior();
  stepCrab(crab, { x: crab.x, z: crab.z }, 0.05);
  const modes = new Set();
  for (let i = 0; i < 2400; i++) {
    stepCrab(crab, null, 0.05);
    if (i > 30) { assert.notEqual(crab.mode, 'flee'); modes.add(crab.mode); }
  }
  assert.deepEqual([...modes].sort(), ['dig', 'wander', 'wave']);
});

test('pause freezes movement, alarm and animation', () => {
  const crab = createCrabBehavior();
  const before = { ...crab };
  stepCrab(crab, { x: crab.x, z: crab.z }, 1, true);
  assert.deepEqual(crab, before);
});
