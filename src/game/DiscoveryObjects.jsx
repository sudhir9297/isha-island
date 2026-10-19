import { useWindField } from './WindContext.js';
import { createShellReveal, stepShellReveal, shellRevealPose } from './ShellReveal.js';
import NodeShaderMaterial from './rendering/NodeShaderMaterial.jsx';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Color, Object3D, Vector3, CatmullRomCurve3, TubeGeometry } from 'three';
import { useFrame } from '@react-three/fiber';
import { DOCK_NOTE, SHELL } from './Discoveries.js';
import { DOCK } from './WalkingSurface.js';
import { gateGround } from './MalaiVasalGeometry.js';

// Both faces carry the envelope folds so the letter remains legible as it turns.
function FloatingEnvelope() {
  return <group rotation={[0, 0, -0.12]}>
    <group name="Envelope interaction outline">
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[0, side * .355, 0]}>
          <boxGeometry args={[1.04, .04, .13]} /><meshBasicMaterial color="#ffe69a" toneMapped={false} />
        </mesh>
        <mesh position={[side * .5, 0, 0]}>
          <boxGeometry args={[.04, .71, .13]} /><meshBasicMaterial color="#ffe69a" toneMapped={false} />
        </mesh>
      </group>)}
    </group>
    <mesh><boxGeometry args={[0.96, 0.68, 0.08]} /><meshStandardMaterial color="#fff1c9" emissive="#ffe7a1" emissiveIntensity={0.35} roughness={0.7} /></mesh>
    {[-1, 1].map(face => <group key={face} position={[0, 0, face * 0.046]} rotation={[0, face === -1 ? Math.PI : 0, 0]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.22, 0.11, 0]} rotation={[0, 0, side * 0.62]}>
        <boxGeometry args={[0.54, 0.025, 0.012]} /><meshBasicMaterial color="#b48648" />
      </mesh>)}
      <mesh position={[0, -0.055, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.025, 16]} /><meshStandardMaterial color="#c65c3e" roughness={0.65} />
      </mesh>
    </group>)}
  </group>;
}

function DockLetter({ journey, paused }) {
  const root = useRef(), flame = useRef(), halo = useRef(), letter = useRef();
  const haloMaterial = useRef(), groundMaterial = useRef();
  const reducedMotion = useRef(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = preference.matches; };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const state = useRef({ time: 0, fade: journey.current.noteRead ? 0 : 1, resetId: journey.current.resetId });
  useFrame(({ camera }, delta) => {
    const s = state.current, dt = Math.min(delta, 0.05);
    if (s.resetId !== journey.current.resetId) {
      s.resetId = journey.current.resetId;
      s.fade = journey.current.noteRead ? 0 : 1;
    }
    if (!paused) {
      if (!reducedMotion.current) s.time += dt;
      s.fade = Math.max(0, Math.min(1, s.fade + (journey.current.noteRead ? -dt / 0.8 : dt * 2)));
    }
    root.current.visible = s.fade > 0.001;
    flame.current.position.y = 2.15 + Math.sin(s.time * 1.8) * 0.08 + (1 - s.fade) * 0.25;
    letter.current.scale.setScalar(s.fade * 0.85);
    letter.current.rotation.y = reducedMotion.current ? 0.3 : s.time * 0.5 + 0.3;
    halo.current.quaternion.copy(camera.quaternion);
    const near=journey.current.mode==='walking'&&Math.hypot(journey.current.position.x-DOCK_NOTE.x,journey.current.position.z-DOCK_NOTE.z)<3;
    haloMaterial.current.uniforms.opacity.value = near ? s.fade * .4 : 0;
    groundMaterial.current.uniforms.opacity.value = (near ? s.fade : 0) * (0.25 + Math.sin(s.time * 1.8) * 0.035);
  });
  return <group ref={root} position={[DOCK_NOTE.x, DOCK.deckHeight + 0.018, DOCK_NOTE.z]} name="Floating letter discovery">
    <group ref={flame} position={[0, 2.15, 0]}>
      <group ref={letter}><FloatingEnvelope /></group>
      <mesh ref={halo} renderOrder={6}>
        <planeGeometry args={[1.2, 1.2]} />
        <NodeShaderMaterial kind="glow" ref={haloMaterial}
          uniforms={{ opacity: { value: 0.4 } }} transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
      <planeGeometry args={[0.95, 0.95]} />
      <NodeShaderMaterial kind="glow" ref={groundMaterial}
        uniforms={{ opacity: { value: 0.25 } }} transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  </group>;
}

// A broad scallop fan with a scalloped lip and raised radial ribs.
export function ScallopShell({ highlight, showOutline = true }) {
  const geometry = useMemo(() => {
    const positions = [], colors = [], indices = [];
    const coral = new Color('#e98d79'), cream = new Color('#fff0da');
    const rings = 12, slices = 64;
    for (let ring = 0; ring <= rings; ring++) {
      const radius = ring / rings;
      for (let slice = 0; slice <= slices; slice++) {
        const t = slice / slices, angle = (t - .5) * 2.5;
        const rib = .5 + .5 * Math.cos(t * Math.PI * 16);
        const reach = radius * (.83 + .035 * rib);
        const dome = Math.sin(radius * Math.PI) * .19;
        positions.push(Math.sin(angle) * reach, .045 + dome + rib * .04 * Math.sin(radius * Math.PI * .85), .34 - Math.cos(angle) * reach);
        const shade = coral.clone().lerp(cream, .22 + rib * .7);
        colors.push(shade.r, shade.g, shade.b);
        if (ring < rings && slice < slices) {
          const i = ring * (slices + 1) + slice;
          indices.push(i, i + 1, i + slices + 1, i + 1, i + slices + 2, i + slices + 1);
        }
      }
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(positions, 3));
    result.setAttribute('color', new Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, []);
  const outline = useMemo(() => {
    const points = [], positions = geometry.attributes.position;
    const add = index => points.push(new Vector3().fromBufferAttribute(positions, index).add(new Vector3(0, .012, 0)));
    // One closed contour surrounds both the fan and the rounded hinge.
    // Starting above the hinge avoids an internal line across its face.
    for (let ring = 3; ring <= 12; ring++) add(ring * 65);
    for (let slice = 1; slice <= 64; slice++) add(12 * 65 + slice);
    for (let ring = 11; ring >= 3; ring--) add(ring * 65 + 64);
    for (let step = 0; step <= 20; step++) {
      const angle = -.35 + step / 20 * (Math.PI + .7);
      points.push(new Vector3(.205 * Math.cos(angle), .095, .31 + .135 * Math.sin(angle)));
    }
    const curve = new CatmullRomCurve3(points, true, 'centripetal');
    return {
      edge: new TubeGeometry(curve, 192, .032, 8, true),
    };
  }, [geometry]);
  useEffect(() => () => { geometry.dispose(); outline.edge.dispose(); }, [geometry, outline]);
  return <group rotation={[0, -.3, 0]} name="Peach scallop shell">
    <group ref={highlight} visible={showOutline} name="Shell interaction outline">
      <mesh geometry={outline.edge} renderOrder={6}>
        <meshBasicMaterial color="#ffe69a" toneMapped={false} />
      </mesh>
    </group>
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={.57} metalness={0} side={2} />
    </mesh>
    <mesh position={[0, .06, .31]} scale={[.19, .075, .12]} castShadow>
      <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#f4b19a" roughness={.65} />
    </mesh>
  </group>;
}

export default function DiscoveryObjects({ journey, paused, onReveal }) {
  const shell = useRef(), highlight = useRef(), glint = useRef(), time = useRef(0);
  const floor = gateGround(SHELL.x, SHELL.z + 12);
  const wind = useWindField(), burst = useRef();
  const reveal = useRef(createShellReveal(journey.current));
  const grain = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    if (!paused) time.current += Math.min(delta, 0.05);
    const frozen = paused || Boolean(journey.current.activeDiscovery);
    if (stepShellReveal(reveal.current, journey.current, delta, frozen, wind?.reducedMotion)) onReveal?.({x:SHELL.x,y:floor,z:SHELL.z});
    const pose = shellRevealPose(reveal.current.time);
    shell.current.position.y = floor + .035 + pose.height;
    shell.current.scale.setScalar(pose.scale);
    burst.current.visible = journey.current.shellRevealed && pose.burst > 0 && !wind?.reducedMotion;
    const progress = 1 - pose.burst;
    for (let i=0;i<12;i++) {
      const angle=i/12*Math.PI*2;
      const radius=.12+progress*(.55+(i%3)*.12);
      grain.position.set(Math.cos(angle)*radius, Math.sin(progress*Math.PI)*(.25+(i%3)*.08), Math.sin(angle)*radius);
      grain.scale.setScalar(.045*pose.burst); grain.updateMatrix();
      burst.current.setMatrixAt(i,grain.matrix);
    }
    burst.current.instanceMatrix.needsUpdate=true;
    const pickup=journey.current.action?.item==='shell'?journey.current.action:null;
    shell.current.visible = Boolean(pickup&&pickup.time<.85) || (journey.current.shellRevealed && !journey.current.shellFound && !journey.current.keepsakes?.includes('shell'));
    if(pickup){shell.current.position.y+=Math.max(0,pickup.time-.25)*1.4;shell.current.scale.setScalar(Math.max(0,1-Math.max(0,pickup.time-.55)/.3));}
    const near=journey.current.mode==='walking'&&Math.hypot(journey.current.position.x-SHELL.x,journey.current.position.z-SHELL.z)<3;
    glint.current.visible = near && !journey.current.shellFound;
    highlight.current.visible = near && !journey.current.shellFound;
    glint.current.scale.setScalar(0.75 + Math.sin(time.current * 2) * 0.25);
  });
  return <>
    <DockLetter journey={journey} paused={paused} />
    <instancedMesh ref={burst} args={[null,null,12]} visible={false} position={[SHELL.x,floor+.05,SHELL.z]} frustumCulled={false}>
      <icosahedronGeometry args={[1,0]} /><meshStandardMaterial color="#efd4a0" roughness={1} />
    </instancedMesh>
    <group ref={shell} visible={false} position={[SHELL.x, floor + 0.035, SHELL.z]}>
      <ScallopShell highlight={highlight} />
      <mesh ref={glint} position={[0, 0.8, -.08]}>
        <octahedronGeometry args={[0.12, 0]} /><meshBasicMaterial color="#fff0c7" />
      </mesh>
    </group>
  </>;
}
