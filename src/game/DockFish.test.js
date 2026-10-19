import test from 'node:test';
import assert from 'node:assert/strict';
import {createDockFish,stepDockFish,DOCK_FISH_LOOKOUT,dockFishTarget} from './DockFish.js';
const boat={position:{x:50,z:50},speed:0};
test('fish gather for a quiet visitor, scatter when rushed, then return',()=>{
 const s=createDockFish(),j={mode:'walking',position:DOCK_FISH_LOOKOUT};
 for(let i=0;i<180;i++)stepDockFish(s,j,boat,.05);
 assert.ok(s.interest>.98);
 j.running=true;for(let i=0;i<20;i++)stepDockFish(s,j,boat,.05);
 assert.ok(s.interest<.06);assert.equal(s.fright,3.5);
 j.running=false;for(let i=0;i<260;i++)stepDockFish(s,j,boat,.05);
 assert.ok(s.interest>.98);
});
test('pause freezes fish, boats do not attract them, and fish stay below water',()=>{
 const s=createDockFish(),j={mode:'aboard',position:DOCK_FISH_LOOKOUT};
 for(let i=0;i<100;i++)stepDockFish(s,j,boat,.05);
 assert.equal(s.interest,0);const before={...s};stepDockFish(s,j,boat,1,true);assert.deepEqual(s,before);
 for(let i=0;i<12;i++)assert.ok(dockFishTarget(s,i).y<-.4);
});
test('school swimming is independent of render frame rate',()=>{
 const j={mode:'walking',position:DOCK_FISH_LOOKOUT};
 const slow=createDockFish(),fast=createDockFish();
 for(let i=0;i<300;i++)stepDockFish(slow,j,boat,1/30);
 for(let i=0;i<1200;i++)stepDockFish(fast,j,boat,1/120);
 for(let i=0;i<12;i++) {
  assert.ok(Math.abs(slow.fish[i].x-fast.fish[i].x)<1e-9);
  assert.ok(Math.abs(slow.fish[i].z-fast.fish[i].z)<1e-9);
 }
});
test('fish retain spacing and swim forward without snapping as the patch changes',()=>{
 const s=createDockFish(),j={mode:'walking',position:DOCK_FISH_LOOKOUT};
 for(let frame=0;frame<1800;frame++) {
  const old=s.fish.map(f=>({...f}));stepDockFish(s,j,boat,1/60);
  for(let i=0;i<12;i++) {
   const f=s.fish[i],p=old[i];
   assert.ok(Math.hypot(f.x-p.x,f.z-p.z)<.015);
   assert.ok(Math.abs(Math.atan2(Math.sin(f.heading-p.heading),Math.cos(f.heading-p.heading)))<.03 || frame===0);
   for(let k=i+1;k<12;k++)assert.ok(Math.hypot(f.x-s.fish[k].x,f.z-s.fish[k].z)>.4);
  }
 }
});
test('a disturbance sends the school away from its source',()=>{
 const s=createDockFish(),j={mode:'walking',position:DOCK_FISH_LOOKOUT};
 for(let i=0;i<600;i++)stepDockFish(s,j,boat,1/60);
 const distance=()=>s.fish.reduce((sum,f)=>sum+Math.hypot(f.x-j.position.x,f.z-j.position.z),0)/12;
 const before=distance();j.running=true;
 for(let i=0;i<120;i++)stepDockFish(s,j,boat,1/60);
 assert.ok(distance()>before+1);
});
