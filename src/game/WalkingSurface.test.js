import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { DOCK, dockWorldPoint, walkingSurfaceHeight } from './WalkingSurface.js';
import { createJourney, stepJourney } from './JourneyState.js';
import { snapshotJourney, parseJourneySave, restoreJourney } from './JourneySave.js';

const boat = () => ({position:new Vector3(25,0,25),speed:0,resetId:0,boatId:'skiff'});
function walkTo(s, b, target) {
  for (let i=0;i<600;i++) {
    const dx=target.x-s.position.x,dz=target.z-s.position.z;
    if(Math.hypot(dx,dz)<0.09)return;
    const screenX=dx*.894+dz*.447, screenZ=-dx*.447+dz*.894;
    const controls = Math.abs(screenX)>Math.abs(screenZ)
      ? {right:screenX>0,left:screenX<0} : {backward:screenZ>0,forward:screenZ<0};
    stepJourney(s,b,controls,.025);
  }
  assert.fail(`Player stopped at ${s.position.x}, ${s.position.z}; target ${target.x}, ${target.z}`);
}
test('player can walk from beach to the last dock plank and back',()=>{
  const s=createJourney(),b=boat();s.mode='walking';
  const beach=dockWorldPoint(0,-2.3),end=dockWorldPoint(0,5.95);
  s.position.set(beach.x,walkingSurfaceHeight(beach.x,beach.z),beach.z);
  for(let z=-2.05;z<5.95;z+=0.25) walkTo(s,b,dockWorldPoint(0,z));
  walkTo(s,b,end);
  assert.ok(Math.abs(s.position.y-DOCK.deckHeight)<1e-9);
  for(let z=5.7;z>-2.3;z-=0.25) walkTo(s,b,dockWorldPoint(0,z));
  walkTo(s,b,beach);
});
test('dock has no walkable surface past the end or outside the rails over water',()=>{
  for(const [x,z] of [[0,6.25],[1.3,4],[-1.3,4]]) {
    const p=dockWorldPoint(x,z);assert.equal(walkingSurfaceHeight(p.x,p.z),null);
  }
});
test('saved player on the dock resumes on the planks',()=>{
  const s=createJourney(),b=boat();s.mode='walking';s.landing.set(0,.4,-6);
  const end=dockWorldPoint(0,5.95);s.position.set(end.x,DOCK.deckHeight,end.z);
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,s)));
  assert.ok(data);
  const restored=createJourney();restoreJourney(data,b,restored);
  assert.equal(restored.mode,'walking');assert.equal(restored.position.y,DOCK.deckHeight);
  assert.equal(restored.position.z,end.z);
});

test('slow boats can step directly onto either side of the dock and resume there', async()=>{
  const {landingPoint}=await import('./JourneyState.js');
  for(const across of [-2.8,2.8]) {
    const b=boat(),p=dockWorldPoint(across,4.8);b.position.set(p.x,0,p.z);b.heading=0;
    const landing=landingPoint(b);assert.ok(landing);assert.equal(landing.y,DOCK.deckHeight);
    assert.equal(walkingSurfaceHeight(landing.x,landing.z),DOCK.deckHeight);
    const s=createJourney();stepJourney(s,b,{interact:true},.025);
    assert.equal(s.mode,'walking');
    assert.ok(parseJourneySave(JSON.stringify(snapshotJourney(b,s))));
    b.speed=2;assert.equal(landingPoint(b),null);
  }
});
test('letter is centered across the dock at its outer end', async()=>{
  const {DOCK_NOTE}=await import('./Discoveries.js');
  assert.deepEqual(DOCK_NOTE,dockWorldPoint(0,DOCK.end-.35));
  assert.equal(walkingSurfaceHeight(DOCK_NOTE.x,DOCK_NOTE.z),DOCK.deckHeight);
});
