import test from 'node:test';
import assert from 'node:assert/strict';
import {createShellReveal,stepShellReveal,shellRevealPose,SHELL_REVEAL_DURATION} from './ShellReveal.js';
test('live reveal emits once, pauses, settles, and never replays a loaded discovery',()=>{
 const journey={shellRevealed:false,resetId:0},state=createShellReveal(journey);
 journey.shellRevealed=true;
 assert.equal(stepShellReveal(state,journey,.016,false,false),true);
 const time=state.time;assert.equal(stepShellReveal(state,journey,.05,true,false),false);assert.equal(state.time,time);
 for(let i=0;i<80;i++)assert.equal(stepShellReveal(state,journey,.016,false,false),false);
 assert.deepEqual(shellRevealPose(state.time),{height:0,scale:1,burst:0});
 const loaded=createShellReveal(journey);assert.equal(stepShellReveal(loaded,journey,.05,false,false),false);
 journey.resetId++;assert.equal(stepShellReveal(state,journey,.05,false,false),false);assert.equal(state.time,SHELL_REVEAL_DURATION);
});
test('reduced motion keeps a static full-size shell but still emits discovery once',()=>{
 const journey={shellRevealed:false,resetId:0},state=createShellReveal(journey);journey.shellRevealed=true;
 assert.equal(stepShellReveal(state,journey,.05,false,true),true);
 assert.deepEqual(shellRevealPose(state.time),{height:0,scale:1,burst:0});
});
test('reveal stays bounded and lands without a size jump',()=>{
 for(let t=0;t<=1;t+=.005){const pose=shellRevealPose(t);assert.ok(pose.height>=0&&pose.height<=.38);assert.ok(pose.scale>=.65&&pose.scale<=1);assert.ok(pose.burst>=0&&pose.burst<=1);}
 assert.ok(shellRevealPose(.899).height<.001);
});
