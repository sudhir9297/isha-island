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

test('arrival keeps the dock traveler and gate crown in frame on desktop and phone', async () => {
  const { OrthographicCamera } = await import('three');
  const { CAMERA_OFFSET } = await import('./WorldConfig.js');
  const { DOCK, dockWorldPoint } = await import('./WalkingSurface.js');
  const dock = dockWorldPoint(0, 5.15);
  const position = new Vector3(dock.x, DOCK.deckHeight, dock.z);
  for (const [width, height] of [[1280,720],[390,844]]) {
    const state = stepCameraFollow(createCameraFollow(), {position, aboard:false, arrival:true}, 0);
    const camera = new OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,400);
    camera.zoom = Math.min(height,width*1.8)/state.viewHeight;
    camera.position.copy(state.target).add(new Vector3(...CAMERA_OFFSET));
    camera.lookAt(state.target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const point of [position.clone(), position.clone().add(new Vector3(0,2.3,0)), new Vector3(0,8,-12)]) {
      point.project(camera);
      assert.ok(Math.abs(point.x)<.95 && Math.abs(point.y)<.85, `subject outside safe frame at ${width}: ${point.toArray()}`);
    }
  }
});

test('arrival framing leaves other islands, the doorway, and completed journeys alone', () => {
  for (const position of [new Vector3(65,0,-48),new Vector3(130,0,-84),new Vector3(0,2.35,-11),new Vector3(0,0,30)]) {
    const state = stepCameraFollow(createCameraFollow(), {position,aboard:false,arrival:true}, 0);
    assert.ok(state.target.equals(position));
    assert.equal(state.viewHeight,FOLLOW.walkingHeight);
  }
  const position = new Vector3(6,0,0);
  const state = stepCameraFollow(createCameraFollow(), {position,aboard:false,arrival:false},0);
  assert.ok(state.target.equals(position));
  assert.equal(state.viewHeight,FOLLOW.walkingHeight);
});

test('arrival preserves manual zoom and eases back without a camera cut', () => {
  const position = new Vector3(6,.6,0);
  const state = stepCameraFollow(createCameraFollow(), {position,aboard:false,arrival:true},0);
  changeFollowZoom(state,Math.log(1.2));
  const previous = state.target.clone(), height = state.viewHeight;
  stepCameraFollow(state,{position,aboard:false,arrival:false},1/60);
  assert.equal(state.zoom,1.2);
  assert.ok(state.target.distanceTo(previous)<previous.distanceTo(position));
  assert.ok(state.viewHeight<height && state.viewHeight>FOLLOW.walkingHeight/1.2);
});
