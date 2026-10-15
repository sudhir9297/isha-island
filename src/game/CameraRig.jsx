import { createCameraFollow, changeFollowZoom, stepCameraFollow } from './CameraFollow.js';
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH, Vector3 } from "three";
import { ADIYOGI_ISLAND, MAP_FRAME } from "./AdiyogiTerrain.js";
import { START, CAMERA_OFFSET, CAMERA_VIEW_HEIGHT } from "./WorldConfig";
import { WORLD_MARKERS } from "./WorldMarkers.js";
import { ISLAND_CENTER_Z } from "./Seabed.js";

export default function CameraRig({ journey, boatState, freeCamera, captureFocus = "scene", wildlifeRef, mapAction }) {
  const camera = useRef(),
    orbit = useRef();
  const size = useThree((s) => s.size);
  const canvas = useThree((s) => s.gl.domElement);
  const follow = useRef(createCameraFollow());
  const wasFree = useRef(false);
  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const target = useRef(new Vector3(START.x, 0, START.z));
  const offset = useRef(new Vector3(...CAMERA_OFFSET));
  const smoothedOffset = useRef(new Vector3(...CAMERA_OFFSET));
  const followPoint = useRef(new Vector3());
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = preference.matches; };
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (freeCamera || captureFocus !== 'scene') return;
    let pinchDistance = null;
    const wheel = (event) => {
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      changeFollowZoom(follow.current, -Math.max(-120, Math.min(120, pixels)) * 0.0015);
    };
    const pinch = (event) => {
      if (event.touches.length !== 2) { pinchDistance = null; return; }
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDistance > 0 && distance > 0) changeFollowZoom(follow.current, Math.log(distance / pinchDistance));
      pinchDistance = distance;
    };
    const end = () => { pinchDistance = null; };
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('touchstart', pinch, { passive: false });
    canvas.addEventListener('touchmove', pinch, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    return () => {
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('touchstart', pinch);
      canvas.removeEventListener('touchmove', pinch);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    };
  }, [canvas, freeCamera, captureFocus, size.height]);
  useEffect(() => {
    if (!freeCamera) {
      if (camera.current && captureFocus !== "scene") {
        camera.current.zoom = Math.min(size.height, size.width * 1.8) / (captureFocus === "adiyogi" ? 62 : captureFocus === "scene" ? CAMERA_VIEW_HEIGHT : captureFocus === "foliage" ? 14 : captureFocus === "gate-detail" ? 10.8 : captureFocus === "gate" ? 21 : captureFocus === "boat" ? 7 : captureFocus.startsWith("traveler") ? 4.2 : 10);
        camera.current.updateProjectionMatrix();
      }
      return;
    }
    if (!orbit.current) return;
    const controls = orbit.current, view = camera.current;
    const baseZoom = Math.min(size.height, size.width) / MAP_FRAME.span;
    if (mapAction?.type === "in" || mapAction?.type === "out") {
      view.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom,
        view.zoom * (mapAction.type === "in" ? 1.3 : 1 / 1.3)));
    } else {
      const focus = mapAction?.type === "boat" ? boatState.current.position : new Vector3(MAP_FRAME.x, 0, MAP_FRAME.z);
      controls.target.copy(focus);
      view.position.copy(focus).add(new Vector3(...CAMERA_OFFSET).multiplyScalar(3));
      view.zoom = baseZoom;
    }
    view.updateProjectionMatrix();
    controls.update();
  }, [freeCamera, mapAction, size.width, size.height, boatState, captureFocus]);
  useFrame((_, delta) => {
    if (!camera.current) return;
    const creature = captureFocus === "scene" ? null : wildlifeRef?.current?.[captureFocus];
    if (freeCamera) {
      if (orbit.current) target.current.copy(orbit.current.target);
      wasFree.current = true;
      return;
    }
    if (wasFree.current) {
      follow.current.target.copy(target.current);
      follow.current.viewHeight = Math.min(size.height, size.width * 1.8) / camera.current.zoom;
      smoothedOffset.current.copy(camera.current.position).sub(target.current);
      wasFree.current = false;
    }
    const destination = captureFocus === "adiyogi"
      ? followPoint.current.set(ADIYOGI_ISLAND.x, 0, ADIYOGI_ISLAND.z)
      : captureFocus === "foliage"
      ? followPoint.current.set(-8.5, 3, ISLAND_CENTER_Z)
      : (captureFocus === "gate" || captureFocus === "gate-detail")
      ? followPoint.current.fromArray(captureFocus === "gate-detail" ? WORLD_MARKERS.gateDetailCamera : WORLD_MARKERS.gateCamera)
      : creature
      ? followPoint.current.set(creature.x, creature.y, creature.z)
      : journey?.current.mode !== "aboard" && journey?.current.position ? journey.current.position : boatState.current.position;
    const framed = captureFocus.startsWith("traveler") ? followPoint.current.set(destination.x, destination.y + 1, destination.z) : destination;
    if (captureFocus === 'scene') {
      const story = journey?.current;
      const aboard = !story || story.mode === 'aboard';
      const speed = aboard ? Math.abs(boatState.current.speed || 0) : Math.hypot(story.velocityX || 0, story.velocityZ || 0);
      const state = stepCameraFollow(follow.current, {
        position: framed, aboard, speed, resetId: boatState.current.resetId,
        reducedMotion: reducedMotion.current,
      }, delta);
      target.current.copy(state.target);
      camera.current.zoom = Math.min(size.height, size.width * 1.8) / state.viewHeight;
      camera.current.updateProjectionMatrix();
    } else target.current.lerp(framed, 1 - Math.exp(-delta * 3.5));
    offset.current.set(...(captureFocus === "foliage" ? [-10, 18, 16] : captureFocus === "gate-detail" ? [4.5, 5, 15] : captureFocus === "gate" ? [0, 8, 24] : CAMERA_OFFSET));
    if (captureFocus.startsWith("traveler")) {
      const heading = journey?.current.mode === "walking" ? journey.current.heading : boatState.current.heading;
      offset.current.set(-Math.sin(heading + (captureFocus === "traveler-back" ? Math.PI : captureFocus === "traveler-side" ? Math.PI / 2 : .22)) * 3, .975, -Math.cos(heading + (captureFocus === "traveler-back" ? Math.PI : captureFocus === "traveler-side" ? Math.PI / 2 : .22)) * 3);
    }
    const story = journey?.current;
    if (captureFocus === 'scene' && story?.mode === 'resting') {
      // View the resting spot from the sea side so the crown rock cannot hide it.
      offset.current.set(12, 14, -10);
    } else if (captureFocus === 'scene' && story?.released && story.releaseTime < 4 && !reducedMotion.current) {
      offset.current.multiplyScalar(1 + Math.sin(Math.PI * story.releaseTime / 4) * .07);
    }
    if(reducedMotion.current)smoothedOffset.current.copy(offset.current);
    else smoothedOffset.current.lerp(offset.current,1-Math.exp(-delta*3));
    camera.current.position.copy(target.current).add(smoothedOffset.current);
    camera.current.lookAt(target.current);
    camera.current.updateMatrixWorld();
  }, 0.5);
  return (
    <>
      <OrthographicCamera
        ref={camera}
        makeDefault
        position={[START.x + CAMERA_OFFSET[0], CAMERA_OFFSET[1], START.z + CAMERA_OFFSET[2]]}
        zoom={Math.min(size.height, size.width * 1.8) / (captureFocus === "adiyogi" ? 62 : captureFocus === "scene" ? CAMERA_VIEW_HEIGHT : captureFocus === "foliage" ? 14 : captureFocus === "gate-detail" ? 10.8 : captureFocus === "gate" ? 21 : captureFocus === "boat" ? 7 : captureFocus.startsWith("traveler") ? 4.2 : 10)}
        near={0.1}
        far={400}
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
          minZoom={Math.min(size.height, size.width) / 280}
          maxZoom={Math.min(size.height, size.width) / 6}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI * 0.45}
        />
      ) : null}
    </>
  );
}
