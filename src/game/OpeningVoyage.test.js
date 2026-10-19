import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { START, OPENING_APPROACH } from './WorldConfig.js';
import { navigationControls, stepBoatFrame } from './BoatPhysics.js';
import { snapshotJourney, parseJourneySave, restoreJourney } from './JourneySave.js';
import { createJourney } from './JourneyState.js';
const boat = () => ({ position: new Vector3(START.x,0,START.z), heading:START.heading, speed:0, resetId:0, boatId:'skiff', openingVoyage:true, destination:new Vector3(OPENING_APPROACH.x,0,OPENING_APPROACH.z) });
test('opening cruises slowly from open sea and stops safely before Malai Vasal', () => {
  for(const boatId of ['skiff','runabout','workboat']) {
    const b=boat(); b.boatId=boatId;
    let peak=0;
    for(let frame=0;frame<60*45;frame++) {
      stepBoatFrame(b,navigationControls(b,{},1/60),1/60,false,frame/60);
      peak=Math.max(peak,b.speed);
      assert.ok(!b.beached && !b.collided, `clear approach for ${boatId}`);
    }
    assert.ok(peak<2);
    assert.ok(b.position.distanceTo(new Vector3(OPENING_APPROACH.x,0,OPENING_APPROACH.z))<1);
    assert.equal(b.destination,null);
    assert.equal(b.openingVoyage,false);
    assert.ok(Math.abs(b.speed)<.03);
  }
});
test('manual steering or braking cancels the story approach immediately', () => {
  for(const key of ['forward','backward','left','right','brake']) {
    const b=boat(), manual={[key]:true};
    assert.equal(navigationControls(b,manual,1/60),manual);
    assert.equal(b.destination,null); assert.equal(b.openingVoyage,false);
  }
});
test('save resumes an unfinished opening without restarting at sea', () => {
  const b=boat();b.position.z=30;
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,createJourney())));
  const restored=boat();restoreJourney(data,restored,createJourney());
  assert.equal(restored.position.z,30);assert.equal(restored.openingVoyage,true);
  assert.equal(restored.destination.z,OPENING_APPROACH.z);
  delete data.boat.openingVoyage;
  restoreJourney(data,restored,createJourney());
  assert.equal(restored.position.z,30);assert.equal(restored.destination,null);
});
test('paused opening holds position and speed', () => {
  const b=boat();const initial=b.position.clone();
  for(let i=0;i<120;i++)stepBoatFrame(b,{},1/60,true,i/60);
  assert.deepEqual(b.position,initial);assert.equal(b.speed,0);
  assert.equal(b.openingVoyage,true);
});
