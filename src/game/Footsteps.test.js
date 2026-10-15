import test from 'node:test';
import assert from 'node:assert/strict';
import {crossedFootfall,footstepSamples} from './Footsteps.js';
test('footfalls follow traveled distance without firing when stationary or reset',()=>{
 assert.equal(crossedFootfall(0,.2),false);
 assert.equal(crossedFootfall(.5,.6),true);
 assert.equal(crossedFootfall(.5,.5),false);
 assert.equal(crossedFootfall(8,0),false);
});
test('sand steps fade cleanly and burdened steps last longer without clipping',()=>{
 const light=footstepSamples(48000,false), heavy=footstepSamples(48000,true);
 assert.ok(heavy.length>light.length);
 for(const samples of [light,heavy]){
  assert.equal(samples[0],0);
  assert.ok(Math.abs(samples.at(-1))<.001);
  assert.ok(samples.every(v=>Number.isFinite(v)&&Math.abs(v)<1));
 }
});
