import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import GpuFrameMetrics from "./GpuFrameMetrics.jsx";

export default function FrameMetrics() {
  const elapsed = useRef(0),
    frames = useRef(0);
  const pending = useRef(false);
  const gl = useThree((state) => state.gl);
  useFrame((_, delta) => {
    elapsed.current += delta;
    frames.current++;
    if (elapsed.current > 1) {
      const root = document.querySelector("main.app");
      if (root)
        root.dataset.fps = String(Math.round(frames.current / elapsed.current));
      pending.current = true;
      elapsed.current = 0;
      frames.current = 0;
    }
  });
  useEffect(
    () =>
      addAfterEffect(() => {
        if (!pending.current) return;
        pending.current = false;
        const root = document.querySelector("main.app");
        if (!root) return;
        const captureCalls = Number(root.dataset.captureDrawCalls || 0);
        root.dataset.underwaterDrawCalls = String(captureCalls);
        root.dataset.mainDrawCalls = String(gl.info.render.calls);
        root.dataset.drawCalls = String(gl.info.render.calls + captureCalls);
        const captureTriangles = Number(root.dataset.captureTriangles || 0);
        root.dataset.mainTriangles = String(gl.info.render.triangles);
        root.dataset.underwaterTriangles = String(captureTriangles);
        root.dataset.triangles = String(gl.info.render.triangles + captureTriangles);
        root.dataset.geometries = String(gl.info.memory.geometries);
        root.dataset.textures = String(gl.info.memory.textures);
        root.dataset.shaderPrograms = String(gl.info.programs?.length || 0);
      }),
    [gl],
  );
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has("gpu") ? <GpuFrameMetrics /> : null;
}
