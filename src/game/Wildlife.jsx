import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Object3D } from "three";
import { createWildlife, stepWildlife } from "./WildlifeSimulation.js";
import { createWildlifeGeometry, deformMantaBody, deformMantaWings, deformShark } from "./WildlifeGeometry.js";

const SMALL_SPECIES = ["silver", "butterfly", "parrot"];

function WildlifeMaterial() {
  return <meshStandardMaterial vertexColors side={DoubleSide} roughness={0.58} />;
}

// Ambient wildlife continues with ocean motion. Movement happens before the underwater capture.
export default function Wildlife({ boatState, seed = 93, terrainRef, wildlifeRef }) {
  const batches = useRef({}), mantaBody = useRef(), mantaWings = useRef(), sharkBody = useRef();
  const simulation = useMemo(() => createWildlife(seed), [seed]);
  const geometry = useMemo(() => createWildlifeGeometry(), []);
  const resources = useMemo(() => {
    const root = new Object3D(), tail = new Object3D(); root.add(tail);
    return { root, tail };
  }, []);
  const groups = useMemo(() => Object.fromEntries(SMALL_SPECIES.map((species) => [species, simulation.animals.filter((a) => a.species === species)])), [simulation]);

  useEffect(() => () => {
    Object.values(geometry).forEach((species) => Object.values(species).forEach((asset) => asset?.dispose?.()));
  }, [geometry]);

  function updateTransforms() {
    const { root, tail } = resources;
    for (const species of SMALL_SPECIES) {
      const refs = batches.current[species];
      if (!refs?.body || !refs?.tail) continue;
      groups[species].forEach((a, i) => {
        root.position.set(a.x, a.y, a.z); root.rotation.set(a.bank, -a.heading, 0, "YXZ"); root.scale.setScalar(a.terrainUnavailable ? 0 : a.size);
        tail.position.set(geometry[species].tailX, 0, 0); tail.rotation.set(0, Math.sin(a.stroke) * 0.46, 0);
        root.updateMatrixWorld(true);
        refs.body.setMatrixAt(i, root.matrixWorld); refs.tail.setMatrixAt(i, tail.matrixWorld);
      });
      refs.body.instanceMatrix.needsUpdate = true; refs.tail.instanceMatrix.needsUpdate = true;
    }
    for (const animal of simulation.animals) {
      if (animal.species !== "manta" && animal.species !== "shark") continue;
      const meshes = animal.species === "manta" ? [mantaBody.current, mantaWings.current] : [sharkBody.current];
      meshes.forEach((mesh) => {
        if (!mesh) return;
        mesh.visible = !animal.terrainUnavailable;
        mesh.position.set(animal.x, animal.y, animal.z); mesh.rotation.set(animal.bank, -animal.heading, 0, "YXZ"); mesh.scale.setScalar(animal.size);
      });
      if (animal.species === "manta") {
        deformMantaWings(geometry.manta.wings, animal.stroke, animal);
        deformMantaBody(geometry.manta.body, animal.stroke, animal);
      }
      else deformShark(geometry.shark.body, animal.stroke, animal);
      if (wildlifeRef) {
        wildlifeRef.current ??= {};
        wildlifeRef.current[animal.species] = animal;
      }
    }
  }

  useLayoutEffect(updateTransforms, [geometry, groups, resources, simulation, wildlifeRef]);
  useFrame((_, delta) => {
    const boat = boatState?.current, position = boat?.position;
    stepWildlife(simulation, delta, position ? { x: position.x, z: position.z, heading: boat.heading, speed: boat.speed } : null, terrainRef?.current);
    updateTransforms();
  }, -0.75);

  return <group name="ambient-wildlife">
    {SMALL_SPECIES.map((species) => <group key={species} name={`${species}-fish`}>
      <instancedMesh ref={(mesh) => { (batches.current[species] ??= {}).body = mesh; }} args={[geometry[species].body, null, groups[species].length]} frustumCulled={false}>
        <WildlifeMaterial />
      </instancedMesh>
      <instancedMesh ref={(mesh) => { (batches.current[species] ??= {}).tail = mesh; }} args={[geometry[species].tail, null, groups[species].length]} frustumCulled={false}>
        <WildlifeMaterial />
      </instancedMesh>
    </group>)}
    <mesh ref={mantaBody} geometry={geometry.manta.body} frustumCulled={false}><WildlifeMaterial /></mesh>
    <mesh ref={mantaWings} geometry={geometry.manta.wings} frustumCulled={false}><WildlifeMaterial /></mesh>
    <mesh ref={sharkBody} geometry={geometry.shark.body} frustumCulled={false}><WildlifeMaterial /></mesh>
  </group>;
}
