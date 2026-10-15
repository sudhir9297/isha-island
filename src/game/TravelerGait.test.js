import test from 'node:test';
import assert from 'node:assert/strict';
import {travelerLegPose, travelerUpperPose, WALK_PHASE_PER_METER, WALK_HIP_HEIGHT} from './TravelerGait.js';
const foot = p => ({z:-.33*Math.sin(p.hip)-.34*Math.sin(p.hip+p.knee), y:WALK_HIP_HEIGHT-.33*Math.cos(p.hip)-.34*Math.cos(p.hip+p.knee)});
test('stance feet stay on the ground and hold their world position as the player moves',()=>{
 const start=foot(travelerLegPose(0,1));
 for(let i=0;i<=100;i++){
  const phase=i/100*Math.PI, p=travelerLegPose(phase,1), f=foot(p);
  assert.ok(Math.abs(f.y-.11)<1e-8);
  assert.ok(Math.abs(f.z-phase/WALK_PHASE_PER_METER-start.z)<1e-8);
  assert.ok(Math.abs(p.hip+p.knee+p.ankle)<1e-12);
 }
});
test('swing clears the floor, rolls the toes and meets both contacts continuously',()=>{
 for(let i=0;i<100;i++){
  const phase=Math.PI+i/100*Math.PI, p=travelerLegPose(phase,1), f=foot(p);
  assert.ok(Number.isFinite(p.hip+p.knee+p.ankle));
  assert.ok(Math.abs(f.y-(.11+p.lift))<1e-8);
  assert.ok(f.y-.18*Math.abs(Math.sin(p.footPitch))>.08);
 }
 assert.ok(travelerLegPose(Math.PI*1.5,1).lift>.07);
 for(const phase of [0,Math.PI]){
  const a=travelerLegPose(phase-1e-5,1),b=travelerLegPose(phase+1e-5,1);
  assert.ok(Math.abs(a.hip-b.hip)+Math.abs(a.knee-b.knee)+Math.abs(a.ankle-b.ankle)<.0002);
 }
});
test('idle is stable and carrying luggage reduces arm movement',()=>{
 assert.deepEqual(travelerLegPose(0,0),travelerLegPose(3,0));
 const a=travelerLegPose(.8,1),b=travelerLegPose(.8+Math.PI*2,1);
 assert.ok(Math.abs(a.hip-b.hip)<1e-12);
 assert.ok(Math.abs(travelerUpperPose(0,1,true).arm)<Math.abs(travelerUpperPose(0,1,false).arm));
 assert.equal(travelerUpperPose(1,0).bob,0);
 assert.ok(travelerUpperPose(0,1).arm * travelerUpperPose(Math.PI,1).arm < 0);
});
