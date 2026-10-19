import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {interactionTarget} from './InteractionTargets.js';
export default function InteractionMarker({journey,paused}) {
  const marker=useRef();
  useFrame(()=>{
    const p=interactionTarget(journey.current);
    marker.current.visible=!paused&&Boolean(p);
    if(p)marker.current.position.set(p.x,p.y+.035,p.z);
  });
  return <mesh ref={marker} rotation={[-Math.PI/2,0,0]} visible={false} name="Nearby interaction cue" renderOrder={3}>
    <ringGeometry args={[.34,.37,40]}/><meshBasicMaterial color="#fff1c5" transparent opacity={.6} depthWrite={false}/>
  </mesh>;
}
