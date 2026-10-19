import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Shape } from 'three';
import { ScallopShell } from './DiscoveryObjects.jsx';
function ItemModel({id,rotation}) {
  const leaf=useMemo(()=>{const s=new Shape();s.moveTo(0,-.9);s.bezierCurveTo(-.65,-.35,-.55,.45,0,.95);s.bezierCurveTo(.55,.45,.65,-.35,0,-.9);return s;},[]);
  return <group rotation={[0,rotation,0]}>
    {id==='shell'?<ScallopShell showOutline={false}/>:id==='leaf'?<group rotation={[-Math.PI/2,0,-.3]}>
      <mesh><extrudeGeometry args={[leaf,{depth:.04,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.02}]}/><meshStandardMaterial color="#a9c66b" roughness={.8}/></mesh>
      <mesh position={[0,0,.07]}><boxGeometry args={[.025,1.7,.025]}/><meshStandardMaterial color="#567539"/></mesh>
    </group>:<mesh scale={[.8,.36,.58]}><icosahedronGeometry args={[1,2]}/><meshStandardMaterial color="#94b9c4" roughness={.55}/></mesh>}
  </group>;
}
export default function KeepsakeInspector({item}) {
  const [rotation,setRotation]=useState(.3),drag=useRef(null);
  return <div className="keepsake-inspection">
    <div className="keepsake-turntable" tabIndex={0} role="group" aria-label={`Inspect ${item.name}. Drag or use left and right arrow keys to rotate.`}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();setRotation(r=>r+(e.key==='ArrowLeft'?-.3:.3));}}}
      onPointerDown={e=>{drag.current=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(drag.current===null)return;const dx=e.clientX-drag.current;drag.current=e.clientX;setRotation(r=>r+dx*.012);}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
      <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[0,2.5,2.8],fov:38}} gl={{alpha:true,antialias:true}} fallback={<p>3D preview unavailable. {item.memory}</p>}>
        <ambientLight intensity={1.5}/><directionalLight position={[3,5,4]} intensity={3}/><ItemModel id={item.id} rotation={rotation}/>
      </Canvas>
    </div>
    <div className="keepsake-rotate"><button aria-label="Rotate keepsake left" onClick={()=>setRotation(r=>r-.4)}>↶</button><small>Drag to turn</small><button aria-label="Rotate keepsake right" onClick={()=>setRotation(r=>r+.4)}>↷</button><button onClick={()=>setRotation(.3)}>Reset</button></div>
  </div>;
}
