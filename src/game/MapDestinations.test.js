import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapDestination, stepMapDestination, mapDestination } from './MapDestinations.js';
test('island focus settles at destination, can reverse and returns to overview', () => {
 const s=createMapDestination();
 for(let i=0;i<48;i++)stepMapDestination(s,'neem',1/30);
 assert.ok(Math.abs(s.span-30)<1e-8);assert.equal(s.x,mapDestination('neem').x);
 stepMapDestination(s,'adiyogi',.2);const before={...s};stepMapDestination(s,null,0);
 assert.equal(s.x,before.x);assert.equal(s.span,before.span);
 for(let i=0;i<100;i++)stepMapDestination(s,null,1/60);
 assert.ok(Math.abs(s.span-210)<1e-8);assert.equal(s.x,65);
});
test('focus is frame-rate independent, supports reduced motion and safe unknown IDs', () => {
 const a=createMapDestination(),b=createMapDestination();
 for(let i=0;i<30;i++)stepMapDestination(a,'malai',1/30);
 for(let i=0;i<120;i++)stepMapDestination(b,'malai',1/120);
 assert.ok(Math.abs(a.span-b.span)<1e-8);
 stepMapDestination(a,'adiyogi',0,true);assert.equal(a.x,130);
 stepMapDestination(a,'unknown',0,true);assert.equal(a.x,65);
});
