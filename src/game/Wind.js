import { useWindField } from './WindContext.js';
import { leafSurfaceNodes } from './rendering/LeafNodes.js';
import { windNodes } from './rendering/WindNodes.js';
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function addLeafWind(geometry, anchor, reach) {
  const positions = geometry.attributes.position;
  const root = anchor ?? new THREE.Vector3().fromBufferAttribute(positions, 0);
  let length = reach ?? 0;
  if (!reach) {
    const point = new THREE.Vector3();
    for (let vertex = 0; vertex < positions.count; vertex++)
      length = Math.max(length, point.fromBufferAttribute(positions, vertex).distanceTo(root));
  }
  const axis = new THREE.Vector3(), point = new THREE.Vector3();
  let farthest = 0;
  for (let vertex = 0; vertex < positions.count; vertex++) {
    point.fromBufferAttribute(positions, vertex).sub(root);
    if (point.lengthSq() > farthest) { farthest = point.lengthSq(); axis.copy(point); }
  }
  axis.normalize();
  const roots = new Float32Array(positions.count * 3), reaches = new Float32Array(positions.count);
  const axes = new Float32Array(positions.count * 3);
  for (let vertex = 0; vertex < positions.count; vertex++) {
    root.toArray(roots, vertex * 3);
    axis.toArray(axes, vertex * 3);
    reaches[vertex] = Math.max(0.01, length);
  }
  geometry.setAttribute("leafWindRoot", new THREE.BufferAttribute(roots, 3));
  geometry.setAttribute("leafWindReach", new THREE.BufferAttribute(reaches, 1));
  geometry.setAttribute("leafWindAxis", new THREE.BufferAttribute(axes, 3));
  return geometry;
}

const windFunctions = /* glsl */`
  uniform float islandWindTime;
  uniform float islandWindHeight;
  uniform float islandTipMotion;
  uniform vec3 islandWindRoot;

  uniform vec3 islandWindDirection;
  uniform float islandWindStrength;
  uniform vec3 islandTraveler;
  uniform float islandInteraction;
  uniform float islandGroundCover;

  float islandNoiseHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float islandNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(islandNoiseHash(cell), islandNoiseHash(cell + vec2(1.0, 0.0)), u.x),
      mix(islandNoiseHash(cell + vec2(0.0, 1.0)), islandNoiseHash(cell + vec2(1.0, 1.0)), u.x), u.y);
  }
  float islandGust(float time, vec2 location, vec2 direction) {
    // Two advected noise scales, following Bruno's shared wind field.
    vec2 drift = direction * time * 0.055;
    return (islandNoise(location * 0.1 - drift) - 0.5) +
      (islandNoise(location * 0.05 - drift * 0.2) - 0.5);
  }

  vec3 islandBaseWind(vec3 worldPosition) {
    float height = clamp((worldPosition.y - islandWindRoot.y) / islandWindHeight, 0.0, 1.0);
    float gust = islandGust(islandWindTime - height * 0.18, islandWindRoot.xz, islandWindDirection.xz);
    return islandWindDirection * islandWindStrength * 1.8 * islandWindHeight * 0.028 * height * height * gust;
  }

  vec3 islandWindPosition(vec3 position) {
    vec3 worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 offset = islandBaseWind(worldPosition);
    #ifdef ISLAND_LEAF_WIND
      vec3 anchor = (modelMatrix * vec4(leafWindRoot, 1.0)).xyz;
      float reach = leafWindReach * length(modelMatrix[0].xyz);
      float tip = clamp(distance(worldPosition, anchor) / reach, 0.0, 1.0);
      vec3 axis = normalize(mat3(modelMatrix) * leafWindAxis);
        float bladePhase = dot(axis, vec3(1.7, 0.8, 2.3)) + dot(anchor.xz, vec2(0.31, 0.19));
      float delay = tip * (0.38 + reach * 0.12);
      float gust = islandGust(islandWindTime - delay, islandWindRoot.xz, islandWindDirection.xz);
      float release = sin(islandWindTime * 2.05 - delay * 2.05 + bladePhase);
      float flutter = release * (0.15 + 0.6 * abs(gust));
      float weight = tip * tip;
      offset += islandWindDirection * islandWindStrength * 1.8 * islandTipMotion * weight * (0.82 * gust + 0.18 * flutter);
      offset.y += islandWindStrength * 1.8 * islandTipMotion * weight * 0.43 * flutter;
      // Twist around the blade's own midrib. Its seam and stem stay together.
      vec3 lateral = worldPosition - anchor - axis * dot(worldPosition - anchor, axis);
      offset += islandWindStrength * 1.8 * cross(axis, lateral) * (0.095 * gust + 0.055 * flutter) * weight;
      // Ground-cover blades grow from separate fixed roots within one bed.
      // Canopy blades instead inherit their moving trunk/branch attachment.
      if (islandGroundCover > 0.5 || anchor.y - islandWindRoot.y < islandWindHeight * 0.2)
        offset -= islandBaseWind(anchor);
      // Low plants bend away from feet; attachment points remain fixed.
      if (islandGroundCover > 0.5) {
        vec2 away = worldPosition.xz - islandTraveler.xz;
        float proximity = 1.0 - smoothstep(0.0, 1.3, length(away));
        float vertical = clamp(1.0 - abs(anchor.y - islandTraveler.y) / 1.5, 0.0, 1.0);
        float push = proximity * vertical * islandInteraction * weight;
        offset.xz += away / max(length(away), 0.08) * push * 0.28;
        offset.y -= push * 0.06;
      }
    #endif
    // Inverse of the orthogonal TRS basis, including object/group scale.
    vec3 localOffset = vec3(
      dot(offset, modelMatrix[0].xyz) / dot(modelMatrix[0].xyz, modelMatrix[0].xyz),
      dot(offset, modelMatrix[1].xyz) / dot(modelMatrix[1].xyz, modelMatrix[1].xyz),
      dot(offset, modelMatrix[2].xyz) / dot(modelMatrix[2].xyz, modelMatrix[2].xyz)
    );
    return position + localOffset;
  }

  vec3 islandWindNormal(vec3 position, vec3 normal) {
    vec3 axis = abs(normal.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(axis, normal));
    vec3 bitangent = cross(normal, tangent);
    vec3 center = islandWindPosition(position);
    vec3 along = islandWindPosition(position + tangent * 0.005) - center;
    vec3 across = islandWindPosition(position + bitangent * 0.005) - center;
    return normalize(cross(along, across));
  }
`;

export function useIslandWind(height, tipMotion, leafLighting) {
  const field = useWindField();
  const probe = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("foliageProbe") : null;
  const root = useRef();
  const frameData = useRef();
  const attachRoot = useCallback((group) => {
    root.current = group;
    if (group && probe === "hide") group.visible = false;
  }, [probe]);
  const wind = useMemo(() => {
    const uniforms = {
      islandWindTime: field.time,
      islandWindDirection: field.direction,
      islandWindStrength: field.strength,
      islandTraveler: field.traveler,
      islandInteraction: field.interaction,
      islandGroundCover: { value: height <= 1 ? 1 : 0 },
      islandWindRoot: { value: new THREE.Vector3() },
      islandWindHeight: { value: height },
      islandTipMotion: { value: tipMotion },
    };
    const compile = (shader, leaf = false) => {
      if (probe === "raw") return;
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `
        #include <common>
        ${leaf ? "#define ISLAND_LEAF_WIND\nattribute vec3 leafWindRoot;\nattribute float leafWindReach;\nattribute vec3 leafWindAxis;" : ""}
        ${windFunctions}
      `).replace("#include <beginnormal_vertex>", `
        #include <beginnormal_vertex>
        objectNormal = islandWindNormal(position, objectNormal);
      `).replace("#include <begin_vertex>", `
        #include <begin_vertex>
        transformed = islandWindPosition(transformed);
      `);
    };
    const createShadow = (leaf, distance = false) => {
      const material = distance
        ? new THREE.MeshDistanceMaterial()
        : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      material.side = leaf ? THREE.DoubleSide : THREE.FrontSide;
      material.onBeforeCompile = (shader) => compile(shader, leaf);
      material.customProgramCacheKey = () => `island-wind-shadow-2-${leaf}-${distance}`;
      return material;
    };
    const depth = createShadow(false), leafDepth = createShadow(true);
    const distance = createShadow(false, true), leafDistance = createShadow(true, true);
    const pad = (mesh) => {
      const geometry = mesh.geometry;
      if (!geometry || geometry.userData.windBounds) return;
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += height * 0.05 + tipMotion * 2 + 0.08;
      geometry.userData.windBounds = true;
    };
    return {
      nodes: windNodes(uniforms), stemNodes: windNodes(uniforms, true),
      leafNodes: leafLighting ? leafSurfaceNodes(windNodes(uniforms, true)) : windNodes(uniforms, true),
      uniforms, scale: new THREE.Vector3(),
      shader: (shader) => compile(shader),
      leafShader: (shader) => { if (probe !== "raw") leafLighting?.(shader); compile(shader, true); },
      stemShader: (shader) => compile(shader, true),
      key: () => "island-wind-surface-2",
      leafKey: () => "island-thin-leaf-wind-surface-3",
      stemKey: () => "island-leaf-stem-wind-surface-2",
      mesh: { customDepthMaterial: depth, customDistanceMaterial: distance, onUpdate: pad, ...(probe === "no-shadow" ? { castShadow: false } : {}) },
      leafMesh: { customDepthMaterial: leafDepth, customDistanceMaterial: leafDistance, onUpdate: pad, ...(probe === "no-shadow" ? { castShadow: false } : {}) },
      dispose: () => { depth.dispose(); leafDepth.dispose(); distance.dispose(); leafDistance.dispose(); },
    };
  }, [height, tipMotion, leafLighting, probe, field]);
  useFrame(() => {
    const active = frameData.current;
    if (!root.current || !active) return;
    root.current.getWorldPosition(active.uniforms.islandWindRoot.value);
    root.current.getWorldScale(active.scale);
    active.uniforms.islandWindHeight.value = Math.max(0.01, height * active.scale.y);
    active.uniforms.islandTipMotion.value = tipMotion * active.scale.y;
  });
  useEffect(() => {
    frameData.current = wind;
    return () => { frameData.current = null; wind.dispose(); };
  }, [wind]);
  return [wind, attachRoot];
}
