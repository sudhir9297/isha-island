import { Vector2 } from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ACTIVITIES, DOCK_BELL, skippingStonePose } from './IslandActivities.js';
import { islandGroundAt } from './IslandGround.js';
const BELL_PROFILE = [[.36,0],[.39,.04],[.37,.09],[.29,.15],[.23,.29],[.21,.43],[.17,.52],[.09,.57],[0,.58]].map(([r,h])=>new Vector2(r,h));
export default function IslandActivities({ journey, paused, audio }) {
  const bell=useRef(), stone=useRef(), rings=useRef([]), droplets=useRef([]), trail=useRef([]), birds=useRef([]), last=useRef(null), lastHop=useRef(-1), bellSounded=useRef(false);
  useFrame(() => {
    const event=journey.current.activity;
    if (event !== last.current) {
      last.current=event; lastHop.current=-1;
      bellSounded.current=false;
    }
    const t=event?.time ?? 0, ringing=event?.id==='bell'&&t>=0, skipping=event?.id==='stones'&&t>=0;
    if(ringing&&!bellSounded.current&&!paused){audio.bell({x:DOCK_BELL.x,y:DOCK_BELL.y+1.5,z:DOCK_BELL.z});bellSounded.current=true;}
    bell.current.rotation.z=ringing ? Math.sin(t*12)*.42*Math.exp(-t*.8) : 0;
    const pose=skippingStonePose(t);
    stone.current.visible=skipping && pose.visible;
    stone.current.position.set(2,pose.y+.1,pose.z);
    stone.current.rotation.x=t*16;
    if(skipping && pose.hop!==lastHop.current && !paused) {
      if(pose.hop>=0) audio.splash({x:2,y:0,z:pose.z});
      lastHop.current=pose.hop;
    }
    rings.current.forEach((ring,i)=>{
      const age=t-.45-Math.floor(i/2)*.65-(i%2)*.12;
      ring.visible=skipping && age>=0 && age<1.1;
      ring.position.set(2,.16,-1+Math.floor(i/2)*1.6);
      ring.scale.setScalar(.12+Math.max(0,age)*1.7);
      ring.material.opacity=Math.max(0,1-age/1.1)*.85;
    });
    droplets.current.forEach((drop,i)=>{
      const impact=Math.floor(i/6), n=i%6, age=t-.45-impact*.65;
      drop.visible=skipping && age>=0 && age<.5;
      const a=n*Math.PI/3, r=Math.max(0,age)*1.2;
      drop.position.set(2+Math.cos(a)*r,.15+Math.max(0,Math.sin(age/.5*Math.PI))*(.35+(n%2)*.2),-1+impact*1.6+Math.sin(a)*r);
      drop.scale.setScalar(.045*Math.max(0,1-age/.5));
    });
    trail.current.forEach((dot,i)=>{
      const age=t-(i+1)*.035, previous=skippingStonePose(Math.max(0,age));
      dot.visible=skipping && age>=0 && pose.visible;
      dot.position.set(2,previous.y+.1,previous.z);
      dot.scale.setScalar(.055*(1-i/8));
    });
    birds.current.forEach((bird,i)=>{
      bird.visible=ringing;
      bird.position.set(-4-i*.55-t*(.8+i*.2),2+i*.3+Math.sin(Math.min(1,t/3)*Math.PI/2)*3,-11-t*.9);
      bird.rotation.z=Math.sin(t*15+i)*.18;
      bird.scale.setScalar(Math.min(1,t*4)*Math.min(1,(5-t)*2));
    });
  });
  const b=DOCK_BELL, y=b.y;
  const s=ACTIVITIES.stones, sy=islandGroundAt(s.x,s.z);
  return <>
    <group position={[b.x,y,b.z]} rotation={[0,b.rotation,0]} name="Dock bell">
      {[-.48,.48].map(x=><mesh key={x} position={[x,1,0]} castShadow userData={{walkingSolid:true}}><boxGeometry args={[.12,2,.14]}/><meshStandardMaterial color="#775439"/></mesh>)}
      <mesh position={[0,2,0]} castShadow><boxGeometry args={[1.15,.14,.18]}/><meshStandardMaterial color="#775439"/></mesh>
      <group ref={bell} position={[0,1.86,0]}>
        <mesh position={[0,-.06,0]}><torusGeometry args={[.095,.027,8,20]}/><meshStandardMaterial color="#f4cd74" metalness={.55} roughness={.32}/></mesh>
        <mesh position={[0,-.7,0]} castShadow>
          <latheGeometry args={[BELL_PROFILE,24]}/>
          <meshStandardMaterial color="#e1ae4d" emissive="#9e651d" emissiveIntensity={.12} metalness={.55} roughness={.32} side={2}/>
        </mesh>
        <mesh position={[0,-.66,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.37,.035,8,32]}/><meshStandardMaterial color="#ffe09a" metalness={.6} roughness={.26}/></mesh>
        <mesh position={[0,-.75,0]}><sphereGeometry args={[.085,10,8]}/><meshStandardMaterial color="#62401f"/></mesh>
        <mesh position={[0,-1.01,0]}><cylinderGeometry args={[.022,.022,.5,8]}/><meshStandardMaterial color="#efd59c"/></mesh>
        <mesh position={[0,-1.28,0]}><sphereGeometry args={[.055,8,6]}/><meshStandardMaterial color="#efd59c"/></mesh>
      </group>
    </group>
    <group position={[s.x,sy,s.z]} name="Stone skipping spot">
      {[0,1,2,3,4].map(i=><mesh key={i} position={[(i%3-.8)*.19,.06+Math.floor(i/3)*.07,Math.floor(i/3)*.18]} scale={[.16,.055,.12]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#b5b8a1"/></mesh>)}
    </group>
    <mesh ref={stone} visible={false} scale={[.14,.065,.11]}><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="#d0cbb6"/></mesh>
    {Array.from({length:8},(_,i)=><mesh key={i} renderOrder={8} ref={el=>{rings.current[i]=el;}} visible={false} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.92,1,40]}/><meshBasicMaterial color="#e8ffff" toneMapped={false} transparent depthWrite={false} depthTest={false}/></mesh>)}
    {Array.from({length:24},(_,i)=><mesh key={`drop${i}`} ref={el=>{droplets.current[i]=el;}} visible={false}><sphereGeometry args={[1,5,4]}/><meshBasicMaterial color="#d7ffff" toneMapped={false}/></mesh>)}
    {Array.from({length:8},(_,i)=><mesh key={`trail${i}`} ref={el=>{trail.current[i]=el;}} visible={false}><sphereGeometry args={[1,5,4]}/><meshBasicMaterial color="#fff2c9" transparent opacity={.55} depthWrite={false}/></mesh>)}
    {[0,1,2].map(i=><group key={i} ref={el=>{birds.current[i]=el;}} visible={false}>{[-1,1].map(side=><mesh key={side} rotation={[0,0,side*.3]} position={[side*.16,0,0]} scale={[.23,.035,.07]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color="#fff2cd"/></mesh>)}</group>)}
  </>;
}
