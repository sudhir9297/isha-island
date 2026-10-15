# Port renderer

Reference: [Bruno Simon's 2025 portfolio Rendering.js](https://github.com/brunosimon/folio-2025/blob/41046b57eeed8d156d9c3fd7fa259900baef7816/sources/Game/Rendering.js) and its `Passes/cheapDOF.js`.

`src/game/rendering/createGameRenderer.js` initializes Three's `WebGPURenderer` asynchronously. WebGPU is preferred; Three falls back to WebGL 2 when unavailable. Both backends use the same node materials. High-performance power preference, conditional antialiasing, shadows, and a pixel ratio capped at 2 follow the reference. The existing canvas remains owned and resized by React Three Fiber.

`GameRendering.jsx` owns the only animation loop (`setAnimationLoop`). Fiber uses `frameloop="never"`; the renderer advances the existing camera, physics and simulation subscribers before drawing. Delta is capped at 1/30 second and hidden frames do not advance simulation. The render pipeline uses bloom (strength .25, threshold 1, smooth width 1) and, at high quality, Bruno's vertical edge-blur settings (start .2, end .5, amount .003, 25 samples). Balanced quality removes edge blur and uses DPR 1.

Port keeps its existing orthographic camera, Neutral tone mapping, exposure, and transparent-object depth sorting. Its water and layered effects depend on sorting. Tone mapping is applied to the composed scene so the ocean is not tone-mapped twice.

## Materials and underwater capture

WebGPURenderer does not execute legacy `ShaderMaterial` GLSL or `onBeforeCompile` patches. The ocean, seabed, foam, contact shadows and portals now use node materials. Wind, leaf lighting, shoreline wetting and the remaining custom surface colors use TSL nodes. The old lighting hooks remain as source/reference, but the active renderer uses their node equivalents.

The underwater pass uses a generic `RenderTarget` and a `ClippingGroup`. It restores visibility, clipping, alpha and shadow state after capture. Capture waits for the main pass to initialize or resize the sun shadow map before sampling it. Depth reconstruction accounts for WebGPU's 0–1 clip depth and WebGL's -1–1 clip depth. Render-target sampling converts the original GLSL bottom-left coordinates to TSL's top-left convention. Captured depth stays single-sampled across quality levels to keep shader bindings stable; canvas/scene antialiasing remains enabled where appropriate.

The existing procedural GLSL is retained as authoring source. Run `npm run shaders:generate` after editing it; generated TSL is committed under `src/game/rendering/generated`. The generator handles r186 transpiler limitations around numeric expressions, mutable local variables, texture references, Color uniforms and closures. No runtime code evaluation or shader transpilation is needed. Review and revalidate both backends when upgrading Three.

## Local verification

- `npm run dev`: normal WebGPU path.
- `http://localhost:5173/?backend=webgl`: force Three's WebGL 2 backend.
- Append `#inspector` in development for Three's inspector.
- The canvas `data-renderer` attribute reports the selected backend.
- Exercise Settings → Render quality, resize the viewport, and check water, shadows, foliage, portals and camera controls.
- `npm run build`, `npm run lint`, `npm test`.

The old WebGL timer-query profiler is disabled for the node renderer; use the development inspector for renderer diagnostics. Frame/draw statistics remain available.

Verified locally in Chrome: WebGPU startup and high/balanced quality transitions, forced WebGL 2 startup, and canvas resizing to 900×700 and back. Build succeeds; 179 gameplay tests pass. Lint reports one existing warning in `_ref/foliage-pixel-ray-audit-100.mjs`. The build retains the existing large-chunk warning.
