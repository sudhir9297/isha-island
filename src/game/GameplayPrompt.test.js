import test from 'node:test';
import assert from 'node:assert/strict';
import { selectGameplayPrompt } from './GameplayPrompt.js';
const pick = (journey = {}, other = {}) => selectGameplayPrompt({journey:{mode:'aboard',...journey},telemetry:{},showHint:true,nearbyPlace:'Harbour',...other});
test('recovery occupies the sole prompt ahead of landing, hints and nearby notices',()=>{
 assert.deepEqual(pick({canLand:true},{telemetry:{beached:true,beachedTime:2.1}}),{action:'reset',key:'R',label:'Reset to water',detail:'Automatic return in 3s'});
});
test('on-foot discovery wins over a grounded boat, boarding and rest',()=>{
 assert.equal(pick({mode:'walking',nearDiscovery:'note',nearBoat:true,nearRest:true,releaseTime:8},{telemetry:{beached:true}}).label,'Discover');
 assert.equal(pick({mode:'walking',nearBoat:true},{telemetry:{beached:true}}).label,'Board boat');
});
test('resting and shore actions win over passive guidance',()=>{
 assert.equal(pick({mode:'resting',nearRest:true}).label,'Continue exploring');
 assert.equal(pick({mode:'walking',nearRest:true,releaseTime:8,nearBoat:true}).label,'Pause by the sea');
 assert.equal(pick({canLand:true}).label,'Step ashore');
});
test('menus, discovery cards and map mode suppress gameplay prompts',()=>{
 assert.equal(pick({canLand:true},{paused:true}),null);
 assert.equal(pick({canLand:true},{freeCamera:true}),null);
 assert.equal(pick({activeDiscovery:'note'}),null);
});
test('falls back to one hint with correct walking touch instructions',()=>{
 assert.equal(pick({mode:'walking'},{nearbyPlace:null,touch:true}).label,'Use the arrows to walk · Tap Jump to hop');
 assert.equal(pick({},{nearbyPlace:null,showHint:false}),null);
});
