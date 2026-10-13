import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH, Vector3 } from "three";
import { START, CAMERA_OFFSET, CAMERA_VIEW_HEIGHT } from "./WorldConfig";
import { GATE } from "./GateTerrain.js";
import { ISLAND_CENTER_Z } from "./Seabed.js";

export default function CameraRig({ boatState, freeCamera, captureFocus = "scene", wildlifeRef, mapAction }) {
  const camera = useRef(),
    orbit = useRef();
  const size = useThree((s) => s.size);
  const target = useRef(new Vector3(START.x, 0, START.z));
  const offset = useRef(new Vector3(...CAMERA_OFFSET));
  const followPoint = useRef(new Vector3());
  useEffect(() => {
    if (!freeCamera) {
      if (camera.current) {
        camera.current.zoom = Math.min(size.height, size.width * 1.8) / (captureFocus === "scene" ? CAMERA_VIEW_HEIGHT : captureFocus === "foliage" ? 14 : captureFocus === "gate-detail" ? 10.8 : captureFocus === "gate" ? 21 : captureFocus === "boat" ? 7 : 10);
        camera.current.updateProjectionMatrix();
      }
      return;
    }
    if (!orbit.current) return;
    const controls = orbit.current, view = camera.current;
    const baseZoom = Math.min(size.height, size.width) / 50;
    if (mapAction?.type === "in" || mapAction?.type === "out") {
      view.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom,
        view.zoom * (mapAction.type === "in" ? 1.3 : 1 / 1.3)));
    } else {
      const focus = mapAction?.type === "boat" ? boatState.current.position : new Vector3(0, 0, -12);
      controls.target.copy(focus);
      view.position.copy(focus).add(new Vector3(...CAMERA_OFFSET));
      view.zoom = baseZoom;
    }
    view.updateProjectionMatrix();
    controls.update();
  }, [freeCamera, mapAction, size.width, size.height, boatState, captureFocus]);
  useFrame((_, delta) => {
    if (!camera.current) return;
    const creature = captureFocus === "scene" ? null : wildlifeRef?.current?.[captureFocus];
    if (freeCamera) {
      return;
    }
    const destination = captureFocus === "foliage"
      ? followPoint.current.set(-8.5, 3, ISLAND_CENTER_Z)
      : (captureFocus === "gate" || captureFocus === "gate-detail")
      ? followPoint.current.set(GATE.x, GATE.floor + (captureFocus === "gate-detail" ? 3.2 : 1), GATE.z + ISLAND_CENTER_Z)
      : creature
      ? followPoint.current.set(creature.x, creature.y, creature.z)
      : boatState.current.position;
    target.current.lerp(destination, 1 - Math.exp(-delta * 3.5));
    offset.current.set(...(captureFocus === "foliage" ? [-10, 18, 16] : captureFocus === "gate-detail" ? [4.5, 5, 15] : captureFocus === "gate" ? [0, 8, 24] : CAMERA_OFFSET));
    camera.current.position.copy(target.current).add(offset.current);
    camera.current.lookAt(target.current);
  }, -0.5);
  return (
    <>
      <OrthographicCamera
        ref={camera}
        makeDefault
        position={[START.x + CAMERA_OFFSET[0], CAMERA_OFFSET[1], START.z + CAMERA_OFFSET[2]]}
        zoom={Math.min(size.height, size.width * 1.8) / (captureFocus === "scene" ? CAMERA_VIEW_HEIGHT : captureFocus === "foliage" ? 14 : captureFocus === "gate-detail" ? 10.8 : captureFocus === "gate" ? 21 : captureFocus === "boat" ? 7 : 10)}
        near={0.1}
        far={200}
      />
      {freeCamera ? (
        <OrbitControls
          ref={orbit}
          makeDefault
          enableDamping
          dampingFactor={0.12}
          screenSpacePanning={false}
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
          touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
          enablePan
          minZoom={Math.min(size.height, size.width) / 110}
          maxZoom={Math.min(size.height, size.width) / 6}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI * 0.45}
        />
      ) : null}
    </>
  );
}
