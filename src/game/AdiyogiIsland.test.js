import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { ADIYOGI_ISLAND, adiyogiRadiusAt } from './AdiyogiTerrain.js';
import { islandCollision } from './IslandCollider.js';
import { seabedHeightAt, worldCoastalRadiusAt } from './Seabed.js';
import { createJourney, stepJourney } from './JourneyState.js';
import { islandGroundAt } from './IslandGround.js';
import { snapshotJourney, parseJourneySave, restoreJourney } from './JourneySave.js';
import { stepBoat, resetBoatToWater } from './BoatPhysics.js';

const boat = (x = ADIYOGI_ISLAND.x - 31) => ({position:new Vector3(x,0,ADIYOGI_ISLAND.z),heading:0,speed:0,resetId:0,boatId:'skiff'});
test('both islands reject sailing targets, with clear water between them', () => {
  assert.equal(islandCollision({x:0,z:-12}), true);
  assert.equal(islandCollision(ADIYOGI_ISLAND), true);
  assert.equal(islandCollision({x:19,z:-18}), false);
  assert.ok(seabedHeightAt(ADIYOGI_ISLAND.x,ADIYOGI_ISLAND.z) > .5);
  assert.ok(seabedHeightAt(19,-18) < -1);
  assert.ok(seabedHeightAt(ADIYOGI_ISLAND.x + 41,ADIYOGI_ISLAND.z) < -2);
});
test('traveler can land, walk, save, resume and board on Adiyogi island', () => {
  const b=boat(), s=createJourney();
  stepJourney(s,b,{interact:true},1/60);
  assert.equal(s.mode,'walking');
  assert.ok(adiyogiRadiusAt(s.position.x,s.position.z)<.94);
  const landing=s.position.clone();
  for(let i=0;i<90;i++)stepJourney(s,b,{right:true},1/60);
  assert.ok(s.position.distanceTo(landing)>1);
  assert.equal(s.released,false);
  assert.equal(s.position.y,islandGroundAt(s.position.x,s.position.z));
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,s)));
  assert.ok(data);
  const restored=createJourney();restoreJourney(data,b,restored);
  assert.ok(restored.position.distanceTo(s.position)<1e-6);
  restored.position.copy(restored.landing);
  stepJourney(restored,b,{interact:true},1/60);
  assert.equal(restored.mode,'aboard');
});
test('boats contact the new shelf and reset to actual water', () => {
  const b=boat(ADIYOGI_ISLAND.x - 36); b.heading=-Math.PI/2;
  b.safeWater={x:ADIYOGI_ISLAND.x - 36,z:ADIYOGI_ISLAND.z,heading:b.heading};
  let contacted=false;
  for(let i=0;i<240;i++){
    stepBoat(b,{forward:true},1/60);
    contacted ||= Boolean(b.collided||b.beached);
  }
  assert.equal(contacted,true);
  assert.ok(adiyogiRadiusAt(b.position.x,b.position.z)>.9);
  resetBoatToWater(b);
  assert.ok(seabedHeightAt(b.position.x,b.position.z)<-.65);
  assert.ok(worldCoastalRadiusAt(b.position.x,b.position.z)>1.1);
});
test('saved east-coast positions beyond the old world extent survive reload', () => {
  const b=boat(ADIYOGI_ISLAND.x + 39),s=createJourney();
  const data=parseJourneySave(JSON.stringify(snapshotJourney(b,s)));
  assert.ok(data);assert.equal(data.boat.x,ADIYOGI_ISLAND.x + 39);
  data.boat.safeWater={x:ADIYOGI_ISLAND.x,z:ADIYOGI_ISLAND.z,heading:0};data.boat.x=ADIYOGI_ISLAND.x;
  const recovered=parseJourneySave(JSON.stringify(data));
  assert.notEqual(recovered.boat.x,ADIYOGI_ISLAND.x);
});
