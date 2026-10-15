import { WebGPURenderer } from 'three/webgpu';
import { NeutralToneMapping } from 'three';

export async function createGameRenderer(defaults) {
  const renderer = new WebGPURenderer({
    ...defaults,
    powerPreference: 'high-performance',
    antialias: Math.min(window.devicePixelRatio, 2) < 2,
    forceWebGL: new URLSearchParams(location.search).get('backend') === 'webgl',
  });
  try { await renderer.init(); }
  catch (error) { renderer.dispose(); throw error; }
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // Keep depth sorting: the boat scene has overlapping transparent water/effects.
  renderer.domElement.classList.add('experience');
  renderer.domElement.dataset.renderer = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  if (import.meta.env.DEV && location.hash.includes('inspector')) {
    const { Inspector } = await import('three/addons/inspector/Inspector.js');
    renderer.inspector = new Inspector();
  }
  return renderer;
}
