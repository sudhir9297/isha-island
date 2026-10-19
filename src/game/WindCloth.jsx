/* eslint-disable react/immutability -- Cloth geometry is a mutable Three.js resource. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PlaneGeometry, DoubleSide, Vector3, Quaternion, Color, Float32BufferAttribute, DynamicDrawUsage } from 'three';
import { useWindField } from './WindContext.js';
import { easeClothForce, clothRipple, pennantY } from './ClothMotion.js';
import { sampleGust } from './Atmosphere.js';

export default function WindCloth({ position, rotation, width = .57, height = .36, hanging = false, color = '#e84836', emblem = false }) {
  const wind = useWindField(), mesh = useRef();
  const data = useMemo(() => {
    const geometry = new PlaneGeometry(width, height, 24, 12);
    geometry.translate(hanging ? 0 : width / 2, -height / 2, 0);
    if (hanging) {
      const p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, pennantY(p.getX(i), p.getY(i), width, height));
    }
    const base = geometry.attributes.position.array.slice();
    geometry.attributes.position.setUsage(DynamicDrawUsage);
    const colors = [], main = new Color(color), green = new Color('#14594b'), gold = new Color('#e9d18a');
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const u = geometry.attributes.uv.getX(i), v = geometry.attributes.uv.getY(i);
      const pigment = emblem && Math.abs(u - .5) + Math.abs(v - .5) < .15 ? gold : emblem && u > .18 && u < .82 && v > .2 && v < .8 ? green : main;
      const hem = Math.min(u, 1 - u, v, 1 - v) < .045 ? .76 : 1;
      const weave = 1 - .025 * ((Math.round(u * 24) + Math.round(v * 12)) % 2);
      colors.push(pigment.r * hem * weave, pigment.g * hem * weave, pigment.b * hem * weave);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere(); geometry.boundingSphere.radius += .25;
    return { geometry, base, world: new Vector3(), direction: new Vector3(), inverse: new Quaternion(), previous: new Vector3(), velocity: new Vector3(), initialized: false, forceX: 0, forceZ: 0, lastTime: -1, lastStrength: -1 };
  }, [width, height, hanging, color, emblem]);
  useEffect(() => () => data.geometry.dispose(), [data]);
  useFrame(() => {
    if (!mesh.current) return;
    mesh.current.getWorldPosition(data.world);
    if (!data.initialized || wind.delta <= 0) data.previous.copy(data.world);
    data.velocity.copy(data.world).sub(data.previous).divideScalar(Math.max(wind.delta, .001));
    data.previous.copy(data.world);
    data.initialized = true;
    if (wind.delta === 0 && data.lastTime === wind.time.value && data.lastStrength === wind.strength.value) return;
    data.lastTime = wind.time.value; data.lastStrength = wind.strength.value;
    mesh.current.getWorldQuaternion(data.inverse).invert();

    const gust = .75 + sampleGust(data.world.x, data.world.z, wind.time.value) * .5;
    const strength = wind.strength.value * gust;
    // Apparent airflow includes movement of the boat; clamp teleports/reset impulses.
    data.velocity.clampLength(0, 10);
    data.direction.copy(wind.direction.value).multiplyScalar(strength).addScaledVector(data.velocity, -.065).applyQuaternion(data.inverse);
    data.forceX = wind.reducedMotion ? 0 : easeClothForce(data.forceX, data.direction.x, wind.delta);
    data.forceZ = wind.reducedMotion ? 0 : easeClothForce(data.forceZ, data.direction.z, wind.delta);
    const positions = data.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = data.base[i * 3], y = data.base[i * 3 + 1];
      const weight = hanging ? 1 - data.geometry.attributes.uv.getY(i) : x / width;
      const amplitude = wind.reducedMotion ? 0 : Math.hypot(data.forceX, data.forceZ);
      const ripple = clothRipple(weight, hanging ? x / width : y / height, wind.time.value, amplitude, data.world.x * .2);
      const billow = data.forceZ * weight * weight * .16 + ripple;
      const slack = Math.min(width * .08, billow * billow / Math.max(width, .1));
      positions.setXYZ(i, x + (hanging ? data.forceX * weight * weight * .09 : -slack), y - amplitude * weight * .014, billow);
    }
    positions.needsUpdate = true;
    data.geometry.computeVertexNormals();
  }, 0.2);
  return <mesh ref={mesh} geometry={data.geometry} position={position} rotation={rotation} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={.95} side={DoubleSide} />
  </mesh>;
}

export function DockPennants() {
  return <group position={[5.55, .6, -2.2]} rotation={[0, -.16, 0]}>
    <mesh position={[0, 1.5, 0]} castShadow><cylinderGeometry args={[.025, .04, 3, 8]} /><meshStandardMaterial color="#9a7c50" roughness={1} /></mesh>
    <mesh position={[1, 2.9, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.012, .012, 2, 6]} /><meshStandardMaterial color="#b5a17a" /></mesh>
    {['#b86a48', '#7e9b87', '#d0b575'].map((color, i) => <WindCloth key={color} position={[.3 + i * .65, 2.9, 0]} width={.32} height={.46} hanging color={color} />)}
  </group>;
}
