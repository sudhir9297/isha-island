import { useIslandWind } from './Wind.js';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { islandCover } from './IslandHabitat.js';
import { gateGround } from './MalaiVasalGeometry.js';
import { GATE } from './GateTerrain.js';

// All grass blades share one opaque mesh; all outcrops share another.
function makeDetails() {
  let seed = 92831;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const vertices = [], colors = [], indices = [], roots = [], reaches = [], axes = [];
  const dark = new THREE.Color('#388f50'), light = new THREE.Color('#aed16f');
  for (let sample = 0; sample < 950; sample++) {
    const x = (random() - 0.5) * 21, z = (random() - 0.5) * 14;
    const wallShoulder = Math.abs(x)>2.5 && Math.abs(x)<8.2 && Math.abs(z)>1 && Math.abs(z)<1.5;
    if (islandCover(x, z) < 0.25 + random() * 0.5 && !wallShoulder) continue;
    // Keep masonry and side doors free of vegetation.
    if (Math.abs(z) < 0.9 && Math.abs(x) < 8.7) continue;
    const y = gateGround(x, z) - 0.035;
    const height = 0.13 + random() * 0.25, turn = random() * Math.PI * 2;
    for (let blade = 0; blade < 5; blade++) {
      const angle = turn + blade * 2.4, dx = Math.cos(angle), dz = Math.sin(angle);
      const h = height * (0.65 + random() * 0.6), width = 0.025 + random() * 0.023;
      const base = vertices.length / 3;
      const points = [[x-dz*width,y,z+dx*width], [x+dz*width,y,z-dx*width],
        [x+dx*h*0.3-dz*width*0.6,y+h*0.6,z+dz*h*0.3+dx*width*0.6],
        [x+dx*h*0.3+dz*width*0.6,y+h*0.6,z+dz*h*0.3-dx*width*0.6],
        [x+dx*h*0.72,y+h,z+dz*h*0.72]];
      points.forEach((p,i) => {
        vertices.push(...p); const c=dark.clone().lerp(light,i/5); colors.push(c.r,c.g,c.b);
        roots.push(...(i < 2 ? p : [x,y,z])); reaches.push(h * 1.25); axes.push(dx * .58, .81, dz * .58);
      });
      indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
    }
  }
  // Small trailing plants soften the wall ends without obscuring the portals.
  for (const side of [-1, 1]) for (const [wallX, top] of [[5.25, 2.71], [7.7, 1.94]]) {
    for (let leaf = 0; leaf < 13; leaf++) {
      const t = leaf / 12, x = side * wallX + Math.sin(t * 8) * 0.12;
      const y = GATE.floor + top - t * 1.2, z = 0.34 + Math.sin(t * 3) * 0.04;
      const direction = leaf % 2 ? 1 : -1, size = 0.12 + random() * 0.07;
      const base = vertices.length / 3;
      const points = [[x,y,z],[x+direction*size*0.65,y+size*0.5,z+0.025],
        [x+direction*size*1.5,y+size*0.15,z], [x+direction*size*0.65,y-size*0.2,z+0.025]];
      const tone = dark.clone().lerp(light, 0.2 + random() * 0.3);
      points.forEach(p => { vertices.push(...p); colors.push(tone.r,tone.g,tone.b); roots.push(x,y,z); reaches.push(size * 1.6); axes.push(direction,0,0); });
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
  }
  const grass = new THREE.BufferGeometry();
  grass.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  grass.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  grass.setAttribute('leafWindRoot', new THREE.Float32BufferAttribute(roots,3));
  grass.setAttribute('leafWindReach', new THREE.Float32BufferAttribute(reaches,1));
  grass.setAttribute('leafWindAxis', new THREE.Float32BufferAttribute(axes,3));
  grass.setIndex(indices); grass.computeVertexNormals();
  const rocks = [];
  const sites = [[-7.6,3.4,1.0],[-9,-1.7,0.8],[7.8,1.5,0.85],[5.2,-4.8,1.1],[-4.8,-5.2,0.85]];
  for (const [cx,cz,size] of sites) for (let i=0;i<4;i++) {
    const x=cx+(random()-0.5)*1.5,z=cz+(random()-0.5)*1.5,s=size*(i?0.3+random()*0.4:1);
    const geometry=new THREE.IcosahedronGeometry(1,1);
    geometry.scale(s, s*(0.48+random()*0.25),s*0.75);
    geometry.rotateY(random()*6.28); geometry.translate(x,gateGround(x,z)+s*0.19,z);
    const p=geometry.attributes.position,c=[];
    const stone=new THREE.Color(i%2?'#ccd09d':'#aabd89');
    for(let v=0;v<p.count;v++){const shade=0.91+random()*0.14;c.push(stone.r*shade,stone.g*shade,stone.b*shade);}
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(c,3)); rocks.push(geometry);
  }
  const stone=mergeGeometries(rocks); rocks.forEach(g=>g.dispose());
  return {grass,stone};
}
export default function CoastalDetails() {
  const [wind, windRoot] = useIslandWind(.6, .035);
  const data=useMemo(() => makeDetails(),[]);
  useEffect(()=>()=>Object.values(data).forEach(g=>g.dispose()),[data]);
  return <group ref={windRoot} name="Dune grass and weathered coastal outcrops">
    <mesh geometry={data.grass} receiveShadow {...wind.leafMesh}><meshStandardMaterial {...wind.stemNodes} onBeforeCompile={wind.stemShader} customProgramCacheKey={wind.stemKey} vertexColors side={THREE.DoubleSide} roughness={1}/></mesh>
    <mesh geometry={data.stone} userData={{ crabSurface: true }} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.94} flatShading/></mesh>
  </group>;
}
