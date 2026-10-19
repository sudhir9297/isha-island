import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { KEEPSAKES } from './Keepsakes.js';
import { islandGroundAt } from './IslandGround.js';
function Keepsake({ item, journey }) {
  const root = useRef(), marker = useRef();
  useFrame(() => {
    const s=journey.current;
    const pickup=s.action?.item===item.id?s.action:null;
    root.current.visible = Boolean(pickup&&pickup.time<.85)||!s.keepsakes?.includes(item.id);
    root.current.position.y=islandGroundAt(item.x,item.z)+.12+(pickup?Math.max(0,pickup.time-.25)*1.4:0);
    root.current.scale.setScalar(pickup?Math.max(0,1-Math.max(0,pickup.time-.55)/.3):1);
    marker.current.visible=s.mode==='walking'&&!s.activeDiscovery&&Math.hypot(s.position.x-item.x,s.position.z-item.z)<3;
  });
  return <group ref={root} position={[item.x, islandGroundAt(item.x,item.z) + .12, item.z]}>
    <mesh scale={item.id === 'leaf' ? [.28,.07,.65] : [.42,.22,.32]} rotation={[0,.5,0]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color={item.color} roughness={.75}/></mesh>
    <mesh ref={marker} visible={false} position={[0,.85,0]}><octahedronGeometry args={[.12,0]}/><meshBasicMaterial color="#ffe69a"/></mesh>
  </group>;
}
export default function IslandKeepsakes({ journey }) {
  return KEEPSAKES.filter(item => item.x !== undefined).map(item => <Keepsake key={item.id} item={item} journey={journey}/>);
}
