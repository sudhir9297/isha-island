import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalVisibility,stepPortalVisibility} from './PortalVisibility.js';
test('either approach fades the portal, holds after departure, and restores it',()=>{
 for(const side of [-1,1]){
  const state=createPortalVisibility(),j={resetId:0,mode:'walking',position:{x:0,z:-12.35+side},released:false};
  for(let i=0;i<8;i++)stepPortalVisibility(state,j,-12.35,.05);
  assert.ok(Math.abs(state.opacity-.18)<1e-6);
  j.position.z=-12.35+side*4;
  for(let i=0;i<40;i++)stepPortalVisibility(state,j,-12.35,.05);
  assert.equal(state.opacity,.18);
  stepPortalVisibility(state,j,-12.35,10,true);assert.equal(state.opacity,.18);
  for(let i=0;i<40;i++)stepPortalVisibility(state,j,-12.35,.05);
  assert.equal(state.opacity,1);
 }
});
test('relief stays visible away from threshold; reset restores opaque portal',()=>{
 const state=createPortalVisibility(),j={resetId:0,mode:'walking',position:{x:3,z:-16},released:true,releaseTime:1};
 for(let i=0;i<8;i++)stepPortalVisibility(state,j,-12.35,.05);
 assert.ok(state.opacity<.19);
 j.resetId=1;j.released=false;j.mode='aboard';
 assert.equal(stepPortalVisibility(state,j,-12.35,.05),1);
});
