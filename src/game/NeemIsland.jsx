import { Suspense, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import BrunoTree from './BrunoTree.jsx';
import { NEEM_ISLAND, neemRadiusAt, neemTerrainHeight } from './NeemTerrain.js';
import { ISLAND_SAND_PALETTE } from './Seabed.js';
import { makeIslandSandTextures } from './IslandSand.js';
import { createBeachWetting, BEACH_WETTING_KEY } from './BeachWetting.js';

const ground = (x, z) => neemTerrainHeight(NEEM_ISLAND.x + x, NEEM_ISLAND.z + z);
function makeGround() {
  const g = new THREE.PlaneGeometry(19, 15, 100, 80); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, colors = [];
  const dry = new THREE.Color(ISLAND_SAND_PALETTE.dry), wet = new THREE.Color(ISLAND_SAND_PALETTE.wet), grass = new THREE.Color('#7ea389');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = neemRadiusAt(x + NEEM_ISLAND.x, z + NEEM_ISLAND.z);
    p.setY(i, ground(x,z));
    const c = dry.clone().lerp(wet, THREE.MathUtils.smoothstep(r,.8,1.08) * .55);
    const patch = (1 - THREE.MathUtils.smoothstep(Math.hypot((x+.8)/4,(z+.65)/3),.4,1)) * .74;
    c.lerp(grass, patch);
    colors.push(c.r,c.g,c.b,1-THREE.MathUtils.smoothstep(r,1.015,1.08));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors,4)); g.computeVertexNormals(); return g;
}
function NameSign() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=160;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#e0c28a';ctx.fillRect(0,0,512,160);
    ctx.strokeStyle='#998258';ctx.lineWidth=8;ctx.strokeRect(10,10,492,140);
    ctx.textAlign='center';ctx.fillStyle='#334d35';ctx.font='bold 54px Georgia';ctx.fillText('NEEM POINT',256,77);
    ctx.font='23px Georgia';ctx.fillText('A little shade between shores',256,119);
    const t = new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
  }, []);
  useEffect(() => () => texture.dispose(),[texture]);
  return <group position={[-3.6,ground(-3.6,2.2),2.2]} rotation={[0,-.3,0]}>
    <mesh userData={{ walkingSolid: true }} position={[0,.48,0]} castShadow><boxGeometry args={[.13,.96,.13]}/><meshStandardMaterial color="#786347"/></mesh>
    <mesh userData={{ walkingSolid: true }} position={[0,1,0]} castShadow><boxGeometry args={[1.85,.58,.12]}/><meshStandardMaterial color="#bc9762"/></mesh>
    <mesh userData={{ walkingSolid: true }} position={[0,1,.062]}><planeGeometry args={[1.85,.58]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>
  </group>;
}
export default function NeemIsland() {
  const geometry=useMemo(() => makeGround(),[]), textures=useMemo(() => makeIslandSandTextures(),[]), wetting=useMemo(() => createBeachWetting(),[]);
  useFrame(({clock})=>wetting.advance(clock.elapsedTime));
  useEffect(()=>()=>{geometry.dispose();wetting.dispose();Object.values(textures).forEach(t=>t.dispose());},[geometry,textures,wetting]);
  return <group userData={{ navigationIsland: true }} name="Neem Point" position={[NEEM_ISLAND.x,0,NEEM_ISLAND.z]}>
    <mesh geometry={geometry} receiveShadow renderOrder={1}><meshStandardMaterial vertexColors map={textures.color} bumpMap={textures.relief} bumpScale={.035} roughness={1} transparent depthWrite {...wetting.nodes} onBeforeCompile={wetting.apply} customProgramCacheKey={()=>BEACH_WETTING_KEY}/></mesh>
    <Suspense fallback={null}><BrunoTree position={[-.8, ground(-.8, -.65), -.65]} /></Suspense><NameSign/>
    <group position={[2.2,ground(2.2,.6),.6]}>
      {[0,1,2].map(i=><mesh userData={{ walkingSolid: true }} key={i} position={[0,.48,(i-1)*.19]} castShadow receiveShadow><boxGeometry args={[2.2,.12,.16]}/><meshStandardMaterial color="#ac8550" roughness={.9}/></mesh>)}
      {[-.8,.8].map(x=><mesh userData={{ walkingSolid: true }} key={x} position={[x,.22,0]} castShadow><boxGeometry args={[.18,.44,.55]}/><meshStandardMaterial color="#736347"/></mesh>)}
      <mesh userData={{ walkingSolid: true }} position={[0,.87,-.3]} castShadow><boxGeometry args={[2.2,.25,.1]}/><meshStandardMaterial color="#ac8550"/></mesh>
      {[-.8,.8].map(x=><mesh userData={{ walkingSolid: true }} key={x} position={[x,.66,-.3]} castShadow><boxGeometry args={[.09,.65,.09]}/><meshStandardMaterial color="#736347"/></mesh>)}
    </group>
    {[[-5.3,-1.2,.7],[-4.8,-1.6,.4],[4.9,-2.1,.65],[4.4,-2.5,.4],[1.5,3.9,.35]].map(([x,z,s],i)=><mesh userData={{ walkingSolid: true }} key={i} position={[x,ground(x,z)+s*.22,z]} scale={[s,s*.55,s*.8]} rotation={[.1,i*1.7,.2]} castShadow receiveShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color={i%2?'#a5ac88':'#bec09a'} flatShading roughness={1}/></mesh>)}
    {Array.from({length:7},(_,i)=>{const x=-5.7+i*.65,z=2.8-i*.27;return <mesh userData={{ walkingSolid: true }} key={i} position={[x,ground(x,z)+.025,z]} scale={[.35,.055,.25]} receiveShadow><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#d2c6a2" roughness={1}/></mesh>;})}
  </group>;
}
