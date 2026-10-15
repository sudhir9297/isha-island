// Read GLB metadata without decoding textures or creating a WebGL context.
export function auditGlb(bytes) {
  if(bytes.length<20 || bytes.toString('ascii',0,4)!=='glTF' || bytes.readUInt32LE(4)!==2 || bytes.readUInt32LE(8)!==bytes.length) throw new Error('Invalid GLB header or length');
  const length=bytes.readUInt32LE(12);
  if(bytes.readUInt32LE(16)!==0x4e4f534a || 20+length>bytes.length)throw new Error('Missing GLB JSON chunk');
  const json=JSON.parse(bytes.toString('utf8',20,20+length));
  const accessors=json.accessors??[];
  const parts=(json.meshes??[]).flatMap(mesh=>mesh.primitives.map(p=>{
    const positions=accessors[p.attributes?.POSITION];
    if(!positions)throw new Error(`Missing POSITION in ${mesh.name}`);
    const count=p.indices===undefined?positions.count:accessors[p.indices]?.count;
    if(!Number.isFinite(count))throw new Error(`Invalid index accessor in ${mesh.name}`);
    const mode=p.mode??4;
    const triangles=mode===4?count/3:(mode===5||mode===6?Math.max(0,count-2):0);
    if(!Number.isInteger(triangles))throw new Error(`Incomplete triangles in ${mesh.name}`);
    return {mesh:mesh.name??'(unnamed)',material:json.materials?.[p.material]?.name??'(default)',vertices:positions.count,triangles};
  }));
  return {bytes:bytes.length,meshCount:json.meshes?.length??0,primitiveCount:parts.length,materialCount:json.materials?.length??0,textureCount:json.textures?.length??0,
    triangles:parts.reduce((sum,p)=>sum+p.triangles,0),
    embeddedImageBytes:(json.images??[]).reduce((sum,image)=>sum+(json.bufferViews?.[image.bufferView]?.byteLength??0),0),
    extensions:json.extensionsUsed??[],nodes:(json.nodes??[]).map(n=>n.name).filter(Boolean),animations:(json.animations??[]).map(a=>a.name),parts};
}
