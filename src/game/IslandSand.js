import * as THREE from 'three';
import { shoreRadius } from './Seabed.js';

// A single island-sized texture avoids a visibly repeating sand tile.
// Generated once; grain and shallow wind ripples add no geometry or draw calls.
export function makeIslandSandTextures(contactSites = []) {
  const size = 1024;
  const color = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  let seed = 74193;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const x = (col / (size - 1) - 0.5) * 24;
    const z = (row / (size - 1) - 0.5) * 18;
    const radius = Math.hypot(x / 12, z / 9) / shoreRadius(Math.atan2(z / 9, x / 12));
    const wetEdge = radius + (Math.sin(x * 1.7 + z * 0.6) + Math.sin(z * 2.1 - x)) * 0.012;
    const wet = THREE.MathUtils.smoothstep(wetEdge, 0.81, 1.035);
    const grain = random() - 0.5;
    const mottling = Math.sin(x * 1.8 + Math.sin(z * 1.3)) * Math.cos(z * 1.4 - x * 0.4);
    const patches = 0.5 + 0.5 * Math.sin(x * 0.6 - z * 0.45);
    const phase = z * 20 + x * 7 + Math.sin(x * 1.1 + z * 0.9) * 2.5;
    const ripple = Math.sin(phase) * patches * (1 - wet);
    let contact = 0;
    for (const site of contactSites) {
      const d = ((x-site.x)/site.rx)**2 + ((z-site.z)/site.rz)**2;
      if (d < 6) contact = Math.max(contact, site.shade * Math.exp(-d*1.8));
    }
    const tone = (242 + grain * 20 + mottling * 4 + ripple * 3) * (1-contact);
    const height = 128 + grain * 40 + ripple * 26;
    const offset = (row * size + col) * 4;
    color[offset] = Math.min(255, tone + 3);
    color[offset + 1] = tone;
    color[offset + 2] = tone - 6;
    for (let channel = 0; channel < 3; channel++) {
      relief[offset + channel] = height;
      roughness[offset + channel] = 247 - wet * 75 + grain * 8;
    }
    color[offset + 3] = relief[offset + 3] = roughness[offset + 3] = 255;
  }
  const texture = (data, colorSpace) => {
    const map = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    map.colorSpace = colorSpace;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  };
  return {
    color: texture(color, THREE.SRGBColorSpace),
    relief: texture(relief, THREE.NoColorSpace),
    roughness: texture(roughness, THREE.NoColorSpace),
  };
}
