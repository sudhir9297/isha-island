import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createJourney, landingPoint, stepJourney, clearOfBoat } from './JourneyState.js';
const boat = (x=0,z=-2,speed=0)=>({position:new Vector3(x,0,z),speed,resetId:0});
test('landing requires slow boat close to dry shore',()=>{
 assert.equal(landingPoint(boat(0,10)),null);
 assert.equal(landingPoint(boat(0,-2,5)),null);
 assert.ok(landingPoint(boat()));
 const s=createJourney(), b=boat();stepJourney(s,b,{interact:true},.016);
 assert.equal(s.mode,'walking');assert.ok(s.position.y>0);
 assert.equal(b.destination,null);
 stepJourney(s,b,{interact:true},.016);assert.equal(s.mode,'walking');
 stepJourney(s,b,{},.016);stepJourney(s,b,{interact:true},.016);assert.equal(s.mode,'aboard');
});
test('only a full central gate traversal releases burdens',()=>{
 const b=boat(),s=createJourney();s.mode='walking';s.position.set(0,2.35,-10.8);
 // Both controls combine to move approximately north in the fixed camera frame.
 for(let i=0;i<20;i++) stepJourney(s,b,{forward:true},1/60);
 assert.equal(s.released,false); // entering the approach alone is insufficient
 s.position.set(0,2.35,-10.8); s.gateEntered=false;
 // Alternate north-west/north-east screen directions to stay within doorway.
 for(let i=0;i<180;i++) stepJourney(s,b,{forward:true,left:i%3===0},1/60);
 assert.equal(s.released,true);
 const t=s.releaseTime;stepJourney(s,b,{forward:true},1,true);assert.equal(s.releaseTime,t);
 b.resetId++;stepJourney(s,b,{},.016);assert.equal(s.mode,'aboard');assert.equal(s.released,false);
});
test('walking cannot leave the shoreline or cross solid gate walls',()=>{
 const b=boat(),s=createJourney();s.mode='walking';s.position.set(4,2,-11.2);
 for(let i=0;i<120;i++)stepJourney(s,b,{forward:true},1/60);
 assert.ok(s.position.z>-11.4);assert.equal(s.released,false);
});

test('release holds a brief beat, respects pause, then restores walking',()=>{
 const b=boat(),s=createJourney();s.mode='walking';s.released=true;s.position.set(0,2.35,-13);
 const start=s.position.clone();
 for(let i=0;i<30;i++)stepJourney(s,b,{forward:true},1/60);
 assert.deepEqual(s.position,start);
 const clock=s.releaseTime;
 for(let i=0;i<100;i++)stepJourney(s,b,{forward:true},1/60,true);
 assert.equal(s.releaseTime,clock);
 for(let i=0;i<80;i++)stepJourney(s,b,{forward:true},1/60);
 assert.ok(s.position.distanceTo(start)>1);
 assert.ok(s.releaseTime>1.6);
});

test('disembarking a grounded boat clears its hull at every heading and size',()=>{
 for(const boatId of ['skiff','runabout','workboat']) for(const heading of [0,.7,Math.PI/2,Math.PI]) {
  const b=boat(0,-5);b.heading=heading;b.boatId=boatId;
  const s=createJourney();stepJourney(s,b,{interact:true},1/60);
  assert.equal(s.mode,'walking');
  assert.ok(clearOfBoat(s.position.x,s.position.z,b));
  assert.ok(s.position.distanceTo(b.position)>1.5);
  for(let i=0;i<120;i++)stepJourney(s,b,{backward:true},1/60);
  assert.ok(clearOfBoat(s.position.x,s.position.z,b));
 }
});

test('running increases land speed and jumping is edge-triggered and pause-safe',()=>{
 const b=boat(30,30),walk=createJourney(),run=createJourney();
 for(const s of [walk,run]) {s.mode='walking';s.position.set(0,2,-8);s.landing.set(20,0,20);}
 stepJourney(walk,b,{forward:true},.05);stepJourney(run,b,{forward:true,run:true},.05);
 assert.ok(Math.abs(run.distance/walk.distance-1.75)<1e-8);
 assert.equal(run.running,true);
 stepJourney(run,b,{brake:true},.05);assert.equal(run.jumping,true);assert.equal(run.jumpTime,0);
 stepJourney(run,b,{brake:true},.05,true);assert.equal(run.jumpTime,0);
 for(let i=0;i<40;i++)stepJourney(run,b,{brake:true},.05);
 assert.equal(run.jumping,false,'holding Space must not repeat the jump');
 stepJourney(run,b,{},.05);stepJourney(run,b,{brake:true},.05);assert.equal(run.jumping,true);
 b.resetId++;stepJourney(run,b,{},.05);assert.equal(run.jumping,false);assert.equal(run.mode,'aboard');
});

test('jumping does not bypass walls, board a boat, or start while aboard',()=>{
 const b=boat(30,30),s=createJourney();stepJourney(s,b,{brake:true,run:true},.05);assert.equal(s.jumping,false);
 s.mode='walking';s.position.set(4,2,-11.2);s.landing.copy(s.position);
 stepJourney(s,b,{},.05);stepJourney(s,b,{brake:true},.05);
 stepJourney(s,b,{interact:true},.05);assert.equal(s.mode,'walking');
 for(let i=0;i<20;i++)stepJourney(s,b,{forward:true,run:true},.05);
 assert.ok(s.position.z>-11.4);
});


test('a short Space tap remains queued until a simulation frame consumes it',()=>{
 const s=createJourney(),b=boat(30,30);s.mode='walking';s.position.set(0,2,-8);
 const controls={brake:false,jumpRequested:true};stepJourney(s,b,controls,.016);
 assert.equal(s.jumping,true);assert.equal(controls.jumpRequested,false);
});

test('standing jumps stay in place; moving jumps retain momentum and allow bounded air steering',()=>{
 const b=boat(30,30),s=createJourney();s.mode='walking';s.position.set(0,2,-8);s.landing.set(20,0,20);
 const start=s.position.clone();
 stepJourney(s,b,{brake:true},1/60);
 for(let i=0;i<95;i++)stepJourney(s,b,{},1/60);
 assert.equal(s.position.x,start.x);assert.equal(s.position.z,start.z);
 for(let i=0;i<5;i++)stepJourney(s,b,{right:true,run:true},1/60);
 stepJourney(s,b,{right:true,run:true,brake:true},1/60);
 while(s.jumpTime<.3)stepJourney(s,b,{right:true,run:true},1/60);
 const vx=s.velocityX, distance=s.distance, t=s.jumpTime;
 stepJourney(s,b,{},1/60,true);
 assert.equal(s.jumpTime,t);assert.equal(s.distance,distance);
 stepJourney(s,b,{},1/60);
 assert.ok(s.velocityX>vx*.9 && s.velocityX<vx,'releasing keys must not stop flight instantly');
 stepJourney(s,b,{left:true,run:true},1/60);
 assert.ok(s.velocityX>0,'opposite input must not reverse flight instantly');
 while(s.jumping)stepJourney(s,b,{},1/60);
 assert.equal(s.velocityX,0);assert.equal(s.velocityZ,0);
});
