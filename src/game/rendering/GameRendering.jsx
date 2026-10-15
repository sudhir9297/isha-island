import { useEffect, useRef } from 'react';
import { useFrame, useThree, extend } from '@react-three/fiber';
import { RenderPipeline, ClippingGroup } from 'three/webgpu';
import { pass, uv, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js';

extend({ ClippingGroup });

export default function GameRendering({ quality, onError }) {
  const state = useThree();
  const { gl, scene, camera, advance } = state;
  const pipeline = useRef(null);
  useEffect(() => {
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    const bloomPass = bloom(sceneColor, 0.25, 0, 1);
    bloomPass.smoothWidth.value = 1;
    const strength = uv().y.sub(0.5).abs().smoothstep(0.2, 0.5);
    const blurred = hashBlur(sceneColor, strength.mul(0.003), { repeats: 25, premultipliedAlpha: true });
    const renderer = new RenderPipeline(gl);
    const high = mix(sceneColor, blurred, strength).add(bloomPass);
    const balanced = sceneColor.add(bloomPass);
    renderer.outputNode = high;
    pipeline.current = { renderer, high, balanced };
    return () => {
      pipeline.current = null;
      renderer.dispose();
      scenePass.dispose();
      bloomPass.dispose();
    };
  }, [gl, scene, camera]);
  useEffect(() => {
    const active = pipeline.current;
    if (!active) return;
    active.renderer.outputNode = quality === 'high' ? active.high : active.balanced;
    active.renderer.needsUpdate = true;
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    let previous = null, elapsed = 0, failed = false;
    gl.setAnimationLoop((milliseconds) => {
      if (failed) return;
      const delta = previous === null || document.hidden ? 0 : Math.min((milliseconds - previous) / 1000, 1 / 30);
      previous = milliseconds;
      elapsed += Math.max(0, delta);
      try {
        advance(elapsed, true);
      }
      catch (error) {
        failed = true;
        console.error('Port renderer failed:', error);
        onError?.('The renderer could not draw the island. Please reload or try another browser.');
      }
    });
    return () => { gl.setAnimationLoop(null); };
  }, [gl, advance, onError]);
  useFrame(() => pipeline.current?.renderer.render(), 1);
  return null;
}
