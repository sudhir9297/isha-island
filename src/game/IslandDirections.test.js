import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutIslandDirections, SAILING_ISLANDS } from './IslandDirections.js';
test('island targets include the three actual island centers', () => {
  assert.equal(SAILING_ISLANDS.length, 3);
  assert.deepEqual(SAILING_ISLANDS.map(i => i.id), ['malai', 'neem', 'adiyogi']);
});
test('arrows point at their targets even when labels share a bearing', () => {
  const targets = [{id:'a',x:900,y:200},{id:'b',x:1200,y:200},{id:'c',x:1500,y:200}];
  const result = layoutIslandDirections({x:400,y:300}, targets, 800, 600);
  for (const p of result) {
    const target = targets.find(t => t.id === p.id);
    const angle = (p.angle - 90) * Math.PI / 180;
    assert.ok(Math.abs(Math.atan2(target.y-p.y,target.x-p.x) - angle) < 1e-10);
  }
  for (let i=0;i<result.length;i++) for(let j=i+1;j<result.length;j++) {
    assert.ok(Math.abs(result[i].x-result[j].x) >= 112 || Math.abs(result[i].y-result[j].y) >= 54);
  }
});
test('phone markers stay inside the viewport and do not overlap', () => {
  const result = layoutIslandDirections({x:195,y:422}, [{id:'a',x:200,y:380},{id:'b',x:900,y:20},{id:'c',x:1300,y:0}], 390, 844);
  for(const p of result) { assert.ok(p.x >=54 && p.x<=336); assert.ok(p.y>=87 && p.y<=721); }
  for(let i=0;i<result.length;i++) for(let j=i+1;j<result.length;j++) assert.ok(Math.abs(result[i].x-result[j].x)>=100 || Math.abs(result[i].y-result[j].y)>=54);
});
test('coincident destination does not produce an arbitrary arrow', () => {
  assert.deepEqual(layoutIslandDirections({x:200,y:200}, [{x:200,y:200}], 800,600), []);
});
