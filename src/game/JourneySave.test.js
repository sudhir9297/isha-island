import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createJourney} from './JourneyState.js';
import {snapshotJourney,parseJourneySave,restoreJourney} from './JourneySave.js';
const boat=()=>({position:new Vector3(-13,0,-4),heading:1,speed:3,resetId:0,boatId:'skiff'});
test('resume preserves release and completion without replaying the checkpoint',()=>{
  const b=boat(),s=createJourney();
  Object.assign(s,{mode:'resting',released:true,completed:true,releaseTime:1,releaseOrigin:{x:0,y:2,z:-12.8}});
  s.position.set(0,1,-18.2);s.landing.set(0,1,-8);
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,s)));assert.ok(data);
  const resumed=createJourney();restoreJourney(data,b,resumed);
  assert.equal(resumed.mode,'resting');assert.equal(resumed.releaseTime,8);assert.equal(resumed.restTime,8);
  assert.equal(resumed.completed,true);assert.equal(b.speed,0);assert.equal(b.destination,null);
  assert.equal(resumed.releaseOrigin.z,-12.8);
});
test('malformed and unsafe walking saves are rejected; unsafe boats recover to water',()=>{
  for(const raw of ['bad','null','{}','{"version":99}'])assert.equal(parseJourneySave(raw),null);
  const b=boat(),s=createJourney(),data=snapshotJourney(b,s);
  data.boat.x=0;data.boat.z=-12;
  const safe=parseJourneySave(JSON.stringify(data));assert.ok(safe);assert.equal(safe.boat.x,-13);
  data.journey.mode='walking';data.journey.position={x:70,z:70};assert.equal(parseJourneySave(JSON.stringify(data)),null);
  data.journey.position={x:4,z:-12};assert.equal(parseJourneySave(JSON.stringify(data)),null);
});
test('beached boat resumes at saved water when aboard and stays parked while walking',()=>{
  const b=boat(),s=createJourney();b.beached=true;b.position.set(0,1,-8);b.safeWater={x:-15,z:0,heading:2};
  assert.equal(snapshotJourney(b,s).boat.x,-15);
  s.mode='walking';assert.equal(snapshotJourney(b,s).boat.z,-8);
});
