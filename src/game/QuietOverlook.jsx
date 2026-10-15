import {useRef,useMemo,useEffect} from 'react';
import {BoxGeometry,IcosahedronGeometry,BufferAttribute,Color} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {useFrame} from '@react-three/fiber';
import {gateGround} from './MalaiVasalGeometry.js';
import {REST_SPOT,OVERLOOK_SEAT} from './StoryMoments.js';
export default function QuietOverlook({journey}) {
  const beacon=useRef(), ring=useRef();
  const garden=useMemo(()=>{
    const parts=[];
    const add=(g,x,y,z,sx,sy,sz,color)=>{if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}g.scale(sx,sy,sz);g.translate(x,y,z);const c=new Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new BufferAttribute(a,3));parts.push(g);};
    // Seat stays off the clear central view toward the sea.
    const {x,z}=OVERLOOK_SEAT,ground=gateGround(x,z+12);
    add(new BoxGeometry(),x,ground+.43,z,1.35,.16,.54,'#b5b2a7');
    for(const side of [-1,1])add(new BoxGeometry(),x+side*.43,ground+.17,z,.22,.5,.38,'#8b8c87');
    for(let i=0;i<24;i++){
      const side=i%2?1:-1,px=side*(1.65+(i%5)*.15),pz=REST_SPOT.z+.5+Math.sin(i*2.4)*.65;
      const py=gateGround(px,pz+12),h=.12+(i%3)*.025;
      add(new BoxGeometry(),px,py+h*.5,pz,.018,h,.018,'#688351');
      add(new IcosahedronGeometry(1,0),px,py+h,pz,.065,.025,.065,i%4?'#eee8cf':'#d9c99b');
    }
    const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
  },[]);
  useEffect(()=>()=>garden.dispose(),[garden]);
  const y=gateGround(REST_SPOT.x,REST_SPOT.z+12);
  useFrame(({clock})=>{
    if(!beacon.current)return;
    beacon.current.visible=journey.current.released&&!journey.current.completed;
    if(ring.current)ring.current.material.opacity=.32+Math.sin(clock.elapsedTime*1.4)*.1;
  });
  return <><mesh name="Overlook stone seat and pale flowers" geometry={garden} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={1} flatShading/></mesh><group name="Quiet sea overlook" position={[REST_SPOT.x,y,REST_SPOT.z]}>
    {/* Low stones frame the standing spot, leaving the central walking surface clear. */}
    {[-1,1].map(side=><mesh key={side} position={[side*1.25,-.08,-.35]} scale={[.4,.24,.55]} castShadow receiveShadow>
      <icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#aaa99f" roughness={1} flatShading/>
    </mesh>)}
    <group ref={beacon} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.035,0]}>
        <ringGeometry args={[.46,.49,40]}/><meshBasicMaterial color="#ffe9b3" transparent opacity={.4} depthWrite={false}/>
      </mesh>
      <mesh position={[0,.55,0]} rotation={[0,0,Math.PI/4]} scale={[.065,.065,.065]}>
        <octahedronGeometry/><meshBasicMaterial color="#ffe9b3"/>
      </mesh>
    </group>
  </group></>;
}
