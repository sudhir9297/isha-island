import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, Group } from 'three';
import { createWalkingObstacles, slideWalkingMove } from './WalkingObstacles.js';

test('solid geometry respects parent transforms, body radius and overhead clearance',()=>{
 const group=new Group(),mesh=new Mesh(new BoxGeometry(1,2,1));group.position.set(7,0,-12);mesh.position.y=1;group.add(mesh);
 const blocked=createWalkingObstacles([mesh]);
 assert.equal(blocked(7,-12,0),true);assert.equal(blocked(7.7,-12,0),true);assert.equal(blocked(8,-12,0),false);
 assert.equal(blocked(7,-12,2.1),false);assert.equal(blocked(7,-12,-3),false);
 mesh.geometry.dispose();
});
test('substeps stop a fast movement through a thin post and slide along its edge',()=>{
 const mesh=new Mesh(new BoxGeometry(.15,2,3));mesh.position.y=1;
 const blocked=createWalkingObstacles([mesh]);
 const next=slideWalkingMove(-2,0,4,0,(x,z)=>!blocked(x,z,0));assert.ok(next.x<-.3);
 const slide=slideWalkingMove(-.4,-.5,1,1,(x,z)=>!blocked(x,z,0));assert.ok(slide.x<-.3);assert.ok(slide.z>.4);
 mesh.geometry.dispose();
});
test('separate rocks in a merged geometry do not block the empty passage between them',()=>{
 const left=new Mesh(new BoxGeometry(1,1,1)),right=new Mesh(new BoxGeometry(1,1,1));left.position.set(-2,.5,0);right.position.set(2,.5,0);
 const blocked=createWalkingObstacles([left,right]);assert.equal(blocked(0,0,0),false);assert.equal(blocked(-2,0,0),true);
 left.geometry.dispose();right.geometry.dispose();
});
