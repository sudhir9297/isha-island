// Blender's NLA export currently samples this shape-key action at its first
// value. Write the verified gameplay samples into the garment channel.
// Run after update_sankaran_walk.py; leave all skeleton and mesh data intact.
import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path=new URL('../public/models/sankaran-pillai.glb',import.meta.url);
const source=readFileSync(path);
assert.equal(source.readUInt32LE(0),0x46546c67);
assert.equal(source.readUInt32LE(4),2);
const jsonLength=source.readUInt32LE(12);
const document=JSON.parse(source.subarray(20,20+jsonLength).toString());
const binaryStart=20+jsonLength+8;
let binary=source.subarray(binaryStart,binaryStart+document.buffers[0].byteLength);
const samples=JSON.parse(readFileSync(new URL('../assets/characters/walk-cycle.json',import.meta.url),'utf8'));
function scalarAccessor(values, bounds=false){
  const offset=(binary.length+3)&~3;
  const bytes=Buffer.alloc(values.length*4);
  values.forEach((value,index)=>bytes.writeFloatLE(value,index*4));
  binary=Buffer.concat([binary,Buffer.alloc(offset-binary.length),bytes]);
  const bufferView=document.bufferViews.length;
  document.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});
  const accessor=document.accessors.length;
  document.accessors.push({bufferView,componentType:5126,count:values.length,type:'SCALAR',...(bounds?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})});
  return accessor;
}
const walk=document.animations.find(animation=>animation.name==='Walk');
assert.ok(walk,'Missing Walk clip');
const channels=walk.channels.filter(channel=>channel.target.path==='weights');
assert.equal(channels.length,1,'Expected one dhoti node weight channel');
assert.ok(document.meshes[document.nodes[channels[0].target.node].mesh].primitives.length >= 1);
const input=scalarAccessor(samples.map(sample=>(sample.frame-1)/24),true);
const output=scalarAccessor(samples.flatMap(sample=>[0,...sample.cloth]));
for(const channel of channels){
  walk.samplers[channel.sampler]={input,output,interpolation:'LINEAR'};
}
const motionSamples=JSON.parse(readFileSync(new URL('../assets/characters/run-jump-samples.json',import.meta.url),'utf8'));
for (const [name,frames] of Object.entries(motionSamples)) {
  const clip=document.animations.find(animation=>animation.name===name);
  if (!clip) continue;
  const channels=clip.channels.filter(channel=>channel.target.path==='weights');
  assert.equal(channels.length,1,`Expected dhoti morph channel for ${name}`);
  const input=scalarAccessor(frames.map(([frame])=>(frame-1)/24),true);
  const output=scalarAccessor(frames.flatMap(([,weights])=>weights));
  for (const channel of channels) clip.samplers[channel.sampler]={input,output,interpolation:'LINEAR'};
}
document.buffers[0].byteLength=binary.length;
const rawJSON=Buffer.from(JSON.stringify(document));
const json=Buffer.concat([rawJSON,Buffer.alloc((4-rawJSON.length%4)%4,32)]);
const bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
const result=Buffer.alloc(12+8+json.length+8+bin.length);
result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);
result.writeUInt32LE(json.length,12);result.writeUInt32LE(0x4e4f534a,16);json.copy(result,20);
result.writeUInt32LE(bin.length,20+json.length);result.writeUInt32LE(0x004e4942,24+json.length);bin.copy(result,28+json.length);
writeFileSync(path,result);
console.log('Updated dhoti Walk weights for all material primitives with 25 sampled frames.');
