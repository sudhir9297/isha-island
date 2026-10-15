import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {checkpointReveal, REST_SPOT, OVERLOOK_SEAT} from './StoryMoments.js';
import {createJourney,stepJourney} from './JourneyState.js';
test('checkpoint reveal enters, holds and exits without intercepting gameplay time',()=>{
  assert.equal(checkpointReveal(0).visible,false);
  assert.equal(checkpointReveal(2).visible,false);
  assert.equal(checkpointReveal(1,true).visible,true);
  assert.equal(checkpointReveal(3).opacity,1);
  assert.ok(checkpointReveal(2.3).opacity<checkpointReveal(2.7).opacity);
  assert.ok(checkpointReveal(7).opacity<checkpointReveal(6).opacity);
  assert.equal(checkpointReveal(8).visible,false);
});
test('quiet overlook completes the journey only after release and allows leaving',()=>{
  const b={position:new Vector3(-13,0,-4),resetId:0,speed:0},s=createJourney();
  s.mode='walking';s.position.set(REST_SPOT.x,1,REST_SPOT.z);s.landing.set(0,1,-8);
  stepJourney(s,b,{interact:true},.016);assert.equal(s.completed,false);
  s.released=true;s.releaseTime=8;stepJourney(s,b,{},.016);
  stepJourney(s,b,{interact:true},.016);assert.equal(s.mode,'resting');assert.equal(s.completed,true);
  stepJourney(s,b,{},1,true);assert.equal(s.restTime,0);
  stepJourney(s,b,{},.05);assert.ok(s.restTime>0);
  stepJourney(s,b,{forward:true},.016);assert.equal(s.mode,'walking');assert.equal(s.completed,true);
});

test('release reveal clock continues aboard and while resting but stops on pause',()=>{
  const b={position:new Vector3(-13,0,-4),resetId:0,speed:0},s=createJourney();
  s.released=true;s.releaseTime=3;
  stepJourney(s,b,{},.05);assert.equal(s.releaseTime,3.05);
  s.mode='resting';stepJourney(s,b,{},.05);assert.ok(Math.abs(s.releaseTime-3.1)<1e-8);
  stepJourney(s,b,{},.05,true);assert.ok(Math.abs(s.releaseTime-3.1)<1e-8);
});

test('walker cannot pass through the overlook seat',()=>{
  const b={position:new Vector3(-13,0,-4),resetId:0,speed:0},s=createJourney();
  s.mode='walking';s.released=true;s.releaseTime=8;
  s.position.set(OVERLOOK_SEAT.x,1,OVERLOOK_SEAT.z+.47);
  const before=s.position.clone();
  stepJourney(s,b,{forward:true},.05);
  assert.deepEqual(s.position,before);
  stepJourney(s,b,{backward:true},.05);
  assert.ok(s.position.z>before.z);
});
