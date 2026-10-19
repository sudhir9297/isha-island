import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createJourney, stepJourney } from './JourneyState.js';
import { DOCK_NOTE, SHELL, nearbyDiscovery } from './Discoveries.js';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';
import { parseJourneySave, snapshotJourney, restoreJourney } from './JourneySave.js';
const boat=()=>({position:new Vector3(25,0,25),speed:0,resetId:0,boatId:'skiff'});
test('note interaction takes priority, holds walking, and closes without boarding',()=>{
  const s=createJourney(),b=boat();s.mode='walking';s.position.set(DOCK_NOTE.x,.595,DOCK_NOTE.z);s.landing.copy(s.position);
  stepJourney(s,b,{interact:true},.05);assert.equal(s.noteRead,true);assert.equal(s.activeDiscovery,'note');assert.equal(s.mode,'walking');
  const p=s.position.clone();stepJourney(s,b,{forward:true},.05);assert.deepEqual(s.position,p);
  stepJourney(s,b,{interact:true},.05);assert.equal(s.activeDiscovery,null);assert.equal(s.mode,'walking');assert.equal(nearbyDiscovery(s),null);
});
test('shell is only interactable after uncovering, and records once',()=>{
  const s=createJourney(),b=boat();s.mode='walking';s.position.set(SHELL.x,.2,SHELL.z);
  assert.equal(nearbyDiscovery(s),null);s.shellRevealed=true;
  stepJourney(s,b,{interact:true},.05);assert.equal(s.shellFound,true);assert.equal(s.activeDiscovery,'shell');
  s.dismissDiscovery=true;stepJourney(s,b,{},.05);assert.equal(nearbyDiscovery(s),null);
});
test('crab waits for a greeting, then guides and waits when the player falls behind',()=>{
  const crab=createCrabBehavior(),guide={enabled:true,invited:false,running:true,x:SHELL.x,z:SHELL.z+12};
  const start={x:crab.x,z:crab.z};
  for(let i=0;i<100;i++)stepCrab(crab,{x:crab.x+.5,z:crab.z},.05,false,guide);
  assert.equal(crab.mode,'wave');assert.equal(crab.x,start.x);assert.equal(crab.uncovered,false);
  guide.invited=true;
  stepCrab(crab,{x:30,z:30},.05,false,guide);
  assert.equal(crab.mode,'wave');assert.equal(crab.speed,0);
  for(let i=0;i<400;i++)stepCrab(crab,{x:crab.x+.5,z:crab.z},.05,false,guide);
  assert.equal(crab.uncovered,true);assert.ok(Math.hypot(crab.x-guide.x,crab.z-guide.z)<.18);
});
test('greeting is explicit, cannot collect the shell, and keeps movement paused for its card',()=>{
  const s=createJourney(),b=boat();s.mode='walking';s.noteRead=true;
  s.position.set(-.8,.3,-6);s.crabPosition={x:-.8,z:-6};
  assert.equal(nearbyDiscovery(s),'crab');
  stepJourney(s,b,{interact:true},.05);
  assert.equal(s.activeDiscovery,'crab');assert.equal(s.crabInvited,true);assert.equal(s.shellFound,false);
  const position=s.position.clone();stepJourney(s,b,{forward:true},.05);assert.deepEqual(s.position,position);
  s.dismissDiscovery=true;stepJourney(s,b,{},.05);assert.equal(s.activeDiscovery,null);assert.equal(nearbyDiscovery(s),null);
  s.crabInvited=false;s.noteRead=false;assert.equal(nearbyDiscovery(s),null);
});
test('ordinary crab wandering cannot unlock the discovery',()=>{
  const crab=createCrabBehavior();for(let i=0;i<2000;i++)stepCrab(crab,null,.05);
  assert.equal(crab.uncovered,false);
});
test('discoveries persist, old saves remain valid, and new journeys clear them',()=>{
  const b=boat(),s=createJourney();s.noteRead=true;s.crabInvited=true;s.shellRevealed=true;s.shellFound=true;
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,s)));assert.ok(data);
  const restored=createJourney();restoreJourney(data,b,restored);
  assert.equal(restored.noteRead,true);assert.equal(restored.crabInvited,true);assert.equal(restored.shellFound,true);assert.equal(restored.activeDiscovery,null);
  delete data.journey.noteRead;delete data.journey.shellFound;delete data.journey.shellRevealed;
  restoreJourney(data,b,restored);assert.equal(restored.noteRead,false);assert.equal(restored.shellFound,false);
  assert.equal(createJourney().shellRevealed,false);
});
