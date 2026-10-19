import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, OrthographicCamera, Scene, Group, Mesh, BoxGeometry } from 'three';
import { collectIslandBounds, createIslandVisibilityCheck } from './IslandVisibility.js';
const box=(x,y,z,size=1)=>new Box3(new Vector3(x-size,y-size,z-size),new Vector3(x+size,y+size,z+size));
function camera() {
  const c=new OrthographicCamera(-10,10,10,-10,.1,100);
  c.position.set(0,20,0);c.up.set(0,0,-1);c.lookAt(0,0,0);c.updateMatrixWorld();return c;
}
test('any island in view hides every arrow, including when only its edge is visible',()=>{
  const visible=createIslandVisibilityCheck(),c=camera();
  assert.equal(visible(c,[box(40,0,0)]),false);
  assert.equal(visible(c,[box(40,0,0),box(10.5,0,0)]),true);
  assert.equal(visible(c,[box(0,0,0)]),true);
});
test('visibility follows zoom and camera movement rather than boat distance',()=>{
  const visible=createIslandVisibilityCheck(),c=camera(),bounds=[box(16,0,0)];
  assert.equal(visible(c,bounds),false);
  c.zoom=.5;c.updateProjectionMatrix();assert.equal(visible(c,bounds),true);
  c.zoom=1;c.updateProjectionMatrix();c.position.x=16;c.lookAt(16,0,0);c.updateMatrixWorld();assert.equal(visible(c,bounds),true);
});
test('only above-water geometry belonging to islands counts, including tall props',()=>{
  const scene=new Scene(),island=new Group();island.userData.navigationIsland=true;scene.add(island);
  const tree=new Mesh(new BoxGeometry(1,8,1));tree.position.set(3,4,0);island.add(tree);
  const submerged=new Mesh(new BoxGeometry(2,1,2));submerged.position.y=-3;island.add(submerged);
  const hidden=new Mesh(new BoxGeometry());hidden.visible=false;island.add(hidden);
  scene.add(new Mesh(new BoxGeometry(100,1,100)));
  const bounds=collectIslandBounds(scene);assert.equal(bounds.length,1);assert.equal(bounds[0].max.y,8);
  tree.geometry.dispose();submerged.geometry.dispose();hidden.geometry.dispose();
});
