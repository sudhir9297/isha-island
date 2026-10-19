import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapTransition, stepMapTransition, mapFocusBlend, blendMapZoom } from './MapCamera.js';
test('two-second transition starts gently, settles exactly and is frame-rate independent', () => {
 const run = (hz, seconds) => { const s=createMapTransition();for(let i=0;i<hz*seconds;i++)stepMapTransition(s,true,1/hz);return s.value; };
 assert.ok(Math.abs(run(30,1)-run(120,1))<1e-12);
 assert.ok(Math.abs(run(60,1)-.5)<1e-12);
 assert.ok(run(60,.1)<.002);assert.equal(run(60,2),1);
 assert.ok(mapFocusBlend(.5)<.5);assert.equal(mapFocusBlend(1),1);
});
test('interruptions preserve position and reduced motion settles both directions immediately', () => {
 const s=createMapTransition();for(let i=0;i<60;i++)stepMapTransition(s,true,1/60);
 const mid=s.value;assert.equal(stepMapTransition(s,false,0),mid);
 assert.ok(stepMapTransition(s,false,.1)<mid);
 for(let i=0;i<120;i++)stepMapTransition(s,false,1/60);
 assert.equal(s.value,0);
 assert.equal(stepMapTransition(s,true,0,true),1);
 assert.equal(stepMapTransition(s,false,0,true),0);
});
test('overview reserves room for controls in portrait and landscape and restores player scale', () => {
 for(const [w,h] of [[390,844],[1440,900]]) {
  const zoom=blendMapZoom(30,w,h,210,1);
  assert.ok(210*zoom<=w*.84+.001);assert.ok(210*zoom<=h*.72+.001);
  assert.ok(Math.abs(blendMapZoom(30,w,h,210,0)-30)<1e-10);
  const half=blendMapZoom(30,w,h,210,.5);assert.ok(half>zoom&&half<30);
 }
});
