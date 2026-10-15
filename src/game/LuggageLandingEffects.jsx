import { contactOpacity } from './rendering/SurfaceNodes.js';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Object3D,DynamicDrawUsage} from 'three';
import {gateGround} from './MalaiVasalGeometry.js';
import {sampleLuggageThrow} from './LuggageThrow.js';
function softenContact(shader){
  shader.vertexShader='varying vec2 vContactUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContactUv=uv;');
  shader.fragmentShader='varying vec2 vContactUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= 1.0-smoothstep(0.18,0.5,length(vContactUv-0.5));');
}
const contactProgram=()=> 'sand-contact-v1';
// Four short impact bursts share one buffer. No timers, allocations, or new
// textures during the throw; all effects follow paused simulation time.
export default function LuggageLandingEffects({journey,flights}){
  const dust=useRef(),shadows=useRef([]),skids=useRef([]);
  const scratch=useMemo(()=>({object:new Object3D(),point:{}}),[]);
  useFrame(()=>{
    if(!dust.current)return;
    let count=0;
    for(let i=0;i<4;i++){
      const f=flights.current[i],s=journey.current,shadow=shadows.current[i],skid=skids.current[i];
      const visible=s.released&&Boolean(f);
      if(shadow)shadow.visible=visible;
      if(skid)skid.visible=false;
      if(!visible)continue;
      const p=sampleLuggageThrow(f,s.releaseTime,scratch.point),floor=gateGround(p.x,p.z+12),age=s.releaseTime-f.duration;
      shadow.position.set(p.x,floor+.012,p.z);
      const proximity=Math.max(0,1-(p.y-floor-.27)/3);
      shadow.scale.set(.27+.14*(1-proximity),.2+.1*(1-proximity),1);
      shadow.material.opacity=.24*proximity;
      if(age>=0&&age<6){
        const hit=f.impact??f.end;
        skid.visible=true;skid.position.set((hit.x+f.end.x)*.5,gateGround((hit.x+f.end.x)*.5,(hit.z+f.end.z)*.5+12)+.016,(hit.z+f.end.z)*.5);
        skid.rotation.z=-Math.atan2(f.end.z-hit.z,f.end.x-hit.x);
        skid.scale.set(.22*Math.min(1,age/.32),.065,1);
        skid.material.opacity=.16*Math.min(1,(6-age)/2);
      }
      if(age<0||age>.8)continue;
      const hit=f.impact??f.end,t=age/.8;
      for(let j=0;j<8;j++){
        const angle=j*2.399+i*.8,r=.05+age*(.35+(j%3)*.15);
        const x=hit.x+Math.cos(angle)*r,z=hit.z+Math.sin(angle)*r;
        const size=(.06+(j%3)*.018)*Math.sin(Math.PI*t);
        scratch.object.position.set(x,gateGround(x,z+12)+.04+Math.sin(t*Math.PI)*(.1+(j%3)*.04),z);
        scratch.object.scale.set(size*1.5,size*.7,size);scratch.object.rotation.set(j,i,angle);scratch.object.updateMatrix();
        dust.current.setMatrixAt(count++,scratch.object.matrix);
      }
    }
    dust.current.count=count;dust.current.visible=count>0;
    if(count){dust.current.instanceMatrix.clearUpdateRanges();dust.current.instanceMatrix.addUpdateRange(0,count*16);dust.current.instanceMatrix.needsUpdate=true;}
  });
  return <group name="Luggage sand contact">
    <instancedMesh ref={dust} args={[null,null,32]} frustumCulled={false} onUpdate={mesh=>{mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.count=0;}}>
      <icosahedronGeometry args={[1,0]}/><meshBasicMaterial color="#d8c5a0"/>
    </instancedMesh>
    {[0,1,2,3].map(i=><group key={i}>
      <mesh ref={el=>{shadows.current[i]=el;}} visible={false} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[1,16]}/><meshBasicMaterial color="#554635" transparent opacity={.2} depthWrite={false} opacityNode={contactOpacity} onBeforeCompile={softenContact} customProgramCacheKey={contactProgram}/>
      </mesh>
      <mesh ref={el=>{skids.current[i]=el;}} visible={false} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[1,12]}/><meshBasicMaterial color="#8d7855" transparent opacity={.15} depthWrite={false} opacityNode={contactOpacity} onBeforeCompile={softenContact} customProgramCacheKey={contactProgram}/>
      </mesh>
    </group>)}
  </group>;
}
