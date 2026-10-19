import { SANCTUARY_LIGHT, SANCTUARY_WATER } from './ArtDirection.js';
import NodeShaderMaterial from './rendering/NodeShaderMaterial.jsx';
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  DataTexture,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Plane,
  RepeatWrapping,
  Vector2,
  Vector3,
  Vector4,
  RenderTarget,
} from "three";
import { SEABED_Y } from "./WorldConfig.js";
import { createCausticField, OCEAN_SEA_LEVEL } from "./WaterOptics.js";
import { createSeabedGeometry, createSeabedFieldTexture, createSeabedMaterialTexture, COAST_SAND_ALBEDO, SEABED_GRID, SEABED_MAX_Y } from "./Seabed.js";

import { useWindField } from "./WindContext.js";

const SEA_LEVEL = OCEAN_SEA_LEVEL;
function causticTexture() {
  const field = createCausticField();
  const texture = new DataTexture(field.data, field.size, field.size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  texture.userData.meanFocusing = field.meanFocusing;
  return texture;
}
function createOceanGeometry() {
  const coordinates = [-250, -210];
  for (let value = -190; value < -48; value += 1) coordinates.push(value);
  for (let i = 0; i < 25; i++) coordinates.push(-48 + i * .48);
  for (let i = 0; i <= 300; i++) coordinates.push(-36 + i * .24);
  for (let i = 1; i <= 25; i++) coordinates.push(36 + i * .48);
  for (let value = 49; value <= 190; value += 1) coordinates.push(value);
  coordinates.push(210, 250);
  const positions = [], indices = [], count = coordinates.length;
  for (const z of coordinates) for (const x of coordinates) positions.push(x, 0, z);
  for (let z = 0; z < count - 1; z++) for (let x = 0; x < count - 1; x++) {
    const a = z * count + x, b = a + 1, c = a + count;
    indices.push(a, c, b, b, c, c + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export default function Ocean({ onSail, sunRef, quality = "high", profiling = false }) {
  const wind = useWindField();
  const bed = useRef(),
    terrain = useRef(),
    water = useRef();
  const size = useThree((state) => state.size);
  const scene = useThree((state) => state.scene);
  const aboveWater = useRef([]);
  const hiddenThisPass = useRef([]);
  const resources = useMemo(() => {
    const caustics = causticTexture();
    const terrainGeometry = createSeabedGeometry();
    const waterGeometry = createOceanGeometry();
    const seabedField = createSeabedFieldTexture();
    const seabedMaterial = createSeabedMaterialTexture();
    const seabedUniforms = {
      uSeabedField: { value: seabedField },
      uSeabedMaterial: { value: seabedMaterial },
      uSeabedGrid: { value: new Vector4(SEABED_GRID.x, SEABED_GRID.z, SEABED_GRID.step, SEABED_Y) },
      uSeabedSize: { value: new Vector2(SEABED_GRID.columns, SEABED_GRID.rows) },
      uSeabedMaxHeight: { value: SEABED_MAX_Y },
    };
    const target = new RenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: true,
      samples: 0,
    });
    target.depthTexture = new DepthTexture(1, 1);
    return {
      target,
      caustics,
      terrainGeometry,
      waterGeometry,
      seabedField,
      seabedMaterial,
      bedUniforms: {
        ...seabedUniforms,
        uTime: { value: 0 },
        uClipDepthScale: { value: 1 },
        uClipDepthBias: { value: 0 },
        uDeep: { value: new Color(SANCTUARY_WATER.deep) },
        uLagoon: { value: new Color(SANCTUARY_WATER.lagoon) },
        uShallow: { value: new Color(SANCTUARY_WATER.shallow) },
        uSand: { value: new Color(SANCTUARY_WATER.sand) },
        uMint: { value: new Color(SANCTUARY_WATER.mint) },
        uAqua: { value: new Color(SANCTUARY_WATER.aqua) },
      },
      // The color-only floor is hidden from the capture. Buried reef geometry must
      // still be occluded by its physical depth, otherwise its skirts ghost through.
      clip: [
        new Plane(new Vector3(0, -1, 0), SEA_LEVEL + 0.1),
        new Plane(new Vector3(0, 1, 0), -SEABED_Y),
      ],
      uniforms: {
        ...seabedUniforms,
        uWindDirection: { value: new Vector3(0.9510565, 0, -0.309017) },
        uWindStrength: { value: 0.55 },
        uSunDirection: { value: new Vector3(22, 28, -22).normalize() },
        uSunRadiance: { value: new Color(SANCTUARY_LIGHT.sun).multiplyScalar(SANCTUARY_LIGHT.sunIntensity) },
        uSunDepth: { value: null },
        uSunMatrix: { value: new Matrix4() },
        uSunReady: { value: 0 },
        uSunTexel: { value: new Vector2(1 / 2048, 1 / 2048) },
        uTime: { value: 0 },
        uClipDepthScale: { value: 1 },
        uClipDepthBias: { value: 0 },
        uDeep: { value: new Color(SANCTUARY_WATER.deep) },
        uLagoon: { value: new Color(SANCTUARY_WATER.lagoon) },
        uShallow: { value: new Color(SANCTUARY_WATER.shallow) },
        uSand: { value: new Color(SANCTUARY_WATER.sand) },
        uMint: { value: new Color(SANCTUARY_WATER.mint) },
        uAqua: { value: new Color(SANCTUARY_WATER.aqua) },
        uFoam: { value: new Color(SANCTUARY_WATER.foam) },
        uCoastSand: { value: new Color().fromArray(COAST_SAND_ALBEDO) },
        uUnderwater: { value: target.texture },
        uCaustics: { value: caustics },
        uCausticMean: { value: caustics.userData.meanFocusing },
        uDepth: { value: target.depthTexture },
        uInverseProjection: { value: new Matrix4() },
        uCameraWorld: { value: new Matrix4() },
        uResolution: { value: new Vector2(1, 1) },
        toneMappingExposure: { value: 1 },
      },
    };
  }, []);
  const resourceRef = useRef(resources);
  // Cache static island and above-water boat parts. No scene traversal occurs in the frame loop.
  // A generous gap above sea leaves bobbing hulls and shoreline geometry in the clipped pass.
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const bounds = new Box3(),
      candidates = [];
    scene.traverse((object) => {
      if (!object.isMesh) return;
      // Surface foam uses custom shaders that do not consume global clipping
      // chunks. Check its semantic group before excluding instanced meshes.
      let ancestor = object;
      while (ancestor) {
        if (ancestor.userData.seaSurfaceOnly) {
          candidates.push(object);
          return;
        }
        ancestor = ancestor.parent;
      }
      if (
        object.isInstancedMesh ||
        object === bed.current ||
        object === terrain.current ||
        object === water.current
      )
        return;
      bounds.setFromObject(object);
      if (bounds.min.y > 0.15) candidates.push(object);
    });
    aboveWater.current = candidates;
  });
  useEffect(() => {
    const { target, uniforms } = resourceRef.current;
    const maxDimension = quality === "high" ? 900 : 560;
    const scale = Math.min(1, maxDimension / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    // Keep captured depth single-sampled so its shader binding stays valid across quality changes.
    target.setSize(width, height);
    uniforms.uResolution.value.set(width, height);
  }, [size.width, size.height, quality]);
  useEffect(() => {
    const { target, caustics, terrainGeometry, waterGeometry, seabedField, seabedMaterial } = resourceRef.current;
    return () => {
      target.dispose();
      caustics.dispose();
      terrainGeometry.dispose();
      waterGeometry.dispose();
      seabedField.dispose();
      seabedMaterial.dispose();
    };
  }, []);
  // Capture after simulation (0) and CameraRig (0.5), before the final pipeline (1).
  // This pass reuses the current shadow map and restores every changed renderer/scene setting.
  useFrame(({ gl, scene, camera, clock }) => {
    if (!bed.current || !terrain.current || !water.current) return;
    // The main pass must initialize/resize the sun target before capture samples
    // it. Sampling an uninitialized shadow target creates stale GPU bindings.
    const shadow = sunRef.current?.shadow;
    if (!shadow?.map || shadow.map.width !== shadow.mapSize.width || shadow.map.height !== shadow.mapSize.height) return;
    const { uniforms, target, clip } = resourceRef.current;
    uniforms.uTime.value = wind ? wind.time.value : clock.elapsedTime;
    if (wind) {
      uniforms.uWindDirection.value.copy(wind.direction.value);
      uniforms.uWindStrength.value = wind.strength.value;
    }
    if (sunRef.current) uniforms.uSunRadiance.value.copy(sunRef.current.color).multiplyScalar(sunRef.current.intensity);
    uniforms.toneMappingExposure.value = gl.toneMappingExposure;
    const previousTarget = gl.getRenderTarget();
    const captureGroup = scene.getObjectByName('Underwater capture');
    const previousClipping = captureGroup.enabled;
    uniforms.uClipDepthScale.value = gl.backend.isWebGPUBackend ? 1 : 2;
    uniforms.uClipDepthBias.value = gl.backend.isWebGPUBackend ? 0 : -1;
    const previousBackground = scene.background;
    const sunShadow = sunRef.current?.shadow;
    const previousShadowUpdate = sunShadow?.autoUpdate;
    const previousShadowNeedsUpdate = sunShadow?.needsUpdate;
    const previousAlpha = gl.getClearAlpha();
    bed.current.visible = false;
    // Render the real raised floor first into depth, with zero color/alpha.
    // This occludes buried reef/wildlife without placing a colored patch in the capture.
    const previousTerrainColorWrite = terrain.current.material.colorWrite;
    const previousTerrainVisibility = terrain.current.visible;
    terrain.current.visible = true;
    terrain.current.material.colorWrite = false;
    water.current.visible = false;
    scene.background = null;
    captureGroup.clippingPlanes = clip;
    captureGroup.enabled = true;
    // eslint-disable-next-line react/immutability -- Temporarily pause the Three shadow during capture, then restore it.
    if (sunShadow) { sunShadow.autoUpdate = false; sunShadow.needsUpdate = false; }
    gl.setClearAlpha(0);
    gl.setRenderTarget(target);
    const hidden = hiddenThisPass.current;
    hidden.length = 0;
    for (const object of aboveWater.current) {
      if (object.visible) {
        hidden.push(object);
        // eslint-disable-next-line react/immutability -- Three.js mesh visibility is imperative renderer state.
        object.visible = false;
      }
    }
    try {
      gl.clear();
      gl.render(scene, camera);
      const metricRoot = profiling ? document.querySelector("main.app") : null;
      if (metricRoot) {
        metricRoot.dataset.captureDrawCalls = String(gl.info.render.drawCalls);
        metricRoot.dataset.captureTriangles = String(gl.info.render.triangles);
      }
      uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
      uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    } finally {
      for (const object of hidden) object.visible = true;
      hidden.length = 0;
      gl.setRenderTarget(previousTarget);
      gl.setClearAlpha(previousAlpha);
      captureGroup.enabled = previousClipping;
      if (sunShadow) { sunShadow.autoUpdate = previousShadowUpdate; sunShadow.needsUpdate = previousShadowNeedsUpdate; }
      scene.background = previousBackground;
      bed.current.visible = true;
      terrain.current.material.colorWrite = previousTerrainColorWrite;
      terrain.current.visible = previousTerrainVisibility;
      water.current.visible = true;
    }
  }, 0.75);
  return (
    <>
      <mesh ref={terrain} geometry={resources.terrainGeometry} renderOrder={-10} visible={false} receiveShadow>
        <meshStandardMaterial color="#73867d" roughness={1} />
      </mesh>
      <mesh ref={bed} rotation={[-Math.PI / 2, 0, 0]} position={[0, SEABED_Y, 0]}>
        <planeGeometry args={[500, 500]} />
        <NodeShaderMaterial kind="seabed"
          uniforms={resources.bedUniforms}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={water}
        geometry={resources.waterGeometry}
        position={[0, SEA_LEVEL, 0]}
        renderOrder={4}
        onBeforeRender={(_renderer, _scene, _camera, _geometry, material) => {
          const sunlight = sunRef?.current;
          const shadow = sunlight?.shadow;
          const uniforms = material.uniforms;
          const current = resourceRef.current;
          if (sunlight) {
            sunlight.updateWorldMatrix(true, false);
            sunlight.target.updateWorldMatrix(true, false);
            const lightPosition = sunlight.matrixWorld.elements;
            const targetPosition = sunlight.target.matrixWorld.elements;
            uniforms.uSunDirection.value.set(
              lightPosition[12] - targetPosition[12],
              lightPosition[13] - targetPosition[13],
              lightPosition[14] - targetPosition[14],
            ).normalize();
            uniforms.uSunRadiance.value.copy(sunlight.color).multiplyScalar(sunlight.intensity);
          }
          uniforms.uTime.value = current.uniforms.uTime.value;
          uniforms.uResolution.value.copy(current.uniforms.uResolution.value);
          uniforms.uInverseProjection.value.copy(current.uniforms.uInverseProjection.value);
          uniforms.uCameraWorld.value.copy(current.uniforms.uCameraWorld.value);
          uniforms.uUnderwater.value = current.target.texture;
          uniforms.uDepth.value = current.target.depthTexture;
          uniforms.uSunReady.value = shadow?.map ? 1 : 0;
          if (shadow?.map) {
            uniforms.uSunDepth.value = shadow.map.depthTexture;
            material.sunDepth.value = shadow.map.depthTexture;
            uniforms.uSunMatrix.value.copy(shadow.matrix);
            uniforms.uSunTexel.value.set(1 / shadow.map.width, 1 / shadow.map.height);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSail?.(event.point);
        }}
      >
        <NodeShaderMaterial kind="water"
          transparent
          depthWrite
          uniforms={resources.uniforms}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
