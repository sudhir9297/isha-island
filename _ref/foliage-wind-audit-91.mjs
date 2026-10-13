import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
function load(path) {
  let text = fs.readFileSync(path, 'utf8').split('function Beam(')[0];
  text = text.replace(/^import .*\n/gm, '');
  for (const [name, value, end] of [['Palm','data','function makePetal('],['PlantBed','geometries','function Broadleaf('],['Broadleaf','data',null]]) {
    const start = text.indexOf(`function ${name}(`);
    const finish = end ? text.indexOf(end,start) : text.length;
    const block = text.slice(start,finish), jsx = block.indexOf('  return (\n');
    text = text.slice(0,start) + block.slice(0,jsx) + `  return ${value};\n}\n\n` + text.slice(finish);
  }
  const context={THREE,mergeGeometries,useMemo:fn=>fn(),useEffect:()=>{},useIslandWind:()=>[{},()=>{}],addLeafWind:(g,root,reach)=>{
    const pos=g.attributes.position;root??=new THREE.Vector3().fromBufferAttribute(pos,0);let distance=reach??0;
    if (!reach) for(let i=0;i<pos.count;i++)distance=Math.max(distance,new THREE.Vector3().fromBufferAttribute(pos,i).distanceTo(root));
    const roots=[],reaches=[];for(let i=0;i<pos.count;i++){roots.push(...root.toArray());reaches.push(distance);}
    g.setAttribute('leafWindRoot',new THREE.Float32BufferAttribute(roots,3));g.setAttribute('leafWindReach',new THREE.Float32BufferAttribute(reaches,1));return g;
  }};
  vm.createContext(context);vm.runInContext(text+'\nthis.api={Palm,PlantBed,Broadleaf,random,AUTHORED_GARDENS};',context);return context.api;
}
const current=load('src/game/Island.jsx'), before=load('/private/tmp/island-foliage91-before.jsx');
const palms=[[-5.6,.46,-.3,5.1,.85,71],[5.2,.45,-2.4,5.9,1.1,381],[-2.6,.46,-4.4,5.9,.7,171],[1.6,.4,-6.4,5.2,.85,493],[-7.4,.38,-3.3,4.6,1,674],[7,.42,-4.9,4.4,.8,24],[-6.7,.4,3.2,4.2,1.1,102],[-.8,.4,-6.9,4.6,.7,675]].map(([x,y,z,height,lean,seed])=>({kind:'Palm',position:[x,y,z-12],height,lean,seed,scale:1,windHeight:height,tip:.09}));
const broad=[[-8.1,.37,-1.2,.72],[-5,.42,-4.8,.9],[-4,.45,-2.5,.8],[4.5,.42,-5.2,.95],[7.4,.39,-1.5,.7],[.5,.43,-6.3,.8],[2.9,.44,-3.8,.8]].map(([x,y,z,scale],i)=>({kind:'Broadleaf',position:[x,y,z-12],scale,seed:218+i*44,windHeight:3,tip:.06}));
const rnd=current.random(884),beds=[];
for(let i=0;i<34;i++){
 const a=i/34*Math.PI*2,r=.43+rnd()*.27,x=Math.cos(a)*r*11,z=Math.sin(a)*r*8;
 if(z>-3&&z<4&&x>-2.9&&x<3.6)continue;if(z>2.5&&x>-3.7)continue;
 beds.push({position:[x,.43,z],scale:.6+rnd()*.38,seed:i*99+71,flowers:rnd()>.48});
}
beds.push(...current.AUTHORED_GARDENS);
beds.push({position:[-1.67,.82,2.43],scale:.6,seed:902},{position:[-2.08,2.55,3.11],scale:.42,seed:529},{position:[2.08,2.55,3.11],scale:.45,seed:931},{position:[-2.08,1.7,3.11],scale:.25,seed:691,flowers:false},{position:[2.08,1.85,3.11],scale:.32,seed:921,flowers:false});
const specifications=[...palms,...broad,...beds.map(s=>({...s,kind:'PlantBed',position:[s.position[0],s.position[1],s.position[2]-12],scale:s.scale??1,windHeight:.9,tip:.045}))];
function baseWind(world,s,time){const height=s.windHeight*s.scale,h=THREE.MathUtils.clamp((world.y-s.position[1])/height,0,1),phase=s.position[0]*.25+s.position[2]*.17,gust=.65*Math.sin(time*.63-phase)+.35*Math.sin(time*1.17-phase*.73);return new THREE.Vector3(.8,0,.6).multiplyScalar(height*.026*h*h*gust);}
function deform(p,anchor,reach,s,time){const root=new THREE.Vector3(...s.position),world=p.clone().multiplyScalar(s.scale).add(root),a=anchor.clone().multiplyScalar(s.scale).add(root),offset=baseWind(world,s,time),height=s.windHeight*s.scale,tip=(THREE.MathUtils.clamp(world.distanceTo(a)/(reach*s.scale),0,1))**2,phase=a.x*.25+a.z*.17,gust=.65*Math.sin(time*.63-phase)+.35*Math.sin(time*1.17-phase*.73),ripple=Math.sin(time*2.15-world.x*1.1-world.z*.8),motion=s.tip*s.scale;
 offset.add(new THREE.Vector3(.8,0,.6).multiplyScalar(motion*tip*(.72*gust+.28*ripple)));offset.y+=motion*tip*.34*ripple*(.65+.35*gust);if(a.y-root.y<height*.2)offset.sub(baseWind(a,s,time));return p.clone().addScaledVector(offset,1/s.scale);
}
let vertices=0,triangles=0,normalFailures=0,positionFailures=0,deformedSamples=0,rootSamples=0,maxRootError=0,maxMotion=0,maxNormalLengthError=0,worsenedBedMin=0,boundsViolations=0;
const perObject=[];
for(const s of specifications){
 const data=current[s.kind](s), old=before[s.kind](s),g=data.leaves,oldg=old.leaves;
 const pos=g.attributes.position,norm=g.attributes.normal,roots=g.attributes.leafWindRoot,reach=g.attributes.leafWindReach;
 vertices+=pos.count;triangles+=g.index.count/3;let minY=Infinity,oldMin=Infinity;
 for(let i=0;i<oldg.attributes.position.count;i++)oldMin=Math.min(oldMin,oldg.attributes.position.getY(i));
 for(let i=0;i<pos.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(pos,i),n=new THREE.Vector3().fromBufferAttribute(norm,i);
   minY=Math.min(minY,p.y);if(!p.toArray().every(Number.isFinite))positionFailures++;
   const normalError=Math.abs(n.length()-1);maxNormalLengthError=Math.max(maxNormalLengthError,normalError);if(normalError>1e-5||!Number.isFinite(normalError))normalFailures++;
 }
 // 97 samples span over six slow gust cycles and all component phases.
 const stride=Math.max(1,Math.floor(pos.count/48));
 for(let time=0;time<=96;time++)for(let i=0;i<pos.count;i+=stride){
   const p=new THREE.Vector3().fromBufferAttribute(pos,i),n=new THREE.Vector3().fromBufferAttribute(norm,i),a=new THREE.Vector3().fromBufferAttribute(roots,i),r=reach.getX(i),center=deform(p,a,r,s,time);
   deformedSamples++;if(!center.toArray().every(Number.isFinite))positionFailures++;
   const motion=center.distanceTo(p)*s.scale;maxMotion=Math.max(maxMotion,motion);if(motion>s.windHeight*s.scale*.04+s.tip*s.scale*1.5+.04)boundsViolations++;
   const axis=Math.abs(n.y)<.95?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=new THREE.Vector3().crossVectors(axis,n).normalize(),bitangent=new THREE.Vector3().crossVectors(n,tangent);
   const along=deform(p.clone().addScaledVector(tangent,.005),a,r,s,time).sub(center),across=deform(p.clone().addScaledVector(bitangent,.005),a,r,s,time).sub(center),deformedNormal=new THREE.Vector3().crossVectors(along,across).normalize();
   const error=Math.abs(deformedNormal.length()-1);maxNormalLengthError=Math.max(maxNormalLengthError,error);if(error>1e-5||!deformedNormal.toArray().every(Number.isFinite))normalFailures++;
   if(p.distanceTo(a)<1e-6){rootSamples++;const actual=deform(a,a,r,s,time),expected=a.clone();const aw=a.clone().multiplyScalar(s.scale).add(new THREE.Vector3(...s.position));if(aw.y-s.position[1]>=s.windHeight*s.scale*.2)expected.addScaledVector(baseWind(aw,s,time),1/s.scale);maxRootError=Math.max(maxRootError,actual.distanceTo(expected));}
 }
 if(s.kind==='PlantBed'&&minY<oldMin-1e-4)worsenedBedMin++;
 perObject.push({kind:s.kind,seed:s.seed,vertices:pos.count,minY,oldMin,deltaMinY:minY-oldMin});
 for(const resource of [...Object.values(data),...Object.values(old)])if(resource?.isBufferGeometry)resource.dispose();
}
const summary={objects:specifications.length,palms:palms.length,broadleaf:broad.length,beds:beds.length,vertices,triangles,deformedSamples,rootSamples,maxRootError,maxMotion,maxNormalLengthError,normalFailures,positionFailures,boundsViolations,worsenedBedMin,perObject};
fs.writeFileSync('_ref/foliage-wind-audit-91.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,perObject:undefined},null,2));
if(normalFailures||positionFailures||boundsViolations||maxRootError>1e-6||worsenedBedMin)process.exitCode=1;
