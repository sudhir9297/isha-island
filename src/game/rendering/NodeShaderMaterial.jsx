import { useEffect, useMemo } from 'react';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uv, attribute, varying, positionWorld, positionLocal, modelWorldMatrix, cameraProjectionMatrix, cameraViewMatrix, vec3, vec4, texture, Fn } from 'three/tsl';
import { DepthTexture, LessEqualCompare } from 'three';
import { glow } from './generated/glow.js';
import { portal } from './generated/portal.js';
import { contact } from './generated/contact.js';
import { foam } from './generated/foam.js';
import { seabed } from './generated/seabed.js';
import { water } from './generated/water.js';
import { waves } from './generated/waves.js';

const factories = { glow, portal, contact, foam, seabed, water };
// Keep the existing uniform objects so game simulation can update them directly.
export default function NodeShaderMaterial({ kind, uniforms, ref, ...props }) {
  const material = useMemo(() => {
    const result = new MeshBasicNodeMaterial();
    result.uniforms = uniforms;
    const inputs = { vUv: uv(), vWorld: positionWorld };
    if (kind === 'foam') {
      inputs.vSeed = varying(attribute('instanceSeed', 'float'));
      inputs.vFade = varying(attribute('instanceFade', 'float'));
    }
    if (kind === 'water') {
      const world = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
      result.positionNode = positionLocal.add(vec3(0, waves(uniforms, { worldPosition: world }).x, 0));
      inputs.vClip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(positionWorld, 1));
      const emptyDepth = new DepthTexture(1, 1);
      emptyDepth.compareFunction = LessEqualCompare;
      const sun = texture(emptyDepth);
      result.sunDepth = sun;
      inputs.sampleSun = Fn(([coords, depth]) => sun.sample(coords.flipY()).compare(depth));
      result.addEventListener('dispose', () => emptyDepth.dispose());
    }
    result.fragmentNode = factories[kind](uniforms, inputs);
    return result;
    // The simulation retains these uniform objects for the material lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" ref={ref} {...props} />;
}
