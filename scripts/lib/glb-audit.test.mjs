import test from 'node:test';
import assert from 'node:assert/strict';
import {auditGlb} from './glb-audit.mjs';
function asset(json){
 const data=Buffer.from(JSON.stringify(json));const padded=Buffer.alloc(Math.ceil(data.length/4)*4,32);data.copy(padded);
 const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);return Buffer.concat([header,padded]);
}
test('counts indexed and nonindexed triangles without counting lines as triangles',()=>{
 const result=auditGlb(asset({accessors:[{count:9},{count:6}],meshes:[{primitives:[{attributes:{POSITION:0}},{attributes:{POSITION:0},indices:1},{attributes:{POSITION:0},mode:1}]}]}));
 assert.equal(result.triangles,5);assert.equal(result.primitiveCount,3);
});
test('rejects truncated GLB and invalid mesh accessors',()=>{
 assert.throws(()=>auditGlb(Buffer.from('glTF')),/header/);
 assert.throws(()=>auditGlb(asset({meshes:[{primitives:[{attributes:{POSITION:4}}]}]})),/POSITION/);
});
