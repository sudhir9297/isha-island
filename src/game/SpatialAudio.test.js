import test from 'node:test';
import assert from 'node:assert/strict';
import {ambientMix, positionAudio, spatialPanner} from './SpatialAudio.js';
test('surf stays bounded and relief gently reduces it',()=>{
  for(let x=-30;x<30;x+=2)for(let z=-30;z<20;z+=2){
    const normal=ambientMix(x,z,false).surf, relief=ambientMix(x,z,true).surf;
    assert.ok(normal>=.065&&normal<=.19); assert.ok(relief<normal);
  }
});
test('spatial nodes use distance falloff and smooth world-position changes',()=>{
  const calls=[], param=()=>({value:0,setTargetAtTime:(...args)=>calls.push(args)});
  const node={positionX:param(),positionY:param(),positionZ:param(),connect:target=>calls.push(target)};
  const destination={};
  assert.equal(spatialPanner({createPanner:()=>node},destination,{x:1,y:2,z:3}),node);
  assert.equal(node.positionZ.value,3); assert.equal(node.panningModel,'HRTF'); assert.equal(node.rolloffFactor,1);
  positionAudio(node,{x:4,y:5,z:6},10);
  assert.deepEqual(calls.slice(1),[[4,10,.08],[5,10,.08],[6,10,.08]]);
});
