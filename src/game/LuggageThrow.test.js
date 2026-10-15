import test from 'node:test';
import assert from 'node:assert/strict';
import {createLuggageThrow,sampleLuggageThrow} from './LuggageThrow.js';
test('burdens follow short backward arcs in a narrow arrival-side fan',()=>{
 const start={x:0,y:3.4,z:-13}, endpoints=[];
 for(let i=0;i<4;i++){
  const flight=createLuggageThrow(start,start,i), a=sampleLuggageThrow(flight,0,{});
  assert.deepEqual([a.x,a.y,a.z],[start.x,start.y,start.z]);
  const mid=sampleLuggageThrow(flight,flight.duration*.5,{});
  assert.ok(mid.y>start.y);
  const end=sampleLuggageThrow(flight,flight.duration+1,{});
  assert.deepEqual([end.x,end.y,end.z],[flight.end.x,flight.end.y,flight.end.z]);
  assert.deepEqual(sampleLuggageThrow(flight,10,{}),end);
  assert.ok(end.z > -11, "bags must land on the arrival side of the gate");
  assert.ok(end.z > start.z, "throw travels back toward the dock");
  const dx=end.x-start.x,dz=end.z-start.z;
  assert.ok(Math.abs(Math.atan2(dx,dz))<20*Math.PI/180,'backward cone stays within 20 degrees');
  assert.ok(Math.hypot(dx,dz)<4,'bags land nearby instead of across the island');
  assert.ok(flight.duration<1,'short toss, not a floating flight');
  assert.ok(mid.y-start.y<1.6,'arc stays low');
  assert.ok(end.spin<Math.PI,'restrained tumble');
  endpoints.push(end);
 }
 assert.ok(endpoints.some(p=>p.x<0)&&endpoints.some(p=>p.x>0));
 assert.equal(new Set(endpoints.map(p=>`${p.x},${p.z}`)).size,4);
});

test('sand landing is continuous and settles after a short skid',()=>{
 const f=createLuggageThrow({x:0,y:3.4,z:-13},{x:0,y:3.4,z:-13},0);
 const impact=sampleLuggageThrow(f,f.duration,{}),after=sampleLuggageThrow(f,f.duration+1e-6,{});
 assert.ok(Math.hypot(impact.x-after.x,impact.y-after.y,impact.z-after.z)<1e-4);
 assert.ok(Math.hypot(impact.x-f.end.x,impact.z-f.end.z)>.2);
 const rest=sampleLuggageThrow(f,f.duration+.4,{});
 assert.deepEqual([rest.x,rest.y,rest.z],[f.end.x,f.end.y,f.end.z]);
});
