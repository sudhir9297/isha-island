import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GATE } from "./GateTerrain.js";
import { MALAI_VASAL_ASSET, placeGateAsset, disposeGateAsset } from "./MalaiVasalAsset.js";

function GateModel() {
  const { scene } = useGLTF(MALAI_VASAL_ASSET);
  const model = useMemo(() => placeGateAsset(scene), [scene]);
  useEffect(() => () => disposeGateAsset(model), [model]);
  return <primitive object={model} dispose={null} />;
}
export default function MalaiVasal() {
  const fillTarget = useMemo(() => new THREE.Object3D(), []);
  return <group name="Malai Vasal mountain entrance">
    <primitive object={fillTarget} position={[0, GATE.floor + 2.5, 0]} />
    <directionalLight position={[-7, 13, 12]} target={fillTarget} color="#eee5df" intensity={0.8} />
    <group position={[GATE.x, GATE.floor, GATE.z]}>
      <Suspense fallback={null}><GateModel /></Suspense>
    </group>
  </group>;
}
