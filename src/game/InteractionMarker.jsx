import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
export default function InteractionMarker({journey,paused}) {
  const marker=useRef();
  useFrame(()=>{
    const s=journey.current;
    const p=s.mode==='aboard'?(s.canLand?s.availableLanding:null):s.position.distanceTo(s.landing)<3?s.landing:null;
    marker.current.visible=!paused&&Boolean(p)&&s.mode!=='resting';
    if(p)marker.current.position.set(p.x,p.y+.04,p.z);
  });
  return <mesh ref={marker} rotation={[-Math.PI/2,0,0]} visible={false}>
    <ringGeometry args={[.34,.39,32]}/><meshBasicMaterial color="#fff1c5" transparent opacity={.65} depthWrite={false}/>
  </mesh>;
}
