import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshoptDecoder} from 'three-stdlib';
import {createIO, sourceURL, compressedURL, verifyCompression} from './gate-compression.mjs';

test('shipped compressed gate matches the current export with the game decoder', async () => {
  const decoder = typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder;
  await decoder.ready;
  const io = (await createIO()).registerDependencies({'meshopt.decoder': decoder});
  const original = await readFile(sourceURL);
  const compressed = await readFile(compressedURL);
  assert.ok(compressed.length < original.length * 0.7);
  await verifyCompression(io, await io.readBinary(original), await io.readBinary(compressed));
});

test('validation rejects altered geometry', async () => {
  const io = await createIO();
  const original = await readFile(sourceURL);
  const changed = await io.readBinary(original);
  const positions = changed.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
  positions[0] += 1;
  await assert.rejects(verifyCompression(io, await io.readBinary(original), changed));
});
