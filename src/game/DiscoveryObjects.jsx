import NodeShaderMaterial from './rendering/NodeShaderMaterial.jsx';
import { useRef } from 'react';
import { AdditiveBlending } from 'three';
import { useFrame } from '@react-three/fiber';
import { DOCK_NOTE, SHELL } from './Discoveries.js';
import { DOCK } from './WalkingSurface.js';
import { gateGround } from './MalaiVasalGeometry.js';

function DockWisp({ journey, paused }) {
  const root = useRef(), flame = useRef(), halo = useRef(), core = useRef();
  const haloMaterial = useRef(), groundMaterial = useRef();
  const state = useRef({ time: 0, fade: journey.current.noteRead ? 0 : 1, resetId: journey.current.resetId });
  useFrame(({ camera }, delta) => {
    const s = state.current, dt = Math.min(delta, 0.05);
    if (s.resetId !== journey.current.resetId) {
      s.resetId = journey.current.resetId;
      s.fade = journey.current.noteRead ? 0 : 1;
    }
    if (!paused) {
      s.time += dt;
      s.fade = Math.max(0, Math.min(1, s.fade + (journey.current.noteRead ? -dt / 0.8 : dt * 2)));
    }
    root.current.visible = s.fade > 0.001;
    flame.current.position.y = 2.9 + Math.sin(s.time * 1.8) * 0.09 + (1 - s.fade) * 0.25;
    flame.current.scale.setScalar(0.92 + Math.sin(s.time * 2.4) * 0.08);
    core.current.rotation.y = s.time * 0.65;
    core.current.material.opacity = s.fade;
    halo.current.quaternion.copy(camera.quaternion);
    haloMaterial.current.uniforms.opacity.value = s.fade * 0.7;
    groundMaterial.current.uniforms.opacity.value = s.fade * (0.25 + Math.sin(s.time * 1.8) * 0.035);
  });
  return <group ref={root} position={[DOCK_NOTE.x, DOCK.deckHeight + 0.018, DOCK_NOTE.z]} name="Golden discovery wisp">
    <group ref={flame} position={[0, 2.9, 0]}>
      <mesh ref={core} scale={[0.12, 0.22, 0.12]} renderOrder={6}>
        <octahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffe7a0" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={halo} renderOrder={6}>
        <planeGeometry args={[1.05, 1.05]} />
        <NodeShaderMaterial kind="glow" ref={haloMaterial}
          uniforms={{ opacity: { value: 0.7 } }} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
      <planeGeometry args={[0.95, 0.95]} />
      <NodeShaderMaterial kind="glow" ref={groundMaterial}
        uniforms={{ opacity: { value: 0.25 } }} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  </group>;
}

export default function DiscoveryObjects({ journey, paused }) {
  const shell = useRef(), glint = useRef(), time = useRef(0);
  const floor = gateGround(SHELL.x, SHELL.z + 12);
  useFrame((_, delta) => {
    if (!paused) time.current += Math.min(delta, 0.05);
    shell.current.visible = journey.current.shellRevealed;
    glint.current.visible = !journey.current.shellFound;
    glint.current.scale.setScalar(0.75 + Math.sin(time.current * 2) * 0.25);
  });
  return <>
    <DockWisp journey={journey} paused={paused} />
    <group ref={shell} visible={false} position={[SHELL.x, floor + 0.035, SHELL.z]}>
      <mesh scale={[0.17, 0.055, 0.14]} rotation={[0, 0.35, 0]} receiveShadow>
        <sphereGeometry args={[1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffe3cc" roughness={0.68} flatShading side={2} />
      </mesh>
      {[-2,-1,0,1,2].map(i => <mesh key={i} position={[i*0.035, 0.043, 0]} rotation={[0,i*0.14,0]}>
        <boxGeometry args={[0.009,0.009,0.19-Math.abs(i)*0.025]} /><meshStandardMaterial color="#d6a994" />
      </mesh>)}
      <mesh ref={glint} position={[0, 0.22, 0]}>
        <octahedronGeometry args={[0.05, 0]} /><meshBasicMaterial color="#fff0c7" />
      </mesh>
    </group>
  </>;
}
