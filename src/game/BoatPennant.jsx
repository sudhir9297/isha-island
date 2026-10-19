import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {DoubleSide,Shape} from 'three';
const pennantShape=new Shape();pennantShape.moveTo(0,0);pennantShape.lineTo(.35,-.1);pennantShape.lineTo(0,-.2);pennantShape.closePath();
import {PENNANTS} from './BoatCosmetics.js';
export default function BoatPennant({id,paused}) {
  const flag=useRef(),time=useRef(0);
  useFrame((_,dt)=>{if(paused||!flag.current)return;time.current+=dt;flag.current.rotation.y=.2+Math.sin(time.current*3)*.13;});
  const style=PENNANTS.find(p=>p.id===id);
  if(!style)return null;
  return <group position={[.59,.57,1.25]}>
    <mesh position={[0,.4,0]}><cylinderGeometry args={[.015,.02,.8,6]}/><meshStandardMaterial color="#e4c99a"/></mesh>
    <group ref={flag} position={[0,.75,0]}><mesh><shapeGeometry args={[pennantShape]}/><meshStandardMaterial color={style.color} side={DoubleSide} roughness={.85}/></mesh></group>
  </group>;
}
