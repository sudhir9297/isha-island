import test from 'node:test';
import assert from 'node:assert/strict';
import { islandCover, arrivalPlantingWeight } from './IslandHabitat.js';
import { walkingSurfaceHeight, dockWorldPoint, DOCK } from './WalkingSurface.js';
import { GATE, gateTerrainHeight } from './GateTerrain.js';

test('coastal habitat leaves shore and entrance bare while supporting inland pockets', () => {
  for (const [x,z] of [[0,0],[0,2],[0,5],[7,7.15],[12,0],[0,9]]) assert.equal(islandCover(x,z),0);
  for (const [x,z] of [[-6,1],[-4.2,2.8],[5.3,1.9]]) assert.ok(islandCover(x,z)>0.8);
  for (let x=-12;x<=12;x+=0.4) for(let z=-9;z<=9;z+=0.4) {
    const cover=islandCover(x,z);
    assert.ok(Number.isFinite(cover) && cover>=0 && cover<=1);
    const h=gateTerrainHeight(x,z,0.2);
    assert.ok(Number.isFinite(h) && h>=0.2);
  }
  assert.equal(gateTerrainHeight(0,0,0.2),GATE.floor);
  assert.equal(gateTerrainHeight(12,0,0.035),0.035);
});

test('dock-to-gate clearing stays bare and walkable with room for carried luggage', () => {
  const landing = dockWorldPoint(0, DOCK.start);
  // Sample the intended walk independently of the planting-mask control points.
  const route = [[landing.x, landing.z+12], [5.5,4.7], [3.3,3.35], [1.3,1.9], [0,.7]];
  for (let i=1;i<route.length;i++) {
    const [ax,az]=route[i-1], [bx,bz]=route[i];
    const length=Math.hypot(bx-ax,bz-az), nx=-(bz-az)/length,nz=(bx-ax)/length;
    for(let t=0;t<=1;t+=.05) for(const offset of [-.65,0,.65]) {
      const x=ax+(bx-ax)*t+nx*offset,z=az+(bz-az)*t+nz*offset;
      assert.equal(islandCover(x,z),0,`planting on approach at ${x}, ${z}`);
      assert.notEqual(walkingSurfaceHeight(x,z-12),null,`unwalkable approach at ${x}, ${z}`);
    }
  }
  assert.equal(arrivalPlantingWeight(-6,2),1);
  assert.equal(arrivalPlantingWeight(0,-4),1);
});
