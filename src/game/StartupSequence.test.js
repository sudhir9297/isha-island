import test from 'node:test';
import assert from 'node:assert/strict';
import {createStartupSequence,stepStartupSequence} from './StartupSequence.js';
const advance=(s,seconds,reduced=false)=>{for(let i=0;i<Math.ceil(seconds*60);i++)stepStartupSequence(s,1/60,true,reduced);};
test('circle opens around the stationary traveler and gently zooms in',()=>{
 const s=createStartupSequence();stepStartupSequence(s,10,false);assert.equal(s.phase,'loading');
 advance(s,.8);assert.ok(s.radius>0&&s.radius<4.4);assert.ok(s.zoom>1&&s.zoom<1.5);assert.equal(s.offset,0);
 advance(s,1);assert.equal(s.phase,'waiting');assert.equal(s.radius,4.4);assert.equal(s.zoom,1.5);
 advance(s,3);assert.equal(s.phase,'waiting');s.startRequested=true;advance(s,3);
 assert.equal(s.phase,'complete');assert.equal(s.zoom,1);assert.equal(s.fade,1);
});
test('reduced motion and resume avoid zoom motion',()=>{
 for(const resume of [false,true]){const s=createStartupSequence({resume});advance(s,.3,!resume);assert.equal(s.phase,'waiting');assert.equal(s.zoom,1);s.startRequested=true;advance(s,.4,!resume);assert.equal(s.phase,'complete');}
});
test('skip settles the circle and shortens the expansion',()=>{
 const s=createStartupSequence();s.skipRequested=true;advance(s,.1);assert.equal(s.phase,'waiting');s.startRequested=true;advance(s,.4);assert.equal(s.phase,'complete');
});
test('hidden frames freeze progress and long gaps cannot skip the opening',()=>{
 const s=createStartupSequence();stepStartupSequence(s,100,true);assert.equal(s.phase,'arriving');assert.ok(s.time<=1/30);const time=s.time;stepStartupSequence(s,0,true);assert.equal(s.time,time);
});
