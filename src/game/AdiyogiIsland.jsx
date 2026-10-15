import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Color, MathUtils } from 'three';
import { ADIYOGI_ISLAND, adiyogiRadiusAt, adiyogiTerrainHeight } from './AdiyogiTerrain.js';
import { ISLAND_SAND_PALETTE } from './Seabed.js';
import { createBeachWetting, BEACH_WETTING_KEY } from './BeachWetting.js';
import { makeIslandSandTextures } from './IslandSand.js';

function createIsland() {
  const positions = [], colors = [], uvs = [], indices = [];
  const step = .5, width = 136, depth = 100;
  const dry = new Color(ISLAND_SAND_PALETTE.dry), wet = new Color(ISLAND_SAND_PALETTE.wet);
  for (let row = 0; row <= depth; row++) for (let col = 0; col <= width; col++) {
    const x = ADIYOGI_ISLAND.x + (col - width / 2) * step;
    const z = ADIYOGI_ISLAND.z + (row - depth / 2) * step;
    const radius = adiyogiRadiusAt(x, z);
    positions.push(x, adiyogiTerrainHeight(x, z), z);
    uvs.push(col / width, row / depth);
    const color = dry.clone().lerp(wet, MathUtils.smoothstep(radius, .82, 1.08) * ISLAND_SAND_PALETTE.wetBlend);
    color.multiplyScalar(1 + .018 * Math.sin(x * .3) * Math.cos(z * .27));
    colors.push(color.r, color.g, color.b, 1 - MathUtils.smoothstep(radius, 1.015, 1.08));
    if (row < depth && col < width) {
      const a = row * (width + 1) + col, b = a + 1, c = a + width + 1;
      // Underwater terrain continues in the shared seabed; trim the invisible corners.
      if (adiyogiRadiusAt(x + step / 2, z + step / 2) < 1.11) indices.push(a, c, b, b, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export default function AdiyogiIsland() {
  const geometry = useMemo(() => createIsland(), []);
  const textures = useMemo(() => makeIslandSandTextures(), []);
  const wetting = useMemo(() => createBeachWetting(), []);
  useFrame(({ clock }) => wetting.advance(clock.elapsedTime));
  useEffect(() => () => {
    geometry.dispose(); wetting.dispose();
    Object.values(textures).forEach(texture => texture.dispose());
  }, [geometry, textures, wetting]);
  return <mesh name="Adiyogi island — open ground" geometry={geometry} receiveShadow renderOrder={1}>
    <meshStandardMaterial vertexColors map={textures.color} bumpMap={textures.relief} bumpScale={.035}
      roughnessMap={textures.roughness} roughness={1} transparent depthWrite
      {...wetting.nodes} onBeforeCompile={wetting.apply} customProgramCacheKey={() => BEACH_WETTING_KEY} />
  </mesh>;
}
