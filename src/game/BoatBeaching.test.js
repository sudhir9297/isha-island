import test from 'node:test';
import assert from 'node:assert/strict';
import { stepBoat, stepBoatFrame, resetBoatToWater } from './BoatPhysics.js';
const boat = (speed=6) => ({position:{x:0,y:0,z:0}, heading:0, speed});
function run(s, seconds, controls={}, hz=60) {
  for(let i=0;i<seconds*hz;i++) stepBoat(s,controls,1/hz);
  return s;
}
test('fast arrivals beach and retain more travel at greater impact speed',()=>{
  const slow=run(boat(3.5),2), fast=run(boat(6),2);
  assert.equal(fast.beached,true);
  assert.ok(fast.position.z < slow.position.z - 0.3);
  assert.ok(fast.hullPose.bob > .2);
});
test('sand removes propulsion and preserves then damps yaw momentum',()=>{
  const s=boat();
  while(!s.beached) stepBoat(s,{left:true},1/60);
  const yaw=s.angularVelocity, heading=s.heading;
  run(s,1,{forward:true,right:true});
  assert.ok(s.heading>heading);
  assert.ok(s.angularVelocity<yaw*.1);
  run(s,2,{forward:true});
  assert.ok(Math.abs(s.speed)<.01);
});
test('recovery clears motion and destination at the saved water position',()=>{
  const s=boat(); s.safeWater={x:-24,z:12,heading:1};
  run(s,6);
  assert.equal(s.beached,false);
  assert.equal(s.position.x,-24); assert.equal(s.position.z,12);
  s.destination={x:2,z:3}; resetBoatToWater(s);
  assert.equal(s.speed,0); assert.equal(s.destination,null);
  assert.equal(s.angularVelocity,0);
});
test('pause freezes recovery and integration is consistent across frame rates',()=>{
  const a=run(boat(),2,{},30), b=run(boat(),2,{},144);
  assert.ok(Math.abs(a.position.z-b.position.z)<.08);
  const time=a.beachedTime;
  for(let i=0;i<360;i++) stepBoatFrame(a,{},1/60,true);
  assert.equal(a.beachedTime,time);
});

test('sand stops a slide firmly while the same speed keeps coasting on water',()=>{
  const sand=boat(5); sand.position.z=-12; sand.beached=true;
  sand.beachedTime=0; sand.angularVelocity=0;
  const water=boat(5); water.position.x=-30; water.position.z=15;
  run(sand,1); run(water,1);
  assert.ok(Math.abs(sand.speed)<0.01);
  assert.ok(Math.abs(sand.position.z+12)<2.5);
  assert.ok(water.speed>2);
  const stopped=sand.position.z;
  run(sand,.5,{forward:true});
  assert.equal(sand.position.z,stopped);
});
