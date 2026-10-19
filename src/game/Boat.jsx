import WindCloth from './WindCloth.jsx';
import { useWindField } from './WindContext.js';
import { canopyDisplacement } from './ClothMotion.js';
import { hullFill } from './rendering/SurfaceNodes.js';
import NodeShaderMaterial from './rendering/NodeShaderMaterial.jsx';
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { navigationControls, stepBoatFrame } from "./BoatPhysics";
import { createFoamTexture } from "./BoatFoam";
import { prepareWakeInstances, visitLiveWake, commitWakeInstances } from "./WakeInstances.js";
import { createTeakTexture } from "./TeakTexture";
import { BOAT_SCALE } from "./WorldConfig";
import { sampleOceanSurface } from "./WaterOptics";
import { boatProfile } from "./BoatProfiles";
import BoatHardware from "./BoatHardware";
import { createBoatReflection } from "./BoatMaterials";
import { boatHullPose, createHullMeshData, HULL_PROFILE, INTERIOR_PROFILE, HULL_STATION_COUNT, HULL_STATIONS, widthAt } from "./BoatHull";

import { advancePropeller, MOTOR_PARTS, MOTOR_POSITION, motorSteeringAngle, PROPELLER_GEOMETRY, PROPELLER_HUB_GEOMETRY, PROPELLER_POSITION } from "./BoatMotor";

const CREAM = "#f5f6ee";
const TEAK = "#bb813f";
const FOAM_COUNT = 300;

function fillHullSide(shader) {
  shader.vertexShader = shader.vertexShader.replace(
    "#include <common>",
    "#include <common>\nvarying float vHullSideFill;",
  ).replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
    vHullSideFill = smoothstep(-0.045, 0.16, position.y)
      * (1.0 - smoothstep(0.42, 0.55, position.y))
      * pow(abs(normal.x), 2.0);`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    "#include <common>\nvarying float vHullSideFill;",
  ).replace(
    "#include <lights_fragment_end>",
    `#include <lights_fragment_end>
    // Local sky bounce on the exposed side, preserving the wet underside and rim.
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vHullSideFill * 0.18;`,
  );
}

function hullGeometry(interior = false) {
  const { positions: vertices, indices } = createHullMeshData(interior);
  const colors = [];
  const wetPaint = new THREE.Color("#c5d5ce");
  const dryPaint = new THREE.Color(CREAM);
  const count = HULL_STATION_COUNT;
  const profile = interior ? INTERIOR_PROFILE : HULL_PROFILE;
  for (let i = 0; i < count; i++) {
    const z = THREE.MathUtils.lerp(-1.98, 1.68, i / (count - 1));
    for (const [x, y] of profile) {
      if (!interior) {
        const dry = THREE.MathUtils.smoothstep(y, -0.18, 0.28);
        const paint = wetPaint.clone().lerp(dryPaint, dry);
        colors.push(paint.r, paint.g, paint.b);
      } else {
        const corner = 1 - 0.22 * THREE.MathUtils.smoothstep(Math.abs(x), 0.68, 0.93)
          * (1 - THREE.MathUtils.smoothstep(y, 0.3, 0.54));
        const seatContact = Math.max(...[-1.04, 0.1, 1.11].map((seat) => Math.exp(-(((z - seat) / 0.24) ** 2))));
        const depth = corner * (y < 0.2 ? 0.92 : 1)
          * (1 - seatContact * 0.12 * (1 - THREE.MathUtils.smoothstep(y, 0.34, 0.52)));
        colors.push(depth, depth, depth);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function Tube({
  points,
  radius = 0.025,
  color = TEAK,
  closed = false,
  segments = 48,
  emissiveIntensity = 0,
  roughness = 0.58,
  clearcoat = 0,
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      closed,
      "centripetal",
    );
    return new THREE.TubeGeometry(curve, segments, radius, 6, closed);
  }, [points, radius, closed, segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        clearcoat={clearcoat}
        clearcoatRoughness={0.3}
      />
    </mesh>
  );
}

function Timber({
  position,
  scale,
  color = TEAK,
  rotation,
  children,
  emissiveIntensity = 0,
  map,
  roughness = map ? 0.62 : 0.48,
  clearcoat = map ? 0.08 : 0.18,
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox
        args={scale}
        radius={Math.min(map ? 0.018 : 0.035, Math.min(...scale) * 0.45)}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color={color}
          map={map}
          bumpMap={map}
          bumpScale={map ? 0.008 : 0}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={roughness}
          clearcoat={clearcoat}
          clearcoatRoughness={map ? 0.5 : 0.3}
        />
      </RoundedBox>
      {children}
    </group>
  );
}

function LaunchCanopy() {
  const wind = useWindField();
  const cloth = useMemo(() => {
    const vertices = [], colors = [], indices = [];
    const cream = new THREE.Color("#f0e0b8"), stripe = new THREE.Color("#3e8290");
    for (let row = 0; row <= 12; row++) for (let column = 0; column <= 32; column++) {
      const x = -0.74 + column / 32 * 1.48, z = -0.47 + row / 12 * 1.6;
      vertices.push(x, 1.66 + 0.12 * (1 - (x / 0.74) ** 2) - 0.008 * Math.cos(z * 7), z);
      const color = column % 8 >= 2 && column % 8 <= 4 ? stripe : cream;
      colors.push(color.r, color.g, color.b);
      if (row < 12 && column < 32) {
        const i = row * 33 + column;
        indices.push(i, i + 33, i + 1, i + 1, i + 33, i + 34);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.userData.rest = geometry.attributes.position.array.slice();
    geometry.userData.windTime = -1; geometry.userData.windStrength = -1;
    return geometry;
  }, []);
  useEffect(() => () => cloth.dispose(), [cloth]);
  useFrame(() => {
    if (cloth.userData.windTime === wind.time.value && cloth.userData.windStrength === wind.strength.value) return;
    // eslint-disable-next-line react/immutability -- Cache updates for this mutable Three.js geometry.
    cloth.userData.windTime = wind.time.value; cloth.userData.windStrength = wind.strength.value;
    const p = cloth.attributes.position, rest = cloth.userData.rest;
    for (let i = 0; i < p.count; i++) {
      const x = rest[i * 3], z = rest[i * 3 + 2];
      p.setY(i, rest[i * 3 + 1] + canopyDisplacement(x, z, wind.time.value, wind.strength.value));
    }
    // eslint-disable-next-line react/immutability -- Three.js cloth buffer updated in the frame loop.
    p.needsUpdate = true;
    cloth.computeVertexNormals();
  });
  return <group>
    <mesh geometry={cloth} castShadow receiveShadow>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.96} />
    </mesh>
    {[-0.33, 1].map(z => <Tube key={z} points={Array.from({length: 13}, (_, i) => {
      const x = -0.63 + i / 12 * 1.26;
      return [x, 1.635 + 0.12 * (1 - (x / 0.74) ** 2), z];
    })} radius={0.018} color="#d0bd8e" />)}
    {[-0.74, 0.74].map(x => <Tube key={x} points={Array.from({length: 13}, (_, i) => {
      const z = -0.47 + i / 12 * 1.6;
      return [x, 1.66 - 0.008 * Math.cos(z * 7), z];
    })} radius={0.012} color="#d4c69e" />)}
  </group>;
}

function BoatFittings({ id }) {
  if (id === "runabout") return <group>
    <Timber position={[0, 0.57, -0.18]} scale={[0.65, 0.54, 0.5]} color="#f0e5ce" roughness={0.43} />
    <group position={[0, 1.01, -0.34]} rotation={[-0.28, 0, 0]}>
      <mesh><boxGeometry args={[0.74, 0.44, 0.018]} /><meshPhysicalMaterial color="#a4d2da" transparent opacity={0.42} roughness={0.13} clearcoat={0.7} /></mesh>
      {[-0.37, 0.37].map(x => <Timber key={x} position={[x, 0, 0]} scale={[0.022, 0.45, 0.028]} color="#d8e2d9" roughness={0.3} />)}
      <Timber position={[0, 0.22, 0]} scale={[0.75, 0.022, 0.028]} color="#d8e2d9" roughness={0.3} />
    </group>
    <mesh position={[0, 0.848, 0.025]}><boxGeometry args={[0.5, 0.014, 0.16]} /><meshStandardMaterial color="#486566" roughness={0.54} /></mesh>
    <group position={[0.17, 0.89, 0.11]} rotation={[-0.7, 0, 0]}>
      <mesh><torusGeometry args={[0.115, 0.014, 6, 20]} /><meshStandardMaterial color="#34474a" roughness={0.5} /></mesh>
      <mesh><boxGeometry args={[0.22, 0.014, 0.018]} /><meshStandardMaterial color="#34474a" /></mesh>
      <mesh><boxGeometry args={[0.014, 0.22, 0.018]} /><meshStandardMaterial color="#34474a" /></mesh>
    </group>
    <Timber position={[0, 0.48, 0.67]} scale={[1.38, 0.12, 0.4]} color="#f4e7cb" roughness={0.76} />
  </group>;
  if (id !== "workboat") return null;
  return <group>
    {[-0.63, 0.63].flatMap(x => [-0.33, 1.0].map(z => <mesh key={`${x}/${z}`} position={[x, 1.08, z]} castShadow>
      <cylinderGeometry args={[0.023, 0.023, 1.2, 8]} />
      <meshStandardMaterial color="#d0bd8e" roughness={0.42} metalness={0.18} />
    </mesh>))}
    <LaunchCanopy />
    <Timber position={[0.46, 0.4, 1.04]} scale={[0.34, 0.32, 0.42]} color="#98744c" />
  </group>;
}

const BoatModel = memo(function BoatModel({ modelRef, motorRef, propellerRef, boatId }) {
  const profile = boatProfile(boatId);
  const data = useMemo(() => {
    const hull = hullGeometry();
    const inside = hullGeometry(true);
    const rails = [];
    for (let i = 0; i <= 25; i++) {
      const z = THREE.MathUtils.lerp(-1.98, 1.68, i / 25);
      rails.push([-widthAt(z), 0.56 + Math.max(0, -z - 0.8) * 0.1, z]);
    }
    rails.push([0, 0.56, 1.68]);
    for (let i = 25; i >= 0; i--) {
      const z = THREE.MathUtils.lerp(-1.98, 1.68, i / 25);
      rails.push([widthAt(z), 0.56 + Math.max(0, -z - 0.8) * 0.1, z]);
    }
    const ribs = [-1.38, -0.92, -0.43, 0.07, 0.56, 1.07, 1.5].map((z) => {
      const w = widthAt(z) - 0.085;
      return [
        [-w, 0.51, z],
        [-w * 0.9, 0.28, z],
        [-w * 0.64, 0.155, z],
        [0, 0.15, z],
        [w * 0.64, 0.155, z],
        [w * 0.9, 0.28, z],
        [w, 0.51, z],
      ];
    });
    const foredeck = new THREE.BufferGeometry();
    foredeck.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        boatId === "runabout"
          ? [-0.03, 0.65, -1.97, -0.78, 0.61, -0.72, 0.78, 0.61, -0.72]
          : [-0.03, 0.65, -1.97, -0.48, 0.61, -1.6, 0.48, 0.61, -1.6],
        3,
      ),
    );
    foredeck.computeVertexNormals();
    foredeck.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 0, 0, 1, 1, 1], 2));
    return { hull, inside, rails, ribs, foredeck, teak: createTeakTexture(), reflection: createBoatReflection() };
  }, [boatId]);
  useEffect(() => () => {
    for (const key of ["hull", "inside", "foredeck", "teak", "reflection"]) data[key].dispose();
  }, [data]);
  return (
    <group ref={modelRef} scale={profile.modelScale}>
      <BoatFittings id={boatId} />
      <BoatHardware reflection={data.reflection} />
      <mesh geometry={data.hull} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          emissiveNode={hullFill} onBeforeCompile={fillHullSide}
          emissive={CREAM}
          emissiveIntensity={0.055}
          roughness={0.37}
          envMap={data.reflection}
          envMapIntensity={0.55}
          clearcoat={0.32}
          clearcoatRoughness={0.32}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={data.inside} castShadow receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          color={profile.interior}
          emissive={profile.interior}
          emissiveIntensity={0.035}
          roughness={0.46}
          envMap={data.reflection}
          envMapIntensity={0.32}
          clearcoat={0.18}
          clearcoatRoughness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.31, 1.66]} castShadow>
        <boxGeometry args={[1.49, 0.46, 0.08]} />
        <meshStandardMaterial color={CREAM} roughness={0.52} />
      </mesh>
      <Tube
        points={data.rails}
        radius={0.064}
        color={CREAM}
        emissiveIntensity={0.025}
        roughness={0.36}
        clearcoat={0.24}
        closed
        segments={120}
      />
      <Tube
        points={data.rails.map(([x, y, z]) => [x * 0.96, y + 0.046, z])}
        radius={0.014}
        closed
        segments={120}
      />
      <Tube
        points={data.rails.map(([x, y, z]) => [x * 0.91, y + 0.018, z * 0.975])}
        radius={0.028}
        color={profile.trim}
        emissiveIntensity={0.035}
        closed
        segments={120}
      />
      {[-1, 1].map((side) => (
        <Tube
          key={side}
          points={HULL_STATIONS.map(([z, w]) => [
            side * (w * 0.99),
            0.35 + Math.max(0, -z - 0.8) * 0.08,
            z,
          ])}
          radius={0.012}
          color="#d2b57c"
        />
      ))}
      {data.ribs.map((points, i) => (
        <Tube
          key={i}
          points={points}
          radius={0.027}
          color={i % 2 ? "#c89755" : "#ae763d"}
        />
      ))}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
        <Timber
          key={x}
          position={[x, 0.16, 0.25]}
          scale={[0.2, 0.032, 2.55]}
          color={profile.floor[i % 2]}
          emissiveIntensity={0.025}
          roughness={0.52}
          clearcoat={0.12}
        />
      ))}
      {[-1.04, 0.1, 1.11].filter(z => boatId !== "runabout" || z > 1).map((z, i) => (
        <Timber
          key={z}
          position={[0, 0.45, z]}
          scale={[widthAt(z) * 1.92, 0.09, 0.36]}
          color={i % 2 ? "#c89349" : "#c08a46"}
          map={data.teak}
        >
          {[-0.105, 0.105].map((dz) => (
            <mesh key={dz} position={[0, 0.048, dz]}>
              <boxGeometry args={[widthAt(z) * 1.83, 0.004, 0.009]} />
              <meshStandardMaterial color="#8e5e2f" />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * widthAt(z) * 0.83, 0.05, 0]}>
              <sphereGeometry args={[0.02, 8, 6]} />
              <meshStandardMaterial
                color="#dcc591"
                metalness={0.5}
                roughness={0.45}
              />
            </mesh>
          ))}
        </Timber>
      ))}
      <mesh geometry={data.foredeck} castShadow>
        <meshStandardMaterial
          color="#c59552"
          map={data.teak}
          side={THREE.DoubleSide}
          roughness={0.57}
        />
      </mesh>
      <Tube
        points={[
          [-0.46, 0.63, -1.61],
          [0, 0.66, -1.62],
          [0.46, 0.63, -1.61],
        ]}
        radius={0.018}
        color="#8c632f"
      />
      <Timber
        position={[0.49, 0.54, 1.11]}
        scale={[0.39, 0.13, 0.3]}
        color="#e9e1bc"
      />
      <group ref={motorRef} position={MOTOR_POSITION}>
        <Timber
          position={[0, 0.28, 0]}
          scale={[0.5, 0.52, 0.39]}
          color="#073c2b"
        />
        <Timber
          position={[0, 0.54, -0.015]}
          scale={[0.52, 0.08, 0.4]}
          color="#19966b"
        />
        <mesh position={[0, 0.21, -0.203]}>
          <boxGeometry args={[0.33, 0.035, 0.012]} />
          <meshStandardMaterial color="#e4cf94" />
        </mesh>
        {MOTOR_PARTS.map((part, i) => <mesh key={i} geometry={part.geometry} position={part.position} castShadow>
          <meshStandardMaterial color={part.color} roughness={0.4} metalness={part.metalness} />
        </mesh>)}
        <group ref={propellerRef} position={PROPELLER_POSITION}>
          <mesh geometry={PROPELLER_HUB_GEOMETRY} castShadow>
            <meshStandardMaterial color="#788b80" metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh geometry={PROPELLER_GEOMETRY} castShadow>
            <meshStandardMaterial color="#829386" metalness={0.75} roughness={0.32} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <Tube
          points={[
            [0.2, 0.25, -0.1],
            [0.4, 0.25, -0.35],
            [0.36, 0.23, -0.68],
          ]}
          radius={0.025}
          color="#344a3c"
        />
      </group>
      <group position={[0, 0.62, -1.76]} rotation={[0, 0.55, 0]}>
        <mesh position={[0, 0.54, 0]} castShadow>
          <cylinderGeometry args={[0.019, 0.026, 1.08, 8]} />
          <meshStandardMaterial color="#b79b62" roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.09, 0]}>
          <sphereGeometry args={[0.036, 8, 6]} />
          <meshStandardMaterial
            color="#e2bd61"
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
        <WindCloth position={[0, 1.02, 0]} emblem />
      </group>
      <group position={[0, 0.665, -1.57]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[0, 0.014 * i, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.11 - i * 0.012, 0.014, 5, 24]} />
            <meshStandardMaterial color="#e3cb92" roughness={0.95} />
          </mesh>
        ))}
      </group>
      <Tube
        points={[
          [0.13, 0.65, -1.6],
          [0.17, 0.7, -1.8],
          [0.08, 0.56, -2.06],
          [0, 0.18, -2.08],
        ]}
        radius={0.012}
        color="#d9c494"
      />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.73, 0.59, 0.87]}>
          <mesh>
            <boxGeometry args={[0.08, 0.05, 0.15]} />
            <meshStandardMaterial
              color="#b9b8a0"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.022, 0.026, 0.13, 8]} />
            <meshStandardMaterial
              color="#aab2a0"
              metalness={0.65}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.58, 0.57, -1.29]}>
          <sphereGeometry args={[0.052, 8, 6]} />
          <meshStandardMaterial
            color={side < 0 ? "#d96145" : "#63c29c"}
            emissive={side < 0 ? "#d54220" : "#23a878"}
            emissiveIntensity={0.3}
            roughness={0.4}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * 0.94, 0.29, 0.59]}
            rotation={[0, 0, side * 0.1]}
          >
            <cylinderGeometry args={[0.064, 0.064, 0.28, 10]} />
            <meshStandardMaterial color="#fff8e9" roughness={0.9} />
          </mesh>
          <Tube
            points={[
              [side * 0.86, 0.59, 0.59],
              [side * 0.95, 0.48, 0.59],
              [side * 0.95, 0.41, 0.59],
            ]}
            radius={0.009}
            color="#e8d3a2"
            segments={12}
          />
          <mesh
            position={[side * 0.74, 0.31, -1.05]}
            rotation={[0, 0, side * 0.15]}
          >
            <cylinderGeometry args={[0.047, 0.047, 0.22, 8]} />
            <meshStandardMaterial color="#fff8e9" roughness={0.9} />
          </mesh>
          <Tube
            points={[
              [side * 0.7, 0.59, -1.05],
              [side * 0.75, 0.43, -1.05],
            ]}
            radius={0.008}
            color="#e8d3a2"
            segments={10}
          />
        </group>
      ))}
    </group>
  );
});

const Wake = memo(function Wake({ boatState, paused }) {
  const foamRef = useRef();
  const contactRef = useRef();
  const contactMaterial = useRef();
  const contactGeometryRef = useRef();
  const contactGeometry = useMemo(() => new THREE.PlaneGeometry(3.1 * BOAT_SCALE, 4.8 * BOAT_SCALE, 14, 22), []);
  useEffect(() => () => contactGeometry.dispose(), [contactGeometry]);
  const foam = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.setAttribute(
      "instanceFade",
      new THREE.InstancedBufferAttribute(new Float32Array(FOAM_COUNT), 1),
    );
    geometry.setAttribute(
      "instanceSeed",
      new THREE.InstancedBufferAttribute(new Float32Array(FOAM_COUNT), 1),
    );
    return { geometry, uniforms: { uFoam: { value: createFoamTexture() } } };
  }, []);
  useEffect(() => () => {
    foam.geometry.dispose();
    foam.uniforms.uFoam.value.dispose();
  }, [foam]);
  useLayoutEffect(() => prepareWakeInstances(foamRef.current), [foam]);
  const dataRef = useRef({
      particles: Array.from({ length: FOAM_COUNT }, () => ({
        x: 0, z: 0, dx: 0, dz: 0, age: 100, life: 1,
        width: 0, length: 0, rotation: 0, spin: 0, opacity: 0, spread: 0, seed: 0,
      })),
      dummy: new THREE.Object3D(), cursor: 0, emit: 0, nextEmit: 0.075,
      previous: new THREE.Vector3(), resetId: undefined,
      surface: { normal: [0, 1, 0] }, normal: new THREE.Vector3(), planeNormal: new THREE.Vector3(0, 0, 1),
  });
  useFrame(({ clock }, delta) => {
    if (paused) return;
    const data = dataRef.current;
    const dt = Math.min(delta, 0.06);
    const state = boatState.current;
    const profile = boatProfile(state.boatId);
    const movement = state.beached ? 0 : Math.abs(state.speed);
    const speed = Math.min(1, movement / profile.maxSpeed);
    const direction = state.speed < 0 ? -1 : 1;
    const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
    const hullLengthScale = BOAT_SCALE * profile.modelScale[2];
    const hullWidthScale = BOAT_SCALE * profile.modelScale[0];
    // Only the short hull contact sheet remains. Each vertex hugs the same
    // displaced ocean field; emitted foam follows it at its own world location.
    contactRef.current.visible = !state.beached;
    contactRef.current.position.set(state.position.x, 0, state.position.z);
    contactRef.current.rotation.y = state.heading;
    contactRef.current.scale.set(profile.modelScale[0], 1, profile.modelScale[2]);
    const vertices = contactGeometryRef.current.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i) * profile.modelScale[0];
      const z = -vertices.getY(i) * profile.modelScale[2];
      sampleOceanSurface(state.position.x + cos * x + sin * z,
        state.position.z - sin * x + cos * z, clock.elapsedTime, data.surface);
      vertices.setZ(i, data.surface.height + 0.003);
    }
    vertices.needsUpdate = true;
    contactMaterial.current.uniforms.uTime.value = clock.elapsedTime;
    contactMaterial.current.uniforms.uSpeed.value = speed;
    // Forward foam leaves the motor beyond the transom; reverse leaves the bow.
    const trailingEnd = direction > 0 ? 1.83 : -2.02;
    const justReset = data.resetId !== state.resetId;
    if (justReset) {
      data.resetId = state.resetId;
      data.cursor = 0;
      data.emit = 0;
      data.nextEmit = 0.075;
      data.previous.copy(state.position);
      for (const p of data.particles) p.age = p.life;
    }
    const interval = 0.075 + (1 - speed) * 0.025;
    // No idle source. Existing surface bubbles finish dispersing after a stop.
    data.emit = movement > 0.13 && !justReset ? Math.min(data.emit + dt, interval + 0.06) : 0;
    let batches = 0;
    // Carry elapsed time across frames. Two batches cover the maximum 0.06 dt,
    // so 30/60/120 Hz produce the same density along the boat's path.
    while (data.emit >= data.nextEmit && batches++ < 2) {
      data.emit -= data.nextEmit;
      const lag = Math.min(1, data.emit / dt);
      const originX = state.position.x + (data.previous.x - state.position.x) * lag;
      const originZ = state.position.z + (data.previous.z - state.position.z) * lag;
      data.nextEmit = interval * (0.65 + Math.random() * 0.7);
      // A burst favours one edge and sometimes leaves the other open. Its
      // unequal lobes separate as the wash slows, instead of drawing rails.
      const mainSide = Math.random() < 0.5 ? -1 : 1;
      const count = Math.random() < 0.34 ? 3 : 4;
      const strength = 0.72 + Math.random() * 0.28;
      for (let sample = 0; sample < count; sample++) {
        const fresh = sample === 0;
        const edge = sample === 1 || sample === 2;
        const side = sample === 1 ? mainSide : sample === 2 ? -mainSide : Math.random() * 2 - 1;
        const spread = side * (edge ? 0.28 + Math.random() * 0.47 : fresh ? 0.1 : 0.25) * hullWidthScale;
        const p = data.particles[data.cursor];
        data.cursor = (data.cursor + 1) % data.particles.length;
        const phase = Math.random() * (fresh ? 0.15 : 0.85);
        const end = trailingEnd * hullLengthScale
          + direction * movement * interval * phase;
        p.x = originX + sin * end + cos * spread;
        p.z = originZ + cos * end - sin * spread;
        const lateral = side * (edge ? 0.1 + movement * (0.035 + Math.random() * 0.03) : 0.07);
        const aft = direction * (0.11 + speed * 0.13);
        p.dx = cos * lateral + sin * aft;
        p.dz = -sin * lateral + cos * aft;
        p.age = data.emit - dt;
        p.life = (edge ? 1.68 : 1.4) + speed * 0.88 + Math.random() * 0.3;
        p.width = (0.35 + speed * 0.21) * hullWidthScale
          * (0.7 + Math.random() * 0.8);
        p.length = (0.3 + movement * interval * 0.66)
          * hullLengthScale * (0.7 + Math.random() * 0.7);
        p.opacity = strength * (sample === 2 ? 0.4 + Math.random() * 0.2 : fresh ? 0.82 : 0.76);
        p.spread = 0.32 + Math.random() * 0.46;
        p.spin = (Math.random() - 0.5) * 0.62;
        p.seed = fresh ? Math.random() * 0.25 : 0.25 + Math.random() * 0.75;
        p.rotation = state.heading + (direction < 0 ? Math.PI : 0)
          + (Math.random() - 0.5) * 0.95;
      }
    }
    data.previous.copy(state.position);
    const fades = foamRef.current.geometry.attributes.instanceFade;
    const seeds = foamRef.current.geometry.attributes.instanceSeed;
    const activeCount = visitLiveWake(data.particles, dt, (p, i) => {
      // Surface motion spreads sideways and loses momentum, without rising.
      const surfaceDt = Math.min(dt, p.age);
      const drag = Math.exp(-surfaceDt * 0.62);
      p.dx *= drag;
      p.dz *= drag;
      p.x += p.dx * surfaceDt;
      p.z += p.dz * surfaceDt;
      const fade = 1 - p.age / p.life;
      const birth = Math.min(1, p.age / 0.065);
      sampleOceanSurface(p.x, p.z, clock.elapsedTime, data.surface);
      data.dummy.position.set(p.x, data.surface.height + 0.0045, p.z);
      data.normal.fromArray(data.surface.normal);
      data.dummy.quaternion.setFromUnitVectors(data.planeNormal, data.normal);
      data.dummy.rotateZ(p.rotation + p.age * p.spin);
      data.dummy.scale.set(
        p.width * (1 + p.age * p.spread),
        p.length * (1 + p.age * 0.22), 1,
      );
      fades.setX(i, birth * Math.pow(fade, 1.25) * p.opacity);
      seeds.setX(i, p.seed);
      data.dummy.updateMatrix();
      foamRef.current.setMatrixAt(i, data.dummy.matrix);
    });
    commitWakeInstances(foamRef.current, activeCount);
  });
  return (
    <group userData={{ seaSurfaceOnly: true }}>
      <group ref={contactRef}>
        <mesh ref={contactGeometryRef} geometry={contactGeometry} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5} frustumCulled={false}>
          <NodeShaderMaterial kind="contact"
            ref={contactMaterial}
            uniforms={{ uTime: { value: 0 }, uSpeed: { value: 0 } }}
            transparent depthWrite={false} toneMapped={false}
          />
        </mesh>
      </group>
      <instancedMesh
        ref={foamRef}
        args={[foam.geometry, null, FOAM_COUNT]}
        frustumCulled={false}
        renderOrder={6}
      >
        <NodeShaderMaterial kind="foam"
          uniforms={foam.uniforms}
          transparent depthWrite={false} toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
});

export default function Boat({
  boatId = "skiff",
  input,
  boatState,
  onTelemetry,
  paused = false,
  terrainRef,
}) {
  const root = useRef();
  const model = useRef();
  const motor = useRef();
  const propeller = useRef();
  const propellerPhase = useRef(0);
  const telemetryTime = useRef(0);
  const pose = useRef({});
  useFrame(({ clock }, delta) => {
    const state = stepBoatFrame(
      boatState.current,
      paused ? {} : navigationControls(boatState.current, input.current, delta),
      delta,
      paused,
      clock.elapsedTime,
      terrainRef?.current,
    );
    const t = state.visualTime;
    root.current.position.copy(state.position);
    root.current.rotation.y = state.heading;
    boatHullPose(state, t, pose.current);
    model.current.position.y = pose.current.bob;
    model.current.rotation.z = pose.current.roll;
    model.current.rotation.x = pose.current.pitch;
    motor.current.rotation.y = motorSteeringAngle(state);
    propellerPhase.current = advancePropeller(propellerPhase.current, state.speed, delta, paused);
    propeller.current.rotation.z = propellerPhase.current;
    telemetryTime.current += delta;
    if (onTelemetry && telemetryTime.current > 0.16) {
      telemetryTime.current = 0;
      onTelemetry({
        beached: Boolean(state.beached),
        beachedTime: state.beachedTime ?? 0,
        speed: state.speed,
        heading: state.heading,
        x: state.position.x,
        z: state.position.z,
      });
    }
  });
  return (
    <>
      <group ref={root} scale={BOAT_SCALE}>
        <BoatModel key={boatId} boatId={boatId} modelRef={model} motorRef={motor} propellerRef={propeller} />
      </group>
      <Wake boatState={boatState} paused={paused} />
    </>
  );
}
