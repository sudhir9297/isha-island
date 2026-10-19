import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberHint, restoreHints, journeyObjective } from './MessageFlow.js';
import {createJourney} from './JourneyState.js';
import {snapshotJourney,restoreJourney} from './JourneySave.js';
import {Vector3} from 'three';
test('guidance remains consumed after interruptions and save/resume', () => {
 const s=createJourney(), boat={position:new Vector3(25,0,25),resetId:0,boatId:'rowboat'};
 assert.equal(rememberHint(s.seenHints,'Follow the crab'),true);
 assert.equal(rememberHint(s.seenHints,'Your guide is waiting'),true);
 assert.equal(rememberHint(s.seenHints,'Follow the crab'),false);
 s.noteRead=true;s.crabInvited=true;
 const saved=snapshotJourney(boat,s),restored=createJourney();
 restoreJourney(saved,boat,restored);
 assert.equal(restored.crabInvited,true);
 assert.equal(rememberHint(restored.seenHints,'Follow the crab'),false);
 assert.deepEqual(createJourney().seenHints,[]);
});
test('objective advances through discoveries rather than sending the player to the gate early', () => {
 const s={mode:'walking'};
 assert.match(journeyObjective(s),/letter/);
 s.noteRead=true;assert.match(journeyObjective(s),/crab/);
 s.crabInvited=true;assert.match(journeyObjective(s),/guide/);
 s.shellRevealed=true;assert.match(journeyObjective(s),/shell/);
 s.shellFound=true;assert.match(journeyObjective(s),/Malai Vasal/);
 s.released=true;assert.match(journeyObjective(s),/quiet/);
 s.completed=true;assert.match(journeyObjective(s),/own pace/);
});
test('old and malformed hint history remains safe',()=>{
 assert.deepEqual(restoreHints(undefined),[]);
 assert.deepEqual(restoreHints(['hello','hello',null,{},'x'.repeat(201)]),['hello']);
});

test('a returning shell collector proceeds to the gate after the letter', () => {
  assert.equal(journeyObjective({mode:'walking',noteRead:true,shellFound:true,crabInvited:false}), 'Walk through Malai Vasal');
});
