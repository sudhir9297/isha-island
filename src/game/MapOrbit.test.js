import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapOrbit, turnMapOrbit, stepMapOrbit, resetMapOrbit } from './MapOrbit.js';
test('orbit stays bounded and damping is independent of frame rate', () => {
 const a=createMapOrbit(),b=createMapOrbit();
 turnMapOrbit(a,1);turnMapOrbit(b,1);
 for(let i=0;i<30;i++)stepMapOrbit(a,1/30);
 for(let i=0;i<120;i++)stepMapOrbit(b,1/120);
 assert.ok(Math.abs(a.yaw-b.yaw)<1e-12);
 turnMapOrbit(a,100);assert.equal(a.targetYaw,Math.PI);
 turnMapOrbit(a,-200);assert.equal(a.targetYaw,-Math.PI);
});
test('reset eases to the default bearing and reduced motion responds immediately', () => {
 const s=createMapOrbit();turnMapOrbit(s,1.2);stepMapOrbit(s,.01,true);assert.equal(s.yaw,1.2);
 resetMapOrbit(s);stepMapOrbit(s,.05);assert.ok(s.yaw>0&&s.yaw<1.2);
 stepMapOrbit(s,0,true);assert.equal(s.yaw,0);
});

test('closing can clear both the current and requested bearing', () => {
 const s=createMapOrbit();turnMapOrbit(s,2);stepMapOrbit(s,.1);resetMapOrbit(s,true);
 assert.deepEqual(s,createMapOrbit());
});
