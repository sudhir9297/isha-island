import { useEffect, useRef } from "react";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";

// Opt-in development profiling includes the underwater and main render passes.
// GPU results are polled asynchronously; recording/encoding is outside the query.
export default function GpuFrameMetrics() {
  const renderer = useThree(state => state.gl);
  const timer = useRef(null);
  useEffect(() => {
    if (renderer.isWebGPURenderer) {
      const root = document.querySelector('main.app');
      if (root) root.dataset.gpuTiming = 'unavailable';
      return;
    }
    const context = renderer.getContext();
    const extension = context.getExtension("EXT_disjoint_timer_query_webgl2");
    const root = document.querySelector("main.app");
    if (root) root.dataset.gpuTiming = extension ? "available" : "unavailable";
    if (!extension) return;
    const state = { context, extension, active: null, queue: [], gpu: [], cpu: [], frame: 0, start: 0 };
    timer.current = state;
    const remove = addAfterEffect(() => {
      if (state.active) {
        context.endQuery(extension.TIME_ELAPSED_EXT);
        state.queue.push(state.active);
        state.active = null;
        state.cpu.push(performance.now() - state.start);
        if (state.cpu.length > 30) state.cpu.shift();
      }
      if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
        state.queue.forEach(query => context.deleteQuery(query));
        state.queue.length = 0;
        state.gpu.length = 0;
      }
      while (state.queue.length && context.getQueryParameter(state.queue[0], context.QUERY_RESULT_AVAILABLE)) {
        const query = state.queue.shift();
        state.gpu.push(context.getQueryParameter(query, context.QUERY_RESULT) / 1e6);
        context.deleteQuery(query);
        if (state.gpu.length > 30) state.gpu.shift();
      }
      if (root && state.gpu.length) {
        root.dataset.gpuFrameMs = (state.gpu.reduce((sum, ms) => sum + ms, 0) / state.gpu.length).toFixed(3);
        root.dataset.cpuRenderMs = (state.cpu.reduce((sum, ms) => sum + ms, 0) / state.cpu.length).toFixed(3);
        root.dataset.gpuSamples = String(state.gpu.length);
      }
    });
    return () => {
      remove();
      if (state.active) { context.endQuery(extension.TIME_ELAPSED_EXT); context.deleteQuery(state.active); }
      state.queue.forEach(query => context.deleteQuery(query));
      timer.current = null;
    };
  }, [renderer]);
  useFrame(() => {
    const state = timer.current;
    if (!state || state.context.isContextLost() || ++state.frame % 4 || state.queue.length >= 8) return;
    state.active = state.context.createQuery();
    state.start = performance.now();
    state.context.beginQuery(state.extension.TIME_ELAPSED_EXT, state.active);
  }, -100);
  return null;
}
