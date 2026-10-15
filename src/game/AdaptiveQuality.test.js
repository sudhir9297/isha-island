import test from 'node:test';
import assert from 'node:assert/strict';
import {createQualityMonitor, sampleQuality, resetQualityWindow} from './AdaptiveQuality.js';
function run(state, fps, seconds, quality) {
  for(let i=0;i<fps*seconds;i++) { const result=sampleQuality(state,1/fps,quality); if(result)return result; }
  return null;
}
test('slow sustained frames reduce quality; warmup and short spikes do not', () => {
  const state=createQualityMonitor();
  assert.equal(run(state,30,10,'high'),null);
  assert.equal(run(state,30,7,'high'),'balanced');
  assert.equal(run(state,120,29,'balanced'),null);
});
test('restoration needs sustained headroom, not ordinary 60 FPS', () => {
  const state=createQualityMonitor();
  assert.equal(run(state,60,60,'balanced'),null);
  assert.equal(run(state,120,19,'balanced'),'high');
});
test('hidden/resume resets and invalid samples cannot trigger a downgrade', () => {
  const state=createQualityMonitor(); state.warmup=0;
  run(state,30,7,'high');
  for(const delta of [NaN,Infinity,-1,0,2]) assert.equal(sampleQuality(state,delta,'high'),null);
  assert.equal(run(state,30,7,'high'),null);
  resetQualityWindow(state);
  assert.equal(state.bad,0); assert.equal(state.frames,0);
});
