import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

function Cleat({ position, rotation = [0, 0, 0], reflection }) {
  return <group position={position} rotation={rotation}>
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.23, 0.022, 0.085]} />
      <meshPhysicalMaterial color="#aebbb7" metalness={0.76} roughness={0.29} envMap={reflection} envMapIntensity={0.8} />
    </mesh>
    {[-0.061, 0.061].map(x => <mesh key={x} position={[x, 0.038, 0]} castShadow>
      <cylinderGeometry args={[0.015, 0.024, 0.058, 10]} />
      <meshPhysicalMaterial color="#b6c4bf" metalness={0.78} roughness={0.24} envMap={reflection} envMapIntensity={0.8} />
    </mesh>)}
    <mesh position={[0, 0.073, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.016, 0.016, 0.3, 12]} />
      <meshPhysicalMaterial color="#c4cfc9" metalness={0.78} roughness={0.26} envMap={reflection} envMapIntensity={0.8} />
    </mesh>
    {[-0.086, 0.086].map(x => <mesh key={x} position={[x, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.008, 8]} />
      <meshStandardMaterial color="#405350" roughness={0.6} />
    </mesh>)}
  </group>;
}

function RopeCoil() {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, angle = t * Math.PI * 7.2;
      const radius = 0.028 + t * 0.078;
      const x = 0.13 + Math.cos(angle) * radius, z = -1.72 + Math.sin(angle) * radius;
      const deckY = 0.61 + 0.04 * (-z - 1.6) / 0.37;
      points.push(new Vector3(x, deckY + 0.01 + t * 0.003, z));
    }
    points.push(new Vector3(0.23, 0.624, -1.63), new Vector3(0.17, 0.626, -1.65));
    return new TubeGeometry(new CatmullRomCurve3(points), 180, 0.007, 6, false);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshStandardMaterial color="#d4c4a0" roughness={0.94} />
  </mesh>;
}

export default function BoatHardware({ reflection }) {
  return <group>
    <Cleat position={[-0.18, 0.634, -1.72]} reflection={reflection} />
    {[-1, 1].map(side => <Cleat key={side} position={[side * 0.786, 0.635, 1.36]} rotation={[0, Math.PI / 2, 0]} reflection={reflection} />)}
    <RopeCoil />
    {[-1, 1].map(side => <group key={side} position={[side * 0.145, 0.59, 1.66]}>
      <mesh castShadow>
        <boxGeometry args={[0.032, 0.16, 0.09]} />
        <meshPhysicalMaterial color="#80928c" metalness={0.66} roughness={0.31} envMap={reflection} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.006, -0.057]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.04, 10]} />
        <meshStandardMaterial color="#334a43" roughness={0.52} />
      </mesh>
    </group>)}
  </group>;
}
