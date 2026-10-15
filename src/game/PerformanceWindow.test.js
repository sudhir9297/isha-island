import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceWindow,recordFrame,summarizeFrames} from './PerformanceWindow.js';
test('frame window retains spikes and evicts old samples with bounded storage',()=>{
 const window=createPerformanceWindow(4);
 for(const ms of [10,10,10,100])recordFrame(window,ms/1000);
 assert.equal(summarizeFrames(window).p95Ms,100);
 assert.equal(summarizeFrames(window).over33Ms,1);
 for(let i=0;i<4;i++)recordFrame(window,.016);
 assert.equal(summarizeFrames(window).maxMs,16);
 assert.equal(summarizeFrames(window).samples,4);
 recordFrame(window,NaN);assert.equal(summarizeFrames(window).samples,4);
});
