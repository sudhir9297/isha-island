import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAB_STORY_ROUTE } from './CrabStory.js';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';
import { crabWalkable } from './CrabNavigation.js';
const guide = () => ({ enabled:true, invited:true, finished:false, collected:false });
test('entire authored route including body clearance stays on sand',()=>{
 for(let i=1;i<CRAB_STORY_ROUTE.length;i++) {
  const a=CRAB_STORY_ROUTE[i-1],b=CRAB_STORY_ROUTE[i];
  for(let n=0;n<=100;n++)for(const [dx,dz] of [[0,0],[.32,0],[-.32,0],[0,.32],[0,-.32]])
   assert.ok(crabWalkable(a.x+(b.x-a.x)*n/100+dx,a.z+(b.z-a.z)*n/100+dz));
 }
});
test('story reaches both stops and shell at multiple frame rates, then waves and returns',()=>{
 for(const dt of [1/30,1/60,1/144]) {
  const s=createCrabBehavior(),d=guide(),stops=new Set();
  for(let time=0;time<25&&!s.uncovered;time+=dt) {
   stepCrab(s,{x:s.x+1,z:s.z},dt,false,d);
   if(s.story.phase==='stop')stops.add(s.story.index);
  }
  assert.deepEqual([...stops],[2,3]);assert.equal(s.uncovered,true);
  d.finished=true;d.collected=true;
  stepCrab(s,{x:s.x+1,z:s.z},dt,false,d);assert.equal(s.story.phase,'farewell');assert.equal(s.speed,0);
  for(let time=0;time<25&&!s.storyDone;time+=dt)stepCrab(s,{x:30,z:30},dt,false,d);
  assert.equal(s.storyDone,true);assert.ok(Math.hypot(s.x+.8,s.z-6)<.04);
 }
});
test('catch-up hysteresis prevents boundary chatter and resumes the same segment',()=>{
 const s=createCrabBehavior(),d=guide();
 for(let i=0;i<40;i++)stepCrab(s,{x:s.x+1,z:s.z},.05,false,d);
 stepCrab(s,{x:s.x+5,z:s.z},.05,false,d);
 const x=s.x,z=s.z,index=s.story.index,gait=s.gait;
 for(let i=0;i<100;i++)stepCrab(s,{x:s.x+4.7+(i%2)*.2,z:s.z},.05,false,d);
 assert.equal(s.x,x);assert.equal(s.z,z);assert.equal(s.gait,gait);assert.equal(s.story.index,index);
 stepCrab(s,{x:s.x+2,z:s.z},.05,false,d);assert.equal(s.story.waiting,false);assert.ok(s.speed>0);
});
test('pause freezes story timer, gait, and position',()=>{
 const s=createCrabBehavior(),d=guide();stepCrab(s,{x:0,z:6},.05,false,d);
 const before=structuredClone(s);stepCrab(s,{x:0,z:6},.05,true,d);assert.deepEqual(s,before);
});
test('leaving in the boat holds the encounter until the player returns',()=>{
 const s=createCrabBehavior(),d=guide();
 for(let i=0;i<40;i++)stepCrab(s,{x:s.x+1,z:s.z},.05,false,d);
 const position={x:s.x,z:s.z};
 for(let i=0;i<200;i++)stepCrab(s,null,.05,false,d);
 assert.equal(s.x,position.x);assert.equal(s.z,position.z);assert.equal(s.uncovered,false);
 for(let i=0;i<500&&!s.uncovered;i++)stepCrab(s,{x:s.x+1,z:s.z},.05,false,d);
 assert.equal(s.uncovered,true);
});
