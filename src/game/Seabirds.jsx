import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, DoubleSide } from "three";

function wingGeometry(side) {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        0,
        0,
        0,
        side * 0.46,
        0.06,
        -0.08,
        side * 0.76,
        -0.02,
        0.17,
        side * 0.45,
        0.04,
        0.23,
        0,
        0,
        0.16,
      ],
      3,
    ),
  );
  g.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]);
  g.computeVertexNormals();
  return g;
}
export default function Seabirds() {
  const birds = useRef([]),
    wings = useRef([]);
  const geometry = useMemo(() => [wingGeometry(-1), wingGeometry(1)], []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.current.forEach((bird, i) => {
      const a = t * 0.11 + i * 1.8,
        flap = Math.sin(t * 3.2 + i) * 0.11;
      bird.position.set(
        -8 + Math.cos(a) * (3.4 + i * 0.9),
        1.3 + Math.sin(t * 0.7 + i) * 0.12,
        8 + Math.sin(a) * (2 + i * 0.3),
      );
      bird.rotation.y = -a - Math.PI / 2;
      if (wings.current[i * 2]) wings.current[i * 2].rotation.z = flap;
      if (wings.current[i * 2 + 1]) wings.current[i * 2 + 1].rotation.z = -flap;
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(r) => {
            birds.current[i] = r;
          }}
          scale={0.45}
        >
          <mesh scale={[0.12, 0.12, 0.42]} castShadow>
            <sphereGeometry args={[1, 10, 7]} />
            <meshStandardMaterial color="#f8f1d5" roughness={0.8} />
          </mesh>
          {geometry.map((g, j) => (
            <mesh
              key={j}
              geometry={g}
              ref={(r) => {
                wings.current[i * 2 + j] = r;
              }}
              castShadow
            >
              <meshStandardMaterial
                color="#eeeeda"
                side={DoubleSide}
                roughness={0.9}
              />
            </mesh>
          ))}
          <mesh position={[0, 0, -0.43]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.048, 0.13, 5]} />
            <meshStandardMaterial color="#c7b184" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
