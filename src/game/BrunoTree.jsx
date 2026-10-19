import { useEffect, useMemo } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { color, mix, normalWorld, vec3, texture, uv, rotateUV, reference, positionWorld, sin } from 'three/tsl';
import { DoubleSide, NearestFilter, SRGBColorSpace } from 'three';
import { BRUNO_TREE_MODEL, createBrunoTreeGeometry } from './BrunoTreeGeometry.js';
import { useWindField } from './WindContext.js';

export default function BrunoTree({ position }) {
  const { scene } = useGLTF(BRUNO_TREE_MODEL);
  const [mask, paletteSource] = useTexture(['/models/bruno-oak/foliageSDF.png', '/models/bruno-oak/palette.png']);
  const field = useWindField();
  const geometry = useMemo(() => createBrunoTreeGeometry(scene), [scene]);
  const materials = useMemo(() => {
    const palette = paletteSource.clone();
    palette.colorSpace = SRGBColorSpace; palette.minFilter = palette.magFilter = NearestFilter;
    palette.generateMipmaps = false; palette.flipY = false; palette.needsUpdate = true;
    const wood = new MeshStandardNodeMaterial({ map: palette, roughness: 1, side: DoubleSide });
    const leaves = new MeshStandardNodeMaterial({ side: DoubleSide, roughness: 1, alphaTest: .4 });
    // Preserve Bruno's oak palette, SDF silhouette, cluster normals and rotating
    // leaf-mask motion; the port wind clock supplies pause/reduced-motion support.
    const clock = reference('value', 'float', field.time), strength = reference('value', 'float', field.strength);
    const gust = sin(positionWorld.x.mul(.1).add(positionWorld.z.mul(.08)).sub(clock.mul(.12)))
      .add(sin(positionWorld.z.mul(.05).sub(clock.mul(.035)))).mul(strength).mul(.35);
    leaves.opacityNode = texture(mask, rotateUV(uv(), gust.abs().mul(2.2))).r;
    leaves.colorNode = mix(color('#58842e'), color('#b4ce58'), normalWorld.dot(vec3(22,28,-22).normalize()).smoothstep(0,1));
    leaves.maskShadowNode = texture(mask).r.greaterThan(.5);
    return { wood, leaves, palette };
  }, [mask, paletteSource, field]);
  useEffect(() => () => {
    Object.values(geometry).forEach(g => g.dispose());
    Object.values(materials).forEach(m => m.dispose());
  }, [geometry, materials]);
  return <group name="Bruno Simon oak" position={position} dispose={null}>
    <mesh userData={{ walkingSolid: true }} geometry={geometry.wood} material={materials.wood} castShadow receiveShadow />
    <mesh geometry={geometry.leaves} material={materials.leaves} castShadow receiveShadow />
  </group>;
}
