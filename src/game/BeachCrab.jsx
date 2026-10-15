import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, DynamicDrawUsage, Object3D, Vector3 } from 'three';
import { gateGround } from './MalaiVasalGeometry.js';
import { createCrabSurface } from './CrabSurface.js';
import { SHELL, revealShell } from './Discoveries.js';
import { createCrabBehavior, stepCrab } from './CrabBehavior.js';

// One small, untextured instanced mesh for the shell, eight legs and pincers.
export default function BeachCrab({ journey, boatState, paused = false }) {
  const root = useRef(), mesh = useRef();
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
    part: new Object3D(), direction: new Vector3(), up: new Vector3(0, 1, 0),
    red: new Color('#e83c25'), coral: new Color('#ff6540'), dark: new Color('#241a19'),
  }), []);

  useFrame((_, delta) => {
    if (!root.current || !mesh.current) return;
    if (motion.current.resetId !== journey.current.resetId) {
      motion.current = { ...createCrabBehavior(), resetId: journey.current.resetId };
    }
    const state = motion.current;
    const position = journey.current.mode === 'aboard' ? boatState.current.position : journey.current.position;
    player.current.x = position.x;
    player.current.z = position.z + 12;
    discovery.current.enabled = journey.current.noteRead && !journey.current.shellRevealed && journey.current.mode === 'walking';
    discovery.current.running = journey.current.running;
    stepCrab(state, player.current, delta, paused || Boolean(journey.current.activeDiscovery), discovery.current);
    if (state.uncovered && discovery.current.enabled) revealShell(journey.current);
    root.current.scale.setScalar(state.mode === 'hide' ? 0.08 : 1);
    const moving = state.speed > 0;
    const { x, z } = state;
    const ground=surface.current;
    const bodyFloor=Math.max(ground(x,z), (ground(x-.14,z)+ground(x+.14,z))/2);
    root.current.position.set(x, bodyFloor + 0.015, z - 12);
    // Local X follows travel, so the crab scuttles sideways.
    root.current.rotation.y = state.heading;
    root.current.rotation.z = state.mode === 'dig' ? Math.sin(state.time * 12) * 0.045 : 0;
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
    const gait = moving ? state.gait : 0;
    const bodyY = 0.14 + (moving ? Math.sin(gait * 2) * 0.009 : 0);
    piece(0, bodyY, 0, 0.19, 0.095, 0.135, red);
    piece(0, bodyY + 0.025, -0.015, 0.155, 0.075, 0.11, coral);
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const stride = moving ? Math.sin(gait + leg * Math.PI + side) : 0;
        const hipZ = (leg - 1.5) * 0.065;
        const kneeX = side * (0.235 + Math.sin(leg * 1.1) * 0.035);
        const footX = side * 0.32 + stride * 0.035;
        const footZ = hipZ * 1.7;
        const lift = Math.max(0, stride) * 0.045;
        const cos=Math.cos(state.heading),sin=Math.sin(state.heading);
        const footFloor=ground(x+cos*footX+sin*(footZ+.025),z-sin*footX+cos*(footZ+.025))-bodyFloor;
        const kneeY=0.115+lift+Math.max(0,footFloor)*0.6;
        limb(side * 0.12, bodyY, hipZ, kneeX, kneeY, footZ, 0.025, red);
        limb(kneeX, kneeY, footZ, footX, 0.025 + lift + footFloor, footZ + 0.025, 0.018, coral);
      }
      const play = state.mode === 'wave' ? Math.max(0, Math.sin(state.time * 5 + side)) * 0.1
        : state.mode === 'dig' ? -0.065 + Math.sin(state.time * 12 + side) * 0.025 : 0;
      const clawY = 0.19 + play + Math.sin(state.time * 3 + side) * 0.018;
      limb(side * 0.12, bodyY, 0.08, side * 0.23, clawY, 0.22, 0.035, red);
      piece(side * 0.23, clawY, 0.24, 0.07, 0.055, 0.075, red);
      limb(side * 0.26, clawY, 0.26, side * 0.255, clawY, 0.34, 0.025, coral);
      limb(side * 0.20, clawY, 0.26, side * 0.215, clawY, 0.33, 0.022, coral);
      limb(side * 0.075, bodyY + 0.04, 0.07, side * 0.085, bodyY + 0.135, 0.105, 0.018, red);
      piece(side * 0.085, bodyY + 0.135, 0.105, 0.026, 0.03, 0.025, dark);
    }
    mesh.current.count = index;
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  });

  return <group ref={root} name="Little red beach crab">
    <instancedMesh ref={mesh} args={[null, null, 30]} frustumCulled={false}
      onUpdate={object => object.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.72} flatShading />
    </instancedMesh>
  </group>;
}
