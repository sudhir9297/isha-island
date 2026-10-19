# Performance reference audit

Source inspection, 2026-10-19. These are code findings, not measured FPS gains or a phone benchmark. No rendering behavior changed in this audit.

## Reference techniques verified

- Madbox: `_ref/madbox/files/madbox.io/_nuxt/22c4744.js` disables shadow maps and bypasses the post-process composer unless `drawBlur` is active. `564c057.js` applies baked or matcap materials and caps pixel ratio at 2.
- Kode Clubs: saved `App.bundle.js` defaults bloom to disabled and gates individual composer passes. Renderer has a prerender path. Do not infer actual runtime draw costs from bundled library classes.
- Bruno Simon: `sources/Game/Quality.js` starts mobile at low quality; `Ligthing.js` uses 2048/512 shadow maps; `World/WaterSurface.js` switches blurred water to base shading on low quality. `InstancedGroup.js`, foliage and flowers use instancing. `Viewport.js` caps DPR at 2. `Game.js` has a high-quality WebGPU prerender branch.
- Coastal World: saved `webgl.3250e36a65453426.js` has renderer resolution/pixel-ratio adjustment with a pixel-budget constraint and merges character component geometries. This is not proof of automatic frame-time adaptation.
- Susurrus: saved `Experience-BFideLo3.js` selects reflection resolution 128 on mobile versus 254 otherwise, and Kuwahara radius 1 versus 2. Interactive bread physics runs at 1/30 and retained objects are capped at 32.

## Port findings and proposed order

1. Correct measurement first. `GameRendering.jsx` caps time at 1/30 before `advance`; `FrameMetrics.jsx` and AutoQuality receive this simulated delta. Real frame times worse than 33.3ms are hidden. Keep simulation safety separate from wall-clock telemetry. AutoQuality also resets whenever a panel is open, including the animated map. Its initial downgrade requires four seconds warmup plus two six-second bad windows, measured in this capped time.
2. Reduce geometry cost. Ocean's 639-by-639 vertex grid submits 814,088 triangles. Seabed's 829-by-529 grid submits 874,368 triangles in the underwater depth capture, before reef, island, shadows and post-processing. These are topology counts, not live GPU timings. Use tiled meshes with distance-dependent tessellation and frustum culling; preserve shoreline accuracy and retain the independent seabed data texture for water optics. Start with coarser geometry offshore and in overview.
3. Add a genuinely cheap render tier. High currently permits DPR 2, 2048 shadows, 900px underwater capture, bloom and 25-sample edge blur. Balanced uses DPR 1, 1024 shadows and 560px capture but retains bloom and the same dense geometry. Start constrained/mobile devices conservatively, then adapt from real timings. DPR 2 to 1 halves both dimensions (75% fewer output pixels), not a guaranteed 4x FPS gain.
4. Make underwater capture selective. It rerenders every frame at priority .75. Use a dedicated capture layer/list, lower mobile resolution, and simplify reef/wildlife at overview scale. Do not blindly skip capture frames while the camera moves: projection/depth must match to prevent swimming artifacts.
5. Reduce shadow and draw overhead. Bake static island contact shading, reserve dynamic shadows for nearby moving subjects, and test 512px low-tier shadows. Reef already uses instancing; focus further batching on compatible repeated palm/flower materials, preserving spatial culling and wind variation.
6. Separate camera feel from rendering. Follow zoom already uses exponential smoothing (rate 5), but clamped elapsed time stretches animation under poor FPS. Diagnose real frame times first; more easing cannot repair missed frames. Warm camera/quality shader variants if profiling shows first-use stalls.

## Validation plan

Use a production build on the same device/backend/viewport: stationary Malai Vasal, repeated wheel/pinch zoom, overview open/rotate/close, and open-sea sailing. Record real p50/p95/p99 frame time, long frames, draw calls and GPU timings where supported. Compare each change independently. Target 16.7ms at 60Hz; use a stable 33.3ms low tier if the tested phone cannot sustain 60. Test actual iOS Safari and Android Chrome; desktop viewport emulation is not a thermal or mobile GPU benchmark. Check color, shoreline alignment, palm motion and shadow stability alongside performance.

## Rollback

The performance pass was reverted after the user reported worse FPS. The earlier rendering pipeline, water/seabed geometry, shadow updates, palm meshes, quality settings and diagnostics have been restored. The color and map UI improvements remain. The proposed optimizations above are research only, not active implementation. Future changes need isolated before/after measurements before being retained.
