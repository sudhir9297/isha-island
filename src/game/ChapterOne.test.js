import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createChapterOne, restoreChapterOne } from './ChapterOne.js';
import { createJourney, landingPoint, stepJourney } from './JourneyState.js';
import { START, OPENING_APPROACH } from './WorldConfig.js';
import { navigationControls, stepBoatFrame } from './BoatPhysics.js';
import { snapshotJourney,parseJourneySave,restoreJourney } from './JourneySave.js';
const boat=()=>({boatId:'rowboat',position:new Vector3(START.x,0,START.z),speed:0,heading:0,resetId:0,openingVoyage:true,destination:new Vector3(OPENING_APPROACH.x,0,OPENING_APPROACH.z)});
test('rowboat makes a slow safe arrival within stepping-ashore distance',()=>{
 const b=boat();let peak=0;
 for(let i=0;i<60*65;i++){stepBoatFrame(b,navigationControls(b,{},1/60),1/60,false,i/60);peak=Math.max(peak,b.speed);assert.ok(!b.beached);}
 assert.ok(peak<2.2);assert.ok(landingPoint(b));assert.equal(b.destination,null);
});
test('the gate crossing releases luggage and unlocks the motorboat',()=>{
 const b=boat(),s={...createJourney(),chapter:createChapterOne(),mode:'walking'};
 s.position.set(0,2.35,-10.8);s.landing.set(0,.1,-3.3);
 stepJourney(s,b,{},1/60);
 assert.equal(s.chapter.step,'gate');assert.equal(b.boatId,'rowboat');
 for(let i=0;i<20;i++)stepJourney(s,b,{forward:true},1/60);
 assert.equal(s.released,false);assert.equal(b.boatId,'rowboat');
 s.position.set(0,2.35,-10.8);s.gateEntered=false;
 for(let i=0;i<180&&!s.released;i++)stepJourney(s,b,{forward:true,left:i%3===0},1/60);
 assert.equal(s.released,true);assert.equal(s.releaseTime,0);
 assert.ok(s.releaseOrigin);assert.equal(s.chapter.step,'complete');assert.equal(b.boatId,'skiff');
 const next=createJourney();restoreJourney(parseJourneySave(JSON.stringify(snapshotJourney(b,s))),b,next);
 assert.equal(next.released,true);assert.equal(next.chapter.step,'complete');assert.equal(b.boatId,'skiff');
});
test('old volunteer saves restore carried luggage and the gate objective',()=>{
 const b=boat(),s={...createJourney(),chapter:{version:1,step:'deliver',bagsStowed:true},released:true,mode:'walking'};
 s.position.set(2.4,.1,-5.4);s.landing.set(0,.1,-3.3);
 const next=createJourney();restoreJourney(parseJourneySave(JSON.stringify(snapshotJourney(b,s))),b,next);
 assert.equal(next.chapter.step,'gate');assert.equal(next.chapter.version,2);
 assert.equal(next.released,false);assert.equal(next.releaseOrigin,null);assert.equal(b.boatId,'rowboat');
 assert.equal(next.position.z,next.landing.z);
 assert.equal(restoreChapterOne({version:2,step:'deliver'}),null);
});
