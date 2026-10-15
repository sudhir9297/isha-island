import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { crabPath, crabWalkable } from './CrabNavigation.js';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';
import { createCrabSurface } from './CrabSurface.js';
import { dockWorldPoint, DOCK } from './WalkingSurface.js';

test('crab routes onto the far end of the dock and back without crossing water',()=>{
 const end=dockWorldPoint(0,5.8),s=createCrabBehavior();
 for(const target of [{x:end.x,z:end.z+12},{x:-.8,z:6}]) {
  const route=crabPath(s.x,s.z,target.x,target.z);assert.ok(route.length>5);
  for(let i=1;i<route.length;i++)for(let t=0;t<=1;t+=.1)assert.ok(crabWalkable(route[i-1].x*(1-t)+route[i].x*t,route[i-1].z*(1-t)+route[i].z*t));
  s.mode='wander';s.targetX=target.x;s.targetZ=target.z;s.timer=120;s.routeTime=0;
  for(let i=0;i<2400&&Math.hypot(s.x-target.x,s.z-target.z)>.2;i++)stepCrab(s,null,.05);
  assert.ok(Math.hypot(s.x-target.x,s.z-target.z)<.2,'reaches destination without stalling');
 }
});
test('surface follows raised geometry and dock planks instead of sand beneath them',()=>{
 const rock=new Mesh(new BoxGeometry(.8,.5,.8),new MeshBasicMaterial());rock.position.set(0,1.45,-6);rock.updateMatrixWorld(true);
 const height=createCrabSurface([rock]);
 assert.ok(Math.abs(height(0,6)-1.7)<1e-6);
 assert.ok(height(1,6)<1.7);
 const dock=dockWorldPoint(0,5);assert.ok(Math.abs(height(dock.x,dock.z+12)-DOCK.deckHeight)<1e-6);
 rock.geometry.dispose();rock.material.dispose();
});
