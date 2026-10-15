import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_MARKERS, LUGGAGE_OFFSETS, validateWorldMarkers} from './WorldMarkers.js';
const fixture=()=>({version:1,space:'game-world-y-up',markers:structuredClone(WORLD_MARKERS)});
test('authored markers retain gate, spawn and arrival-side throws',()=>{
  assert.deepEqual(WORLD_MARKERS.spawn,[-13,0,-4]);
  assert.equal(WORLD_MARKERS.gateEntry[2],-11.4);
  assert.equal(WORLD_MARKERS.gateExit[2],-12.7);
  assert.ok(LUGGAGE_OFFSETS.every(([,z])=>z>0));
});
test('reject incomplete, non-finite, reversed and unsupported marker data',()=>{
  let data=fixture(); delete data.markers.spawn; assert.throws(()=>validateWorldMarkers(data));
  data=fixture(); data.markers.spawn[0]=Infinity; assert.throws(()=>validateWorldMarkers(data));
  data=fixture(); data.space='blender-z-up'; assert.throws(()=>validateWorldMarkers(data));
  data=fixture(); data.markers.gateExit[2]=0; assert.throws(()=>validateWorldMarkers(data));
  data=fixture(); data.markers.luggage0[2]=-20; assert.throws(()=>validateWorldMarkers(data));
});
