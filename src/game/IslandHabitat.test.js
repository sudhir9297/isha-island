import test from 'node:test';
import assert from 'node:assert/strict';
import { islandCover } from './IslandHabitat.js';
import { GATE, gateTerrainHeight } from './GateTerrain.js';

test('coastal habitat leaves shore and entrance bare while supporting inland pockets', () => {
  for (const [x,z] of [[0,0],[0,2],[0,5],[7,7.15],[12,0],[0,9]]) assert.equal(islandCover(x,z),0);
  for (const [x,z] of [[-6,1],[-3.5,2.8],[4.3,2.4]]) assert.ok(islandCover(x,z)>0.8);
  for (let x=-12;x<=12;x+=0.4) for(let z=-9;z<=9;z+=0.4) {
    const cover=islandCover(x,z);
    assert.ok(Number.isFinite(cover) && cover>=0 && cover<=1);
    const h=gateTerrainHeight(x,z,0.2);
    assert.ok(Number.isFinite(h) && h>=0.2);
  }
  assert.equal(gateTerrainHeight(0,0,0.2),GATE.floor);
  assert.equal(gateTerrainHeight(12,0,0.035),0.035);
});
