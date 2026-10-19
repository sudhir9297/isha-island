import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCollection, collectItem, readCollection, KEEPSAKES, COLLECTION_KEY } from './Keepsakes.js';
import { nearbyDiscovery, interactDiscovery } from './Discoveries.js';
import { walkingSurfaceHeight } from './WalkingSurface.js';
test('collection rejects unknown items and duplicates', () => {
  assert.deepEqual(cleanCollection(['leaf','leaf','invalid','shell']), ['shell','leaf']);
  const items=['shell']; assert.equal(collectItem(items,'shell'),items); assert.equal(collectItem(items,'invalid'),items);
});
test('collection survives fresh journeys and migrates the existing shell', () => {
  const storage={getItem:key=>key===COLLECTION_KEY?'["leaf"]':'{"journey":{"shellFound":true}}'};
  assert.deepEqual(readCollection(storage),['shell','leaf']);
  assert.deepEqual(readCollection({getItem:()=>{throw Error();}}),[]);
});
test('each island pickup is walkable and collected only once on foot', () => {
  for(const item of KEEPSAKES.filter(item=>item.x!==undefined)) {
    assert.notEqual(walkingSurfaceHeight(item.x,item.z),null);
    const s={mode:'aboard',position:item,keepsakes:[]};
    assert.equal(nearbyDiscovery(s),null); s.mode='walking';
    assert.equal(nearbyDiscovery(s),item.id);
    assert.equal(interactDiscovery(s,true),true); assert.deepEqual(s.keepsakes,[item.id]);
    interactDiscovery(s,true); assert.equal(nearbyDiscovery(s),null);
  }
});
