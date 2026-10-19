/* eslint-disable react/immutability -- Three scene objects and reusable particle data are updated in the frame loop. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Color, DoubleSide, Object3D, DynamicDrawUsage } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { useWindField } from './WindContext.js';
import { createLeafPool, stepLeaves, grassInteractionTarget } from './Atmosphere.js';
import { islandGroundAt } from './IslandGround.js';

export function WeatherLighting({ sunRef }) {
  const wind = useWindField();
  const colors = useMemo(() => ({ sunny: new Color('#fff1d6'), cloudy: new Color('#dbe5ef'), clear: new Color('#07526f'), haze: new Color('#416b80') }), []);
  useFrame(({ scene }) => {
    if (!sunRef.current) return;
    sunRef.current.intensity = wind.weather.sun;
    sunRef.current.color.copy(colors.sunny).lerp(colors.cloudy, wind.weather.cloud);
    sunRef.current.shadow.intensity = 0.7 - wind.weather.cloud * 0.18;
    scene.background?.copy(colors.clear).lerp(colors.haze, wind.weather.cloud * 0.4);
  }, 0.65);
  return null;
}

export function GrassInteraction({ journey }) {
  const wind = useWindField();
  useFrame(() => {
    const traveler = journey.current;
    const target = grassInteractionTarget(traveler, wind.reducedMotion);
    if (target > 0) wind.traveler.value.copy(traveler.position);
    wind.interaction.value += (target - wind.interaction.value) * (1 - Math.exp(-wind.delta * 8));
    if (wind.reducedMotion) wind.interaction.value = 0;
  }, 0.1);
  return null;
}

export function DriftingLeaves({ journey, boatState, enabled }) {
  const wind = useWindField(), mesh = useRef();
  const resources = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, -.12, -.06, 0, 0, 0, .018, 0, .06, 0, 0, 0, 0, .12], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
    geometry.computeVertexNormals();
    const material = new MeshStandardNodeMaterial({ color: '#b0b365', roughness: 1, side: DoubleSide });
    return { geometry, material, pool: createLeafPool(), dummy: new Object3D() };
  }, []);
  useEffect(() => { mesh.current.instanceMatrix.setUsage(DynamicDrawUsage); return () => { resources.geometry.dispose(); resources.material.dispose(); }; }, [resources]);
  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.visible = enabled && !wind.reducedMotion;
    if (!mesh.current.visible) { resources.pool.leaves.forEach(l => { l.active = false; }); return; }
    const story = journey.current;
    const focus = story.mode === 'aboard' ? boatState.current.position : story.position;
    stepLeaves(resources.pool, wind.delta, focus, wind.time.value, wind.strength.value, islandGroundAt);
    let count = 0;
    for (const leaf of resources.pool.leaves) {
      if (!leaf.active) continue;
      const fade = Math.min(1, leaf.age * 2, (leaf.duration - leaf.age) * 2);
      resources.dummy.position.set(leaf.x, leaf.y, leaf.z);
      resources.dummy.rotation.set(Math.sin(leaf.age * 3 + leaf.phase) * 0.7, leaf.phase + leaf.age, Math.cos(leaf.age * 2 + leaf.phase) * 0.5);
      resources.dummy.scale.setScalar(Math.max(0, fade));
      resources.dummy.updateMatrix();
      mesh.current.setMatrixAt(count++, resources.dummy.matrix);
    }
    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;
  }, 0.6);
  return <instancedMesh name="Drifting leaves" ref={mesh} args={[resources.geometry, resources.material, 18]} count={0} frustumCulled={false} userData={{ seaSurfaceOnly: true }} raycast={() => null} />;
}
