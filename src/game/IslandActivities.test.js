import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, nearbyActivity, stepActivity, advanceActivity, skippingStonePose } from './IslandActivities.js';
import { walkingSurfaceHeight } from './WalkingSurface.js';
import { worldCoastalRadiusAt } from './Seabed.js';
test('both activities are reachable on land and require a grounded walker',()=>{
 for(const [id,p] of Object.entries(ACTIVITIES)) {
  assert.notEqual(walkingSurfaceHeight(p.x,p.z),null);
  const s={mode:'walking',position:p};assert.equal(nearbyActivity(s),id);
  s.jumping=true;assert.equal(nearbyActivity(s),null);s.jumping=false;s.mode='aboard';assert.equal(nearbyActivity(s),null);
 }
});
test('activities need an explicit action, respect discovery priority and cannot restart mid-animation',()=>{
 const s={mode:'walking',position:ACTIVITIES.bell};
 assert.equal(stepActivity(s,false),false);assert.equal(s.activity,undefined);
 s.nearDiscovery='note';assert.equal(stepActivity(s,true),false);s.nearDiscovery=null;
 assert.equal(stepActivity(s,true),true);const original=s.activity;
 advanceActivity(s,1);stepActivity(s,true);assert.equal(s.activity,original);assert.equal(s.activity.time,.7);
 advanceActivity(s,4.3);assert.equal(s.activity,null);stepActivity(s,true);assert.notEqual(s.activity,original);
});
test('stone starts at the shore and bounces over water with decreasing height',()=>{
 assert.equal(skippingStonePose(0).z,ACTIVITIES.stones.z);
 let height=Infinity;
 for(let hop=0;hop<4;hop++) {
  const pose=skippingStonePose(.45+(hop+.5)*.65);
  assert.ok(worldCoastalRadiusAt(2,pose.z)>1);assert.ok(pose.y<height);height=pose.y;
 }
 assert.equal(skippingStonePose(3.2).visible,false);
});
