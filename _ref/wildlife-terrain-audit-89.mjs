import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '/Users/sudhir/Desktop/create/experiment/port/node_modules/three/build/three.module.js';
import {mergeGeometries} from '/Users/sudhir/Desktop/create/experiment/port/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {SEABED_Y} from '/Users/sudhir/Desktop/create/experiment/port/src/game/WorldConfig.js';
import {seabedHeightAt,createReefHeightField} from '/Users/sudhir/Desktop/create/experiment/port/src/game/Seabed.js';
import {createWildlife,stepWildlife,wildlifeFootprintRadius,WILDLIFE_SPECIES} from '/Users/sudhir/Desktop/create/experiment/port/src/game/WildlifeSimulation.js';
import {createWildlifeGeometry,deformMantaBody,deformMantaWings,deformShark} from '/Users/sudhir/Desktop/create/experiment/port/src/game/WildlifeGeometry.js';
const source=fs.readFileSync('/Users/sudhir/Desktop/create/experiment/port/src/game/Reef.jsx','utf8');
const helpers=source.slice(source.indexOf('function random('),source.indexOf('// Preserve each species'));
const object=source.match(/const assets = useMemo\(\(\) => \((\{[\s\S]*?\})\), \[\]\);/)[1].replace('contactMap: contactTexture(),','contactMap: null,').replace('bump: brainTexture(),','bump: null,');
const body=source.match(/const layout = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[assets\]\);/)[1];
const prefix='const {BufferGeometry,Float32BufferAttribute,Color,Object3D,LatheGeometry,Vector2,SphereGeometry,CircleGeometry,TorusGeometry,CylinderGeometry,Vector3,CanvasTexture,RepeatWrapping,DoubleSide}=THREE;';
const current=new Function('THREE','mergeGeometries','SEABED_Y','seabedHeightAt','createReefHeightField',prefix+helpers+'\nconst assets=('+object+');const makeLayout=()=>{'+body+'};return {assets,data:makeLayout()};')(THREE,mergeGeometries,SEABED_Y,seabedHeightAt,createReefHeightField);
const field=current.data.environment;
let queries=0;const instrumented={...field,maxHeightWithin(...args){queries++;return field.maxHeightWithin(...args);}};
const reports=[], sourceHashes={},creatures=createWildlifeGeometry();
for(const name of ['Reef.jsx','Seabed.js','WorldConfig.js','WildlifeSimulation.js','WildlifeGeometry.js','Wildlife.jsx']) sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync('/Users/sudhir/Desktop/create/experiment/port/src/game/'+name)).digest('hex');
let spawnUnavailable=0,spawnConflicts=0;
for(let seed=0;seed<200;seed++){
 const spawn=createWildlife(seed);stepWildlife(spawn,0,null,field);
 for(const a of spawn.animals){
 const c=WILDLIFE_SPECIES[a.species],r=a.size/c.size,floor=field.maxHeightWithin(a.x,a.z,wildlifeFootprintRadius(a));
 if(a.terrainUnavailable)spawnUnavailable++;
 if(a.y-c.downwardClearance*r<floor+.04-1e-7||a.y+c.clearance*r>-.24+1e-7)spawnConflicts++;
 }
}
for(const seed of [4,12,93]){
 const sim=createWildlife(seed);stepWildlife(sim,0,null,instrumented);
 const stats={seed,relocations:sim.terrainRelocations,normalRelocations:0,unavailable:sim.animals.filter(a=>a.terrainUnavailable).length,minFloorMargin:Infinity,maxStep:0,conflicts:0,animatedVertexConflicts:0,poseSamples:0,minActualFloorMargin:Infinity,maxActualWorldY:-Infinity,maxAnimatedRadiusRatio:0,blocked:{},calls:0,milliseconds:0,animals:sim.animals.map((a,i)=>({index:i,species:a.species,start:[a.x,a.z],distance:0,maxStallSeconds:0,currentStallSeconds:0,strokeResets:0}))};
 const start=performance.now(),calls=queries;
 for(let i=0;i<180*60;i++){
  const before=sim.animals.map(a=>[a.x,a.y,a.z,a.stroke]);
  const t=i/60,boat={x:-13+Math.sin(t*.06)*8,z:4+Math.cos(t*.09)*8,heading:t*.1,speed:3};
  stepWildlife(sim,1/60,boat,instrumented);
  for(const [j,a]of sim.animals.entries()){
   const c=WILDLIFE_SPECIES[a.species],ratio=a.size/c.size;
   const floor=field.maxHeightWithin(a.x,a.z,wildlifeFootprintRadius(a));
   stats.minFloorMargin=Math.min(stats.minFloorMargin,a.y-c.downwardClearance*ratio-floor);
   const ceiling=-.24-c.clearance*ratio;
   if(a.y-c.downwardClearance*ratio<floor+.04-1e-7||a.y>ceiling+1e-7||a.terrainUnavailable)stats.conflicts++;
   if(a.species==='manta'||a.species==='shark'){
    if(a.species==='manta'){deformMantaWings(creatures.manta.wings,a.stroke,a);deformMantaBody(creatures.manta.body,a.stroke,a);}
    else deformShark(creatures.shark.body,a.stroke,a);
    const cosine=Math.cos(a.bank),sine=Math.sin(a.bank),radius=wildlifeFootprintRadius(a);
    stats.poseSamples++;
    for(const g of Object.values(creatures[a.species])){
     const p=g.attributes.position;
     for(let k=0;k<p.count;k++){
      const y=a.y+(p.getY(k)*cosine-p.getZ(k)*sine)*a.size;
      const rotatedZ=(p.getY(k)*sine+p.getZ(k)*cosine)*a.size;
      const radiusRatio=Math.hypot(p.getX(k)*a.size,rotatedZ)/radius;
      stats.minActualFloorMargin=Math.min(stats.minActualFloorMargin,y-floor);stats.maxActualWorldY=Math.max(stats.maxActualWorldY,y);stats.maxAnimatedRadiusRatio=Math.max(stats.maxAnimatedRadiusRatio,radiusRatio);
      if(!Number.isFinite(y+radiusRatio)||y<floor+.04-1e-7||y>-.24+1e-7||radiusRatio>1+1e-7)stats.animatedVertexConflicts++;
     }
    }
   }
   stats.maxStep=Math.max(stats.maxStep,Math.hypot(a.x-before[j][0],a.y-before[j][1],a.z-before[j][2]));
   const record=stats.animals[j],distance=Math.hypot(a.x-before[j][0],a.z-before[j][2]);
   record.distance+=distance;
   if(a.stroke<before[j][3])record.strokeResets++;
   if(distance<1e-5)record.currentStallSeconds+=1/60;else record.currentStallSeconds=0;
   record.maxStallSeconds=Math.max(record.maxStallSeconds,record.currentStallSeconds);
   if(a.terrainBlocked)stats.blocked[a.species]=(stats.blocked[a.species]||0)+1;
  }
 }
 stats.normalRelocations=sim.terrainRelocations-stats.relocations;
 stats.calls=queries-calls;stats.milliseconds=performance.now()-start;
 stats.animals.forEach((record,i)=>{record.netDisplacement=Math.hypot(sim.animals[i].x-record.start[0],sim.animals[i].z-record.start[1]);delete record.currentStallSeconds;});
 reports.push(stats);
}
Object.values(creatures).forEach(parts=>Object.values(parts).forEach(g=>g?.dispose?.()));
const result={createdAt:new Date().toISOString(),sourceHashes,initialization:'sediment fallback then combined field binding, matching Wildlife.jsx',animatedAudit:'exact deformed manta/shark vertices at every60Hz step; all44 full-body envelopes',rockCount:field.rockGroups.length,spawnSeeds:200,spawnUnavailable,spawnConflicts,runSeconds:180,simulationHz:60,reports};
fs.writeFileSync('/Users/sudhir/Desktop/create/experiment/port/_ref/wildlife-terrain-audit-89.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,reports:reports.map(({animals,...report})=>({...report,maxStallSeconds:Math.max(...animals.map(a=>a.maxStallSeconds)),minimumDistance:Math.min(...animals.map(a=>a.distance)),strokeResets:animals.reduce((n,a)=>n+a.strokeResets,0)}))},null,2));
