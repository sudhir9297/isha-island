import { createCrabLegSolver } from './CrabLeg.js';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, DynamicDrawUsage, Object3D, Vector3 } from 'three';
import { gateGround } from './MalaiVasalGeometry.js';
import { createCrabSurface } from './CrabSurface.js';
import { SHELL, revealShell } from './Discoveries.js';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';

// One small, untextured instanced mesh for the shell, eight legs and pincers.
export default function BeachCrab({ journey, boatState, paused = false }) {
  const root = useRef(), mesh = useRef(), marker = useRef(), sand = useRef();
  const scene = useThree(s => s.scene);
  const surface = useRef(gateGround);
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const meshes=[];
    scene.traverse(object => { if(object.isMesh && object.userData.crabSurface) meshes.push(object); });
    surface.current=createCrabSurface(meshes);
  }, [scene]);
  const motion = useRef(createCrabBehavior());
  const player = useRef({ x: 0, z: 0 });
  const discovery = useRef({ enabled: false, running: false, x: SHELL.x, z: SHELL.z + 12 });
  const scratch = useMemo(() => ({
    solveLeg: createCrabLegSolver(), part: new Object3D(), direction: new Vector3(), up: new Vector3(0, 1, 0),
    red: new Color('#e83c25'), coral: new Color('#ff6540'), dark: new Color('#241a19'),
  }), []);

  useFrame((_, delta) => {
    if (!root.current || !mesh.current) return;
    if (motion.current.resetId !== journey.current.resetId) {
      motion.current = { ...createCrabBehavior(), resetId: journey.current.resetId };
    }
    if (!journey.current.noteRead && motion.current.noteSeen) {
      motion.current = { ...createCrabBehavior(), resetId: journey.current.resetId };
    }
    if (journey.current.noteRead && !motion.current.noteSeen ) {
      motion.current = { ...createCrabBehavior(), resetId: journey.current.resetId, noteSeen: true };
      if (journey.current.shellRevealed) {
        Object.assign(motion.current, { x: SHELL.x, z: SHELL.z + 12, storyDone: journey.current.shellFound });
      }
    }
    const state = motion.current;
    const position = journey.current.mode === 'aboard' ? boatState.current.position : journey.current.position;
    player.current.x = position.x;
    player.current.z = position.z + 12;
    discovery.current.enabled = journey.current.noteRead && !state.storyDone;
    discovery.current.running = journey.current.running;
    discovery.current.invited = journey.current.crabInvited;
    discovery.current.finished = journey.current.shellRevealed;
    discovery.current.collected = journey.current.shellFound;
    stepCrab(state, journey.current.mode === 'walking' ? player.current : null, delta, paused || Boolean(journey.current.activeDiscovery), discovery.current);
    if (state.uncovered && discovery.current.enabled) revealShell(journey.current);
    marker.current.visible = discovery.current.enabled && journey.current.mode === 'walking' && !journey.current.shellRevealed && !journey.current.activeDiscovery && state.mode !== 'hide' && Math.hypot(player.current.x-state.x,player.current.z-state.z)<4;
    /* eslint-disable react/immutability -- Frame simulation publishes the live crab position through the shared journey ref. */
    journey.current.crabPosition ??= { x: 0, z: 0 };
    journey.current.crabPosition.x = state.x;
    journey.current.crabPosition.z = state.z - 12;
    /* eslint-enable react/immutability */
    const nearby = journey.current.mode === 'walking' && Math.hypot(player.current.x-state.x,player.current.z-state.z)<18;
    journey.current.crabHint = !nearby || !journey.current.noteRead || (journey.current.shellFound && state.story?.phase !== 'farewell') ? null
      : state.story?.phase === 'farewell' ? 'Your guide waves goodbye'
      : journey.current.shellRevealed ? 'Something is shining in the sand'
      : !journey.current.crabInvited ? 'The crab beckons from the shore'
      : state.mode === 'dig' ? 'The crab is digging…'
      : state.mode === 'wave' ? 'Your guide is waiting for you'
      : 'Follow those tiny footsteps';
    root.current.scale.setScalar(state.mode === 'hide' ? 0.08 : 1);
    const frozen = paused || Boolean(journey.current.activeDiscovery);
    state.strideWeight ??= 0;
    if (!frozen) state.strideWeight += ((state.speed > .01 ? Math.min(1, state.speed / .48) : 0) - state.strideWeight) * (1 - Math.exp(-Math.min(delta,.05) * 14));
    const diggingTime = state.story?.phase === 'dig' ? state.story.time : 0;
    const digBeat = state.story?.phase === 'dig' ? diggingTime * 10 + diggingTime * diggingTime * 3 : state.time * 12;
    const moving = state.strideWeight;
    const { x, z } = state;
    const ground=surface.current;
    const bodyFloor=Math.max(ground(x,z), (ground(x-.14,z)+ground(x+.14,z))/2);
    journey.current.crabPosition.y = bodyFloor;
    root.current.position.set(x, bodyFloor + 0.015, z - 12);
    // Local X follows travel, so the crab scuttles sideways.
    root.current.rotation.y = state.heading;
    root.current.rotation.z = state.mode === 'dig' ? Math.sin(digBeat) * 0.045 : 0;
    let index = 0;
    const { part, direction, up, red, coral, dark } = scratch;
    const piece = (x, y, z, sx, sy, sz, color) => {
      part.position.set(x, y, z);
      part.scale.set(sx, sy, sz);
      part.quaternion.identity();
      part.updateMatrix();
      mesh.current.setMatrixAt(index, part.matrix);
      mesh.current.setColorAt(index++, color);
    };
    const limb = (ax, ay, az, bx, by, bz, width, color) => {
      direction.set(bx - ax, by - ay, bz - az);
      part.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      part.scale.set(width, direction.length() * 0.62, width);
      part.quaternion.setFromUnitVectors(up, direction.normalize());
      part.updateMatrix();
      mesh.current.setMatrixAt(index, part.matrix);
      mesh.current.setColorAt(index++, color);
    };
    const gait = state.gait;
    const bodyY = 0.14 + (moving ? Math.sin(gait * 2) * 0.009 * moving : 0);
    piece(0, bodyY, 0, 0.19, 0.095, 0.135, red);
    piece(0, bodyY + 0.025, -0.015, 0.155, 0.075, 0.11, coral);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const stride = Math.sin(gait + leg * Math.PI + side) * moving;
        const hipZ = (leg - 1.5) * 0.065;
        const footX = side * 0.32 + stride * 0.035;
        const footZ = hipZ * 1.7;
        const lift = Math.max(0, stride) * 0.045;
        const cos=Math.cos(state.heading),sin=Math.sin(state.heading);
        const footFloor=ground(x+cos*footX+sin*(footZ+.025),z-sin*footX+cos*(footZ+.025))-bodyFloor;
        const { hip, knee, foot } = scratch.solveLeg(side * .12, bodyY, hipZ,
          footX, .025 + lift + footFloor, footZ + .025, side);
        limb(hip.x, hip.y, hip.z, knee.x, knee.y, knee.z, .025, red);
        limb(knee.x, knee.y, knee.z, foot.x, foot.y, foot.z, .018, coral);
      }
      const play = state.mode === 'wave' ? Math.max(0, Math.sin(state.time * 5 + side)) * 0.1
        : state.mode === 'dig' ? -0.065 + Math.sin(digBeat + side) * 0.025 : 0;
      const clawY = 0.19 + play + Math.sin(state.time * 3 + side) * 0.018;
      limb(side * 0.12, bodyY, 0.08, side * 0.23, clawY, 0.22, 0.035, red);
      piece(side * 0.23, clawY, 0.24, 0.07, 0.055, 0.075, red);
      limb(side * 0.26, clawY, 0.26, side * 0.255, clawY, 0.34, 0.025, coral);
      limb(side * 0.20, clawY, 0.26, side * 0.215, clawY, 0.33, 0.022, coral);
      limb(side * 0.075, bodyY + 0.04, 0.07, side * 0.085, bodyY + 0.135, 0.105, 0.018, red);
      piece(side * 0.085, bodyY + 0.135, 0.105, 0.026, 0.03, 0.025, dark);
    }
    sand.current.visible = state.mode === 'dig' && discovery.current.enabled && !journey.current.shellRevealed;
    for (let i = 0; i < 8; i++) {
      const phase = (state.time * 1.7 + i / 8) % 1;
      const side = i % 2 ? 1 : -1;
      part.position.set(side * (.15 + phase * .36), .05 + Math.sin(phase * Math.PI) * .22, .22 + phase * .26);
      part.scale.setScalar(.035 * (1 - phase)); part.quaternion.identity(); part.updateMatrix();
      sand.current.setMatrixAt(i, part.matrix);
    }
    sand.current.instanceMatrix.needsUpdate = true;
    mesh.current.count = index;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  });

  return <group ref={root} name="Little red beach crab">
    <instancedMesh ref={sand} args={[null, null, 8]} visible={false} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#e7cb91" roughness={1} />
    </instancedMesh>
    <mesh ref={marker} visible={false} position={[0, 0.85, 0]} scale={[0.1, 0.16, 0.1]}><octahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#fff1b8" toneMapped={false} /></mesh>
    <instancedMesh ref={mesh} args={[null, null, 30]} frustumCulled={false}
      onUpdate={object => object.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.72} flatShading />
    </instancedMesh>
  </group>;
}
