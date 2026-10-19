import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {NEEM_SEAT_EXIT,NEEM_SEAT,stepNeemSeat} from './NeemSeat.js';
import {createJourney} from './JourneyState.js';
import {snapshotJourney,parseJourneySave,restoreJourney} from './JourneySave.js';
import {hitsNeemProps} from './NeemTerrain.js';
test('bench sits explicitly and movement exits to clear ground without completing the chapter',()=>{
 const s=createJourney();s.mode='walking';s.position.set(NEEM_SEAT_EXIT.x,0,NEEM_SEAT_EXIT.z);
 assert.equal(stepNeemSeat(s,false,{},.05),false);
 assert.equal(stepNeemSeat(s,true,{},.05),true);assert.equal(s.benchSeated,true);assert.equal(s.position.x,NEEM_SEAT.x);
 stepNeemSeat(s,false,{},1);assert.equal(s.seatTime,1);assert.equal(s.completed,false);assert.equal(s.released,false);
 stepNeemSeat(s,false,{forward:true},.05);assert.equal(s.benchSeated,false);assert.equal(hitsNeemProps(s.position.x,s.position.z),false);
});
test('saving from the bench resumes standing safely in front of it',()=>{
 const s=createJourney(),boat={position:new Vector3(70,0,-40),boatId:'skiff',heading:0,resetId:0};
 s.mode='walking';s.position.set(NEEM_SEAT_EXIT.x,0,NEEM_SEAT_EXIT.z);s.landing.copy(s.position);stepNeemSeat(s,true,{},.05);
 const data=parseJourneySave(JSON.stringify(snapshotJourney(boat,s)));assert.ok(data);
 const restored=createJourney();restoreJourney(data,boat,restored);assert.equal(restored.benchSeated,false);assert.equal(restored.position.z,NEEM_SEAT_EXIT.z);
});
