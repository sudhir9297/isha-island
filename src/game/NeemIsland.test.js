import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { NEEM_ISLAND, neemRadiusAt, neemTerrainHeight, hitsNeemProps } from './NeemTerrain.js';
import { islandCollision } from './IslandCollider.js';
import { islandCenterAt, islandGroundAt } from './IslandGround.js';
import { seabedHeightAt } from './Seabed.js';
import { walkingSurfaceHeight } from './WalkingSurface.js';
import { createJourney, stepJourney } from './JourneyState.js';
import { snapshotJourney, parseJourneySave, restoreJourney } from './JourneySave.js';

test('Neem Point is dry land with open sailing channels on both sides', () => {
  const {x,z}=NEEM_ISLAND;
  assert.equal(islandCenterAt(x,z),NEEM_ISLAND);
  assert.equal(islandCollision({x,z}),true);
  assert.ok(seabedHeightAt(x,z)>.5);
  assert.equal(walkingSurfaceHeight(x,z),neemTerrainHeight(x,z));
  for (const [u,v] of [[32,-30],[95,-65]]) {
    assert.equal(islandCollision({x:u,z:v}),false);
    assert.ok(seabedHeightAt(u,v)<-2);
    assert.equal(walkingSurfaceHeight(u,v),null);
  }
});
test('Neem Point supports landing, walking, save/restore and boarding', () => {
  const boat={position:new Vector3(NEEM_ISLAND.x-9,0,NEEM_ISLAND.z),heading:0,speed:0,resetId:0,boatId:'skiff'};
  const s=createJourney();stepJourney(s,boat,{interact:true},1/60);
  assert.equal(s.mode,'walking');assert.ok(neemRadiusAt(s.position.x,s.position.z)<.94);
  const start=s.position.clone();
  for(let i=0;i<45;i++)stepJourney(s,boat,{right:true},1/60);
  assert.ok(s.position.distanceTo(start)>.5);
  assert.equal(s.position.y,islandGroundAt(s.position.x,s.position.z));
  const saved=parseJourneySave(JSON.stringify(snapshotJourney(boat,s)));
  assert.ok(saved);
  const restored=createJourney();restoreJourney(saved,boat,restored);
  assert.ok(restored.position.distanceTo(s.position)<1e-6);
  restored.position.copy(restored.landing);stepJourney(restored,boat,{interact:true},1/60);
  assert.equal(restored.mode,'aboard');
});
test('Neem trunk and bench block walking while the approach stays clear', () => {
  assert.equal(hitsNeemProps(64.2,-48.65),true);
  assert.equal(hitsNeemProps(67.2,-47.4),true);
  assert.equal(hitsNeemProps(61,-46),false);
});
