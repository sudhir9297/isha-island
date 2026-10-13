import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {GATE, gateTerrainHeight} from '../src/game/GateTerrain.js';
import {shoreRadius,baseSandHeight,ISLAND_SAND_PALETTE} from '../src/game/Seabed.js';
import {islandCover} from '../src/game/IslandHabitat.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
function load(path) {
  let text = fs.readFileSync(path, 'utf8').split('function Rope(')[0];
  text = text.replace(/^import .*\n/gm, '');
  for (const [name, value, end] of [['Palm','data','function makePetal('],['PlantBed','geometries','function Broadleaf('],['Broadleaf','data',null]]) {
    const start = text.indexOf(`function ${name}(`);
    const finish = end ? text.indexOf(end,start) : text.length;
    const block = text.slice(start,finish), jsx = block.indexOf('  return (\n');
    text = text.slice(0,start) + block.slice(0,jsx) + `  return ${value};\n}\n\n` + text.slice(finish);
  }
  const context={THREE,mergeGeometries,shoreRadius,baseSandHeight,ISLAND_SAND_PALETTE,islandCover,gateTerrainHeight,GATE,useMemo:fn=>fn(),useEffect:()=>{},useIslandWind:()=>[{},()=>{}],addLeafWind:new Function('THREE',fs.readFileSync('src/game/Wind.js','utf8').slice(fs.readFileSync('src/game/Wind.js','utf8').indexOf('export function addLeafWind('),fs.readFileSync('src/game/Wind.js','utf8').indexOf('const windFunctions')).replace('export function','function')+';return addLeafWind;')(THREE)};
  vm.createContext(context);vm.runInContext(text+'\nthis.api={Palm,PlantBed,Broadleaf,random,AUTHORED_GARDENS,makeSand};',context);return context.api;
}
const current=load('src/game/Island.jsx'), before=load('/private/tmp/island-foliage100-before.jsx');
const palms=[[-9,.46,.9,5.7,-.7,71],[9,.45,.6,5.8,.85,381],[-5.4,.46,-4.9,5.9,.7,171],[4.4,.4,-6.2,5.2,.85,493],[-7.4,.38,-3.3,4.6,1,674],[7,.42,-4.9,4.4,.8,24],[-8.3,.4,3.2,4.2,-.7,102],[-4.5,.4,-6.8,4.6,.7,675]].map(([x,y,z,height,lean,seed])=>({kind:'Palm',position:[x,y,z-12],height,lean,seed,scale:1,windHeight:height,tip:.115}));
const broad=[[-8.1,.37,-1.2,.72],[-5,.42,-4.8,.9],[-8.6,.45,-2.5,.8],[4.5,.42,-5.2,.95],[7.4,.39,-1.5,.7]].map(([x,y,z,scale],i)=>({kind:'Broadleaf',position:[x,y,z-12],scale,seed:218+i*44,windHeight:3,tip:.06}));
const rnd=current.random(884),beds=[];
for(let i=0;i<34;i++){
 const a=i/34*Math.PI*2,r=.43+rnd()*.27,x=Math.cos(a)*r*11,z=Math.sin(a)*r*8;
 if(Math.abs(z)<2&&Math.abs(x)<8.6)continue;if(z>-5&&z<4&&x>-3&&x<3.6)continue;if(z>2.5&&x>-3.7)continue;
 beds.push({position:[x,.43,z],scale:.6+rnd()*.38,seed:i*99+71,flowers:rnd()>.86});
}
beds.push(...current.AUTHORED_GARDENS);
for(const side of [-1,1])for(let i=0;i<3;i++){const x=side*(8.45+(i%2)*.65),z=Math.floor(i/2)*1.25-.6; broad.push({kind:'Broadleaf',position:[x,.4,z-12],scale:.98+i*.04,seed:1640+i*77+side,windHeight:3,tip:.06});beds.push({position:[x,.4,z],scale:.85,seed:2840+i*71+side,flowers:false});const bx=side*(2.15+i*1.04),bz=-5.1-(i%2)*.75;broad.push({kind:'Broadleaf',position:[bx,.4,bz-12],scale:1.3+i*.09,seed:5862+side*31+i*113,windHeight:3,tip:.06});}
const specifications=[...palms,...broad,...beds.map(s=>({...s,kind:'PlantBed',position:[s.position[0],s.position[1],s.position[2]-12],scale:s.scale??1,windHeight:.9,tip:.045}))];
const camera=new THREE.OrthographicCamera(-500,500,370,-370,.1,200); camera.zoom=740/14;camera.position.set(-18.5,21,4);camera.lookAt(-8.5,3,-12);camera.updateProjectionMatrix();camera.updateMatrixWorld();
const sand=new THREE.Mesh(current.makeSand(),new THREE.MeshBasicMaterial());sand.position.z=-12;sand.updateMatrixWorld();
const caster=new THREE.Raycaster();const result=[];
for(const [px,py]of[[814,552],[821,543],[700,470],[991,517],[800,536]]){
 caster.setFromCamera(new THREE.Vector2(px/1000*2-1,1-py/740*2),camera);
 const h=caster.intersectObject(sand)[0];result.push({pixel:[px,py],sandPoint:h?.point.toArray(),nearbyBeds:specifications.filter(x=>x.kind==='PlantBed'&&h&&Math.hypot(x.position[0]-h.point.x,x.position[2]-h.point.z)<2).map(x=>({seed:x.seed,position:x.position,flowers:x.flowers}))});
}
console.log(JSON.stringify(result,null,2));
