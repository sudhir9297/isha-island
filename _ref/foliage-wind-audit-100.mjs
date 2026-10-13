import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import {gateTerrainHeight} from '../src/game/GateTerrain.js';
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
  const context={THREE,mergeGeometries,useMemo:fn=>fn(),useEffect:()=>{},useIslandWind:()=>[{},()=>{}],addLeafWind:new Function('THREE',fs.readFileSync('src/game/Wind.js','utf8').slice(fs.readFileSync('src/game/Wind.js','utf8').indexOf('export function addLeafWind('),fs.readFileSync('src/game/Wind.js','utf8').indexOf('const windFunctions')).replace('export function','function')+';return addLeafWind;')(THREE)};
  vm.createContext(context);vm.runInContext(text+'\nthis.api={Palm,PlantBed,Broadleaf,random,AUTHORED_GARDENS};',context);return context.api;
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
function gust(time,phase){const swell=Math.sin(time*.63-phase);return .57*swell+.2*swell*swell+.23*Math.sin(time*1.17-phase*.73);}
function baseWind(world,s,time){const height=s.windHeight*s.scale,h=THREE.MathUtils.clamp((world.y-s.position[1])/height,0,1),phase=s.position[0]*.25+s.position[2]*.17;return new THREE.Vector3(.8,0,.6).multiplyScalar(height*.028*h*h*gust(time-h*.18,phase));}
function deform(p,anchor,reach,s,time,axis){const root=new THREE.Vector3(...s.position),world=p.clone().multiplyScalar(s.scale).add(root),a=anchor.clone().multiplyScalar(s.scale).add(root),offset=baseWind(world,s,time),height=s.windHeight*s.scale,tip=THREE.MathUtils.clamp(world.distanceTo(a)/(reach*s.scale),0,1),phase=root.x*.25+root.z*.17,bladePhase=axis.dot(new THREE.Vector3(1.7,.8,2.3))+a.x*.31+a.z*.19,delay=tip*(.38+reach*s.scale*.12),g=gust(time-delay,phase),flutter=Math.sin(time*2.05-delay*2.05+bladePhase)*(.4+.6*Math.abs(g)),weight=tip*tip,motion=s.tip*s.scale;
 offset.add(new THREE.Vector3(.8,0,.6).multiplyScalar(motion*weight*(.82*g+.18*flutter)));offset.y+=motion*weight*.43*flutter;
 const lateral=world.clone().sub(a);lateral.addScaledVector(axis,-lateral.dot(axis));offset.add(new THREE.Vector3().crossVectors(axis,lateral).multiplyScalar((.095*g+.055*flutter)*weight));
 if(a.y-root.y<height*.2)offset.sub(baseWind(a,s,time));return p.clone().addScaledVector(offset,1/s.scale);
}
specifications.forEach(s=>{s.position[1]=gateTerrainHeight(s.position[0],s.position[2]+12,s.position[1]);});
let vertices=0,triangles=0,normalFailures=0,positionFailures=0,deformedSamples=0,rootSamples=0,maxRootError=0,maxMotion=0,maxNormalLengthError=0,worsenedBedMin=0,boundsViolations=0;
const perObject=[];
for(const s of specifications){
 const data=current[s.kind](s), old=before[s.kind](s),g=data.leaves,oldg=old.leaves;
 const pos=g.attributes.position,norm=g.attributes.normal,roots=g.attributes.leafWindRoot,reach=g.attributes.leafWindReach,axes=g.attributes.leafWindAxis;
 vertices+=pos.count;triangles+=g.index.count/3;let minY=Infinity,oldMin=Infinity;
 for(let i=0;i<oldg.attributes.position.count;i++)oldMin=Math.min(oldMin,oldg.attributes.position.getY(i));
 for(let i=0;i<pos.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(pos,i),n=new THREE.Vector3().fromBufferAttribute(norm,i);
   minY=Math.min(minY,p.y);if(!p.toArray().every(Number.isFinite))positionFailures++;
   const normalError=Math.abs(n.length()-1);maxNormalLengthError=Math.max(maxNormalLengthError,normalError);if(normalError>1e-5||!Number.isFinite(normalError))normalFailures++;
 }
 // 37 samples span multiple gust cycles and each blade's delayed response.
 const stride=Math.max(1,Math.floor(pos.count/48));
 for(let time=0;time<=36;time++)for(let i=0;i<pos.count;i+=stride){
   const p=new THREE.Vector3().fromBufferAttribute(pos,i),n=new THREE.Vector3().fromBufferAttribute(norm,i),a=new THREE.Vector3().fromBufferAttribute(roots,i),r=reach.getX(i),axisWind=new THREE.Vector3().fromBufferAttribute(axes,i),center=deform(p,a,r,s,time,axisWind);
   deformedSamples++;if(!center.toArray().every(Number.isFinite))positionFailures++;
   const motion=center.distanceTo(p)*s.scale;maxMotion=Math.max(maxMotion,motion);if(motion>s.windHeight*s.scale*.05+s.tip*s.scale*2+.08)boundsViolations++;
   const axis=Math.abs(n.y)<.95?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=new THREE.Vector3().crossVectors(axis,n).normalize(),bitangent=new THREE.Vector3().crossVectors(n,tangent);
   const along=deform(p.clone().addScaledVector(tangent,.005),a,r,s,time,axisWind).sub(center),across=deform(p.clone().addScaledVector(bitangent,.005),a,r,s,time,axisWind).sub(center),deformedNormal=new THREE.Vector3().crossVectors(along,across).normalize();
   const error=Math.abs(deformedNormal.length()-1);maxNormalLengthError=Math.max(maxNormalLengthError,error);if(error>1e-5||!deformedNormal.toArray().every(Number.isFinite))normalFailures++;
   if(p.distanceTo(a)<1e-6){rootSamples++;const actual=deform(a,a,r,s,time,axisWind),expected=a.clone();const aw=a.clone().multiplyScalar(s.scale).add(new THREE.Vector3(...s.position));if(aw.y-s.position[1]>=s.windHeight*s.scale*.2)expected.addScaledVector(baseWind(aw,s,time),1/s.scale);maxRootError=Math.max(maxRootError,actual.distanceTo(expected));}
 }
 if(s.kind==='PlantBed'&&minY<oldMin-1e-4)worsenedBedMin++;
 perObject.push({kind:s.kind,seed:s.seed,vertices:pos.count,minY,oldMin,deltaMinY:minY-oldMin});
 for(const resource of [...Object.values(data),...Object.values(old)])if(resource?.isBufferGeometry)resource.dispose();
}
const summary={objects:specifications.length,palms:palms.length,broadleaf:broad.length,beds:beds.length,vertices,triangles,deformedSamples,rootSamples,maxRootError,maxMotion,maxNormalLengthError,normalFailures,positionFailures,boundsViolations,worsenedBedMin,perObject};
fs.writeFileSync('_ref/foliage-wind-audit-100.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,perObject:undefined},null,2));
if(normalFailures||positionFailures||boundsViolations||maxRootError>1e-6||worsenedBedMin)process.exitCode=1;
