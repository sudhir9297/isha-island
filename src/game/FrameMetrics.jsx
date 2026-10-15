import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import GpuFrameMetrics from "./GpuFrameMetrics.jsx";

import { createPerformanceWindow, recordFrame, summarizeFrames } from "./PerformanceWindow.js";

export default function FrameMetrics() {
  const elapsed = useRef(0),
    frames = useRef(0);
  const pending = useRef(false);
  const samples = useRef(createPerformanceWindow());
  useEffect(() => {
    const reset = () => { samples.current.count=0; samples.current.cursor=0; elapsed.current=0; frames.current=0; };
    document.addEventListener("visibilitychange",reset);
    window.addEventListener("port:reset-performance",reset);
    return () => { document.removeEventListener("visibilitychange",reset); window.removeEventListener("port:reset-performance",reset); };
  }, []);
  const gl = useThree((state) => state.gl);
  useFrame((_, delta) => {
    if (document.hidden) return;
    recordFrame(samples.current,delta);
    elapsed.current += delta;
    frames.current++;
    if (elapsed.current > 1) {
      const root = document.querySelector("main.app");
      if (root) {
        root.dataset.fps = String(Math.round(frames.current / elapsed.current));
        const summary=summarizeFrames(samples.current);
        if(summary)root.dataset.frameTiming=JSON.stringify(summary);
      }
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
        root.dataset.mainDrawCalls = String((gl.info.render.drawCalls ?? gl.info.render.calls));
        root.dataset.drawCalls = String((gl.info.render.drawCalls ?? gl.info.render.calls) + captureCalls);
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
