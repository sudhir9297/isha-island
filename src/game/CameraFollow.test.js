import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createCameraFollow, changeFollowZoom, stepCameraFollow, FOLLOW } from './CameraFollow.js';
const subject = (x = 0, extra = {}) => ({ position: new Vector3(x, 0, 0), aboard: false, ...extra });

test('initial focus uses the saved character position and walking framing', () => {
  const state = stepCameraFollow(createCameraFollow(), subject(24), 0);
  assert.equal(state.target.x, 24);
  assert.equal(state.viewHeight, FOLLOW.walkingHeight);
});
test('focus and zoom damping are independent of frame rate', () => {
  const run = (fps) => {
    const state = stepCameraFollow(createCameraFollow(), subject(), 0);
    for (let i = 0; i < fps; i++) stepCameraFollow(state, subject(10, { aboard: true, speed: 8 }), 1 / fps);
    return state;
  };
  const a = run(30), b = run(144);
  assert.ok(a.target.distanceTo(b.target) < 1e-10);
  assert.ok(Math.abs(a.viewHeight - b.viewHeight) < 1e-10);
  assert.ok(a.target.x > 9 && a.target.x < 10);
});
test('boarding eases out and movement adds bounded viewing room', () => {
  const state = stepCameraFollow(createCameraFollow(), subject(), 0);
  stepCameraFollow(state, subject(1, { aboard: true, speed: 100 }), 1 / 60);
  assert.ok(state.viewHeight > FOLLOW.walkingHeight && state.viewHeight < FOLLOW.sailingHeight);
  for (let i = 0; i < 600; i++) stepCameraFollow(state, subject(1, { aboard: true, speed: 100 }), 1 / 60);
  assert.ok(Math.abs(state.viewHeight - FOLLOW.sailingHeight * 1.22) < 1e-6);
});
test('reset snaps to the respawn instead of flying across the island', () => {
  const state = stepCameraFollow(createCameraFollow(), subject(), 0);
  stepCameraFollow(state, subject(60, { resetId: 1 }), 1 / 60);
  assert.equal(state.target.x, 60);
});
test('wheel and pinch zoom stay bounded and do not modify the followed position', () => {
  const state = stepCameraFollow(createCameraFollow(), subject(5), 0);
  changeFollowZoom(state, 100);
  assert.equal(state.zoom, FOLLOW.maxZoom);
  changeFollowZoom(state, -100);
  assert.equal(state.zoom, FOLLOW.minZoom);
  assert.equal(state.target.x, 5);
});
test('reduced motion removes follow lag and speed-driven zoom', () => {
  const state = stepCameraFollow(createCameraFollow(), subject(), 0);
  stepCameraFollow(state, subject(8, { reducedMotion: true, speed: 4 }), 1 / 60);
  assert.equal(state.target.x, 8);
  assert.equal(state.viewHeight, FOLLOW.walkingHeight);
});
