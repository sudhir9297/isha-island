import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const bytes = readFileSync(new URL('../../public/models/traveler-luggage.glb', import.meta.url));
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
test('all four luggage exports have centered origins and fit their carrying slots', () => {
  const names = ['Luggage_Suitcase','Luggage_Backpack','Luggage_Duffel','Luggage_Satchel'];
  const maxima = [[.45,.75,.30],[.5,.75,.55],[.65,.5,.35],[.45,.85,.25]];
  for (const [index,name] of names.entries()) {
    const object = asset.scene.getObjectByName(name);
    assert.ok(object, name);
    assert.ok(object.position.length() < 1e-6, 'attachment origin must stay centered');
    const display = object.clone(true);
    const fitted = display.getObjectByName('Satchel_FittedStrap');
    if (fitted) fitted.removeFromParent();
    const size = new Box3().setFromObject(display).getSize(new Vector3());
    size.toArray().forEach((value,axis) => assert.ok(value > .05 && value < maxima[index][axis], `${name} axis ${axis}: ${value}`));
    let faces = 0;
    object.traverse(child => { if (child.isMesh) faces += child.geometry.index.count / 3; });
    assert.ok(faces > 100 && faces < 15000);
  }
});
