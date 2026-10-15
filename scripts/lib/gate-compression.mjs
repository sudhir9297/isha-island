import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash = array => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

export const sourceURL = new URL('../../public/models/malai-vasal-day-v2.glb', import.meta.url);
export const compressedURL = new URL('../../public/models/malai-vasal-day-v2-compressed.glb', import.meta.url);
export async function createIO() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({
    'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  });
}

// Compare decoded content, independent of buffer layout and compression metadata.
async function content(io, document) {
  for (const extension of document.getRoot().listExtensionsUsed()) extension.dispose();
  const triangleIndices = new Set();
  for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMode() === 4 && primitive.getIndices()) triangleIndices.add(primitive.getIndices());
  }
  const accessorHash = accessor => {
    const array = accessor.getArray();
    if (!triangleIndices.has(accessor)) return hash(array);
    // Meshopt may cyclically rotate a triangle; preserve its order and winding.
    const canonical = new Uint32Array(array.length);
    for (let i = 0; i < array.length; i += 3) {
      let first = 0;
      if (array[i + 1] < array[i + first]) first = 1;
      if (array[i + 2] < array[i + first]) first = 2;
      for (let j = 0; j < 3; j++) canonical[i + j] = array[i + (first + j) % 3];
    }
    return hash(canonical);
  };
  const {json} = await io.writeJSON(document);
  delete json.buffers;
  delete json.bufferViews;
  delete json.accessors;
  if (json.images) json.images = json.images.map(({bufferView: _bufferView, uri: _uri, ...image}) => image);
  return {
    json,
    accessors: document.getRoot().listAccessors().map(a => ({
      name: a.getName(), type: a.getType(), normalized: a.getNormalized(), array: accessorHash(a),
    })),
    images: document.getRoot().listTextures().map(t => hash(t.getImage())),
  };
}
export async function verifyCompression(io, source, candidate) {
  assert.deepEqual(await content(io, candidate), await content(io, source),
    'Compressed gate must preserve all decoded geometry, images, materials and scene structure');
}
export function enableCompression(document) {
  // No quantize/reorder transform: QUANTIZE here selects lossless encoding of existing data.
  document.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.QUANTIZE});
}
