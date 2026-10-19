import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { rowingPose } from './Rowing.js';
export default function RowboatOars({ boatState }) {
  const pivots=useRef([]);
  useFrame(()=>{
    const boat=boatState.current,pose=rowingPose(boat.visualTime??0,Math.abs(boat.speed)>.08);
    pivots.current.forEach((pivot,i)=>{if(pivot){const side=i?1:-1;pivot.rotation.y=side*pose.sweep;pivot.rotation.z=side*(-.14+pose.lift);}});
  });
  return [-1,1].map((side,i)=><group key={side} position={[side*.75,.57,.12]} ref={el=>{pivots.current[i]=el;}}>
    <mesh position={[side*.7,0,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.035,.045,2.65,10]}/><meshStandardMaterial color="#a57545" roughness={.8}/></mesh>
    <mesh position={[side*2,0,0]} castShadow><boxGeometry args={[.65,.055,.23]}/><meshStandardMaterial color="#bd8d57" roughness={.8}/></mesh>
    <mesh><torusGeometry args={[.075,.018,6,12]}/><meshStandardMaterial color="#70593e" metalness={.35}/></mesh>
  </group>);
}
