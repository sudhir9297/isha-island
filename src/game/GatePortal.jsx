import NodeShaderMaterial from './rendering/NodeShaderMaterial.jsx';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,DoubleSide,AdditiveBlending,NormalBlending} from 'three';
import {createPortalVisibility,stepPortalVisibility} from './PortalVisibility.js';
import {GATE} from './GateTerrain.js';
import {ISLAND_CENTER_Z} from './Seabed.js';


// Normal alpha blending reveals the actor during entry; the ground halo is additive.
// Two small quads, no lights, textures, bloom pass, or per-frame allocations.
export default function GatePortal({journey,paused}){
  const visibility=useRef(createPortalVisibility());
  const previous=useRef(null),pulse=useRef(0),time=useRef(0);
  const reducedMotion=useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const uniforms=useMemo(()=>({uTime:{value:0},uPulse:{value:0},uGround:{value:0},uOpacity:{value:1},uGold:{value:new Color('#dcfaff')},uMist:{value:new Color('#249eea')}}),[]);
  const portalMaterial=useRef(),groundMaterial=useRef();
  const groundUniforms=useMemo(()=>({...uniforms,uGround:{value:1}}),[uniforms]);
  const z=ISLAND_CENTER_Z+GATE.z-.35;
  useFrame((_,delta)=>{
    const s=journey.current,p=s.position,old=previous.current;
    const opacity=stepPortalVisibility(visibility.current,s,z,delta,paused);
    if(!paused){
      if(old&&old.resetId===s.resetId&&s.mode==='walking'&&old.mode==='walking'&&Math.abs(p.x-GATE.x)<1.55&&Math.abs(p.z-old.z)<1&&((old.z>=z&&p.z<z)||(old.z<=z&&p.z>z)))pulse.current=1;
      time.current+=Math.min(delta,.05)*(reducedMotion.current?.25:1);
      pulse.current=Math.max(0,pulse.current-Math.min(delta,.05)/1.25);
    }
    if(!previous.current)previous.current={z:p.z,mode:s.mode,resetId:s.resetId};
    else{previous.current.z=p.z;previous.current.mode=s.mode;previous.current.resetId=s.resetId;}
    // Update the actual GPU materials, not the initial React uniform props.
    if(portalMaterial.current){
      portalMaterial.current.uniforms.uOpacity.value=opacity;
      portalMaterial.current.uniforms.uTime.value=time.current;
      portalMaterial.current.uniforms.uPulse.value=reducedMotion.current?0:pulse.current;
    }
    if(groundMaterial.current){
      groundMaterial.current.uniforms.uTime.value=time.current;
      groundMaterial.current.uniforms.uPulse.value=reducedMotion.current?0:pulse.current;
    }
  });
  const material={uniforms,transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false,blending:AdditiveBlending};
  return <group name="Malai Vasal luminous threshold">
    <mesh position={[GATE.x,GATE.floor+1.8,z]} renderOrder={6}>
      <planeGeometry args={[3.7,4.05]}/><NodeShaderMaterial kind="portal" ref={portalMaterial} {...material} blending={NormalBlending}/>
    </mesh>
    <mesh position={[GATE.x,GATE.floor+.065,z]} rotation={[-Math.PI/2,0,0]} renderOrder={6}>
      <planeGeometry args={[3.8,1.8]}/><NodeShaderMaterial kind="portal" ref={groundMaterial} {...material} uniforms={groundUniforms}/>
    </mesh>
  </group>;
}
