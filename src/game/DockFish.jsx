import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Object3D } from 'three';
import { createDockFish, stepDockFish, dockFishTarget, DOCK_FISH_CENTER } from './DockFish.js';
import { createDockFishGeometry } from './WildlifeGeometry.js';
import { seabedMaxHeightWithin } from './Seabed.js';
import { prepareMovingInstances, commitMovingInstances } from './MovingInstances.js';
export default function DockFish({journey,boatState,paused}) {
  const bodies=useRef(),tails=useRef(),simulation=useRef(createDockFish());
  const geometry=useMemo(()=>createDockFishGeometry(),[]);
  const objects=useMemo(()=>{const root=new Object3D(),tail=new Object3D();root.add(tail);return {root,tail};},[]);
  useEffect(()=>()=>{geometry.body.dispose();geometry.tail.dispose();},[geometry]);
  /* eslint-disable react/immutability -- Three.js transforms are mutable frame simulation objects. */
  useFrame((_,delta)=>{
    const s=journey.current, b=boatState.current, viewer=s.mode==='aboard'?b.position:s.position;
    const visible=Math.hypot(viewer.x-DOCK_FISH_CENTER.x,viewer.z-DOCK_FISH_CENTER.z)<35;
    bodies.current.visible=tails.current.visible=visible;
    if(!visible)return;
    const state=stepDockFish(simulation.current,s,b,delta,paused||Boolean(s.activeDiscovery));
    const {root,tail}=objects;
    for(let i=0;i<12;i++) {
      const p=dockFishTarget(state,i);
      const floor=seabedMaxHeightWithin(p.x,p.z,.55);
      const y=Math.max(p.y,floor+.22);
      root.position.set(p.x,y,p.z);root.rotation.set(0,p.heading,Math.sin(state.time*2+i)*.07);
      root.scale.setScalar(y>-.25?0:.48+(i%3)*.045);
      tail.position.set(geometry.tailX,0,0);tail.rotation.y=Math.sin(p.stroke)*(.2+Math.min(.25,p.speed*.2));
      root.updateMatrixWorld(true);
      bodies.current.setMatrixAt(i,root.matrixWorld);tails.current.setMatrixAt(i,tail.matrixWorld);
    }
    commitMovingInstances(bodies.current);commitMovingInstances(tails.current);
  });
  /* eslint-enable react/immutability */
  return <group name="Curious fish beneath the dock">{[[bodies,geometry.body],[tails,geometry.tail]].map(([ref,g],i)=><instancedMesh key={i} ref={ref} args={[g,null,12]} onUpdate={prepareMovingInstances}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.5}/></instancedMesh>)}</group>;
}
