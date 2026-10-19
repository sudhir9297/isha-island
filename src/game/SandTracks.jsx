import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CircleGeometry, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTrackPool, stepTracks, trackFadeBucket } from './SandTracks.js';
import { prepareMovingInstances, commitMovingInstances } from './MovingInstances.js';
function trackGeometry(crab) {
  const pieces=[];
  const oval=(x,z,sx,sz)=>{const g=new CircleGeometry(1,10);g.rotateX(-Math.PI/2);g.scale(sx,1,sz);g.translate(x,0,z);pieces.push(g);};
  if(crab)for(const side of [-1,1])for(let i=0;i<3;i++)oval(side*(.1+i*.025),(i-1)*.055,.018,.035);
  else {oval(0,.055,.075,.09);oval(0,-.075,.085,.12);}
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return geometry;
}
function Tracks({journey,paused,crab=false}) {
  const meshes=useRef([]),pool=useRef(createTrackPool(crab?96:128)),part=useRef(new Object3D()),lastReset=useRef(null),lastCrab=useRef(null);
  const geometry=useMemo(()=>trackGeometry(crab),[crab]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame((_,delta)=>{
    const s=journey.current;
    if(lastReset.current!==s.resetId){pool.current=createTrackPool(crab?96:128);lastReset.current=s.resetId;lastCrab.current=null;}
    if(!paused&&!s.activeDiscovery) {
      const p=crab?s.crabPosition:s.position;
      let heading=s.heading;
      if(crab&&p&&lastCrab.current)heading=Math.atan2(p.x-lastCrab.current.x,p.z-lastCrab.current.z);
      if(p)stepTracks(pool.current,p,heading,delta,crab ? Number.isFinite(p.y) : s.mode==='walking'&&!s.jumping&&!s.benchSeated,crab);
      if(crab&&p)lastCrab.current={x:p.x,z:p.z};
    }
    const counts=new Array(8).fill(0),o=part.current;
    for(const mark of pool.current.marks) {
      const bucket=trackFadeBucket(mark);if(!Number.isFinite(bucket)||bucket>=8)continue;
      o.position.set(mark.x,mark.y,mark.z);o.rotation.set(0,mark.heading,0);o.scale.setScalar(1);o.updateMatrix();
      meshes.current[bucket].setMatrixAt(counts[bucket]++,o.matrix);
    }
    meshes.current.forEach((mesh,i)=>{mesh.count=counts[i];mesh.visible=counts[i]>0;if(counts[i])commitMovingInstances(mesh);});
  });
  return <group name={crab?'Crab tracks in the sand':'Fading footprints'}>{Array.from({length:8},(_,i)=><instancedMesh key={i} ref={el=>{meshes.current[i]=el;}} args={[geometry,null,crab?96:128]} onUpdate={prepareMovingInstances} renderOrder={2}><meshBasicMaterial color={crab?'#8e633b':'#956e42'} transparent opacity={(crab?.35:.25)*(1-i/8)} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></instancedMesh>)}</group>;
}
export default function SandTracks(props) {return <><Tracks {...props}/><Tracks {...props} crab/></>;}
