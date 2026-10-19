import {interactionTarget} from './InteractionTargets.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {availablePennant} from './BoatCosmetics.js';
import {soundscapeMix,SOUND_REGIONS} from './IslandSoundscape.js';
import {startCharacterAction,advanceCharacterAction,characterActionPose} from './CharacterAction.js';
test('only collected keepsakes unlock a valid pennant',()=>{
 assert.equal(availablePennant('leaf',[]),null);
 assert.equal(availablePennant('leaf',['leaf']),'leaf');
 assert.equal(availablePennant('invalid',['invalid']),null);
 assert.equal(availablePennant(null,['shell']),null);
});
test('island audio fades into open sea and silences on pause',()=>{
 SOUND_REGIONS.forEach((r,i)=>assert.equal(soundscapeMix(r)[i],1));
 assert.deepEqual(soundscapeMix({x:400,z:400}),[0,0,0]);
 assert.deepEqual(soundscapeMix(SOUND_REGIONS[0],true),[0,0,0]);
 const a=soundscapeMix({x:18,z:-7})[0],b=soundscapeMix({x:19,z:-7})[0];
 assert.ok(a>b&&a<1&&b>0);
});
test('pickup stops motion, faces the object, and ends once',()=>{
 const s={position:{x:0,z:0},velocityX:1,velocityZ:2,running:true};
 startCharacterAction(s,'pickup',{x:0,z:-1},'shell');
 assert.equal(s.velocityX,0);assert.equal(s.running,false);assert.equal(s.heading,0);
 advanceCharacterAction(s,.55);assert.ok(characterActionPose(s.action).drop>.2);
 advanceCharacterAction(s,.55);assert.equal(s.action,null);
 advanceCharacterAction(s,1);assert.equal(s.action,null);
});

test('interaction cue chooses one nearby target and hides during actions',()=>{
 const s={mode:'walking',position:{x:50,y:1,z:50},landing:{x:0,z:0},nearActivity:'bell'};
 assert.ok(interactionTarget(s));
 s.action={kind:'bell'};assert.equal(interactionTarget(s),null);
 s.action=null;s.activeDiscovery='note';assert.equal(interactionTarget(s),null);
 s.activeDiscovery=null;s.nearActivity=null;assert.equal(interactionTarget(s),null);
});
