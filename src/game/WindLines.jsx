/* eslint-disable react/immutability -- Three.js buffers and the bounded animation pool are mutable frame-loop resources. */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute, CatmullRomCurve3, DynamicDrawUsage, DoubleSide, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createWindLines, stepWindLines, windRibbonWidth, WIND, windDirection } from './WindField.js';
import { useWindField } from './WindContext.js';
import { islandGroundAt } from './IslandGround.js';

// Adapted from Bruno Simon's WindLines and WindLineGeometry. See public/licenses/.
export default function WindLines({ journey, boatState, enabled = true }) {
  const wind = useWindField();
  const state = useMemo(() => createWindLines(), []);
  const resources = useMemo(() => {
    const curve = new CatmullRomCurve3(Array.from({ length: 4 }, (_, i) => new Vector3(0, (i % 2 - 0.5) * 0.7, -4 + i * 8 / 3)));
    const points = curve.getPoints(30);
    const material = new MeshBasicNodeMaterial({ color: '#eaf7ed', transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false, side: DoubleSide });
    const ribbons = Array.from({ length: WIND.poolSize }, () => {
      const geometry = new BufferGeometry();
      const position = new BufferAttribute(new Float32Array(points.length * 6), 3).setUsage(DynamicDrawUsage);
      geometry.setAttribute('position', position);
      const indices = [];
      for (let i = 0; i < points.length - 1; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geometry.setIndex(indices);
      return { geometry, position, mesh: null };
    });
    return { points, material, ribbons, up: new Vector3() };
  }, []);
  useEffect(() => () => { resources.ribbons.forEach(r => r.geometry.dispose()); resources.material.dispose(); }, [resources]);
  useFrame(({ camera }) => {
    const visible = enabled && !wind.reducedMotion;
    if (!visible) {
      for (const r of resources.ribbons) if (r.mesh) r.mesh.visible = false;
      state.lines.forEach(line => { line.active = false; });
      return;
    }
    const story = journey.current;
    const focus = story.mode === 'aboard' ? boatState.current.position : story.position;
    stepWindLines(state, wind.delta * (0.55 + wind.strength.value), focus, islandGroundAt);
    resources.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < state.lines.length; i++) {
      const line = state.lines[i], ribbon = resources.ribbons[i];
      if (!ribbon.mesh) continue;
      ribbon.mesh.visible = line.active;
      if (!line.active) continue;
      const progress = line.age / WIND.duration;
      for (let j = 0; j < resources.points.length; j++) {
        const point = resources.points[j];
        const width = 0.1 * windRibbonWidth(j / (resources.points.length - 1), progress);
        for (let side = 0; side < 2; side++) {
          const offset = (side - 0.5) * width;
          const along = point.z * line.length + progress;
          ribbon.position.setXYZ(j * 2 + side,
            line.x + windDirection.x * along + resources.up.x * offset,
            line.y + point.y + resources.up.y * offset,
            line.z + windDirection.z * along + resources.up.z * offset);
        }
      }
      ribbon.position.needsUpdate = true;
    }
  }, 0.6);
  return <group name="Wind trails" userData={{ seaSurfaceOnly: true }}>{resources.ribbons.map((ribbon, i) =>
    <mesh key={i} ref={mesh => { ribbon.mesh = mesh; }} geometry={ribbon.geometry} material={resources.material} frustumCulled={false} visible={false} renderOrder={6} raycast={() => null} />
  )}</group>;
}
