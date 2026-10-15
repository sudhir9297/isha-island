# Asset and performance workflow

Keep editable Blender projects in `assets/`; export GLBs into `public/models/` using the existing character/gate scripts. After a gate export, run `npm run assets:compress`, then run `npm run assets:check` after each export. This performs a metadata audit followed by the actual gate-placement and character-skeleton/animation tests. It does not modify source models or repair a failing export silently.

`npm run assets:audit` writes `reports/assets.json` with hashes, sizes, triangle counts, material/primitive counts, and a per-mesh breakdown. It exits unsuccessfully on missing names or exceeded budgets. Budgets in `scripts/asset-budgets.json` are regression ceilings for the current art, not recommended final optimization targets. Raw Blender bone names include dots; the loader sanitizes them, and the runtime tests verify that conversion. The character ceiling allows the concurrent 3.85 MB / 113,398-triangle export observed on October 15; the latest validated revision is 2.98 MB / 83,220 triangles. Tighten the ceiling when character modeling settles.

## Repeatable performance capture

Open `/?debug&gpu`, expand Debug tools, and select a view. Let loading settle, click **Reset performance sample**, run the same route or hold the same viewpoint for at least 15 seconds, then **Download performance snapshot**. Repeat for Scene, Gate details, Traveler portrait, and Trees and wind, at both quality settings and an identical viewport. Do not record video during a timing sample.

Reports include up to 600 recent frame intervals, mean/p95/worst frame time, intervals above 33.33 ms, main/underwater draw and triangle counts, resource counts, quality, and GPU timing when the device supports it. Background-tab changes clear the timing window. GPU numbers are rolling samples and may not cover precisely the same period as the frame window. Counts do not separately measure shadow passes. A static snapshot is not a sustained-device benchmark.

## Implemented memory optimization

The gate now shares immutable boulder, support and finial geometry with the GLTF cache. Wings retain private geometry because placement modifies their vertices. Material clones are cached per source material within an instance. Disposal frees only instance-owned buffers/materials and is safe to call twice. Textures remain owned by the loader cache. No topology, color, lighting, or silhouette changed.

## Next asset changes

Use report mesh breakdowns to choose geometry simplification candidates, then compare silhouettes and shadows at fixed viewpoints before shipping. Keep skeletons, corrective morph targets and animation clips intact. The gate now uses a separate Meshopt-compressed output; geometry simplification remains a separate decision. KTX2 is relevant to the gate's embedded images; the current character has no textures. Automatic quality changes are not enabled.

## Gate compression

`npm run assets:compress` preserves the original `malai-vasal-day-v2.glb` and writes `malai-vasal-day-v2-compressed.glb`, which the game loads using Drei’s bundled Meshopt decoder. It validates the candidate before writing. No quantization, mesh simplification or texture conversion is applied. The current file shrinks from 11,424,268 to 7,406,272 bytes (35.2%). This reduces transfer size, not triangle count or steady-state GPU memory.

`npm run assets:check` decodes the shipped candidate with the same decoder exported by three-stdlib for Drei. It compares geometry attributes, texture bytes, materials and scene structure against the current source; stale outputs fail. Meshopt can cyclically rotate triangle indices, so the comparison canonicalizes that rotation while preserving winding and triangle order. A negative test confirms changed geometry is rejected. Re-run compression after every gate export and include both GLBs when sharing changes.

## Moving wildlife culling

The six small-fish instance batches (body and tail for three species) now refresh their aggregate bounding spheres after transforms and allow normal camera-frustum culling in both scene passes. Instance matrices use dynamic GPU-buffer usage. Swimming continues off-screen. Fully off-screen batches can skip up to six draw calls per pass; partial schools still render as a batch. This is a rendering-work reduction, not a measured FPS guarantee. The deformed manta and shark retain their existing culling behavior.

`node --test src/game/MovingInstances.test.js src/game/WildlifeSimulation.test.js` checks off-screen rejection, re-entry, transformed geometry containment, and wildlife behavior. For a device comparison, use the same camera route and performance-capture workflow above. The automated browser reported WebGL unavailable during this pass, so live rendering/FPS was not verified there.

## Active boat-wake instances

The wake retains its 300-slot simulation pool but packs only live particles into its instance buffers, preserving pool order for transparent blending. Expired particles no longer compose matrices or occupy rendered instances. Dynamic buffers upload only the active prefix (72 bytes per live particle across transform, fade and seed); the previous full upload was 21,600 bytes per frame. With no live particles, draw count is zero and no wake-buffer update is requested. Emission timing, motion, ocean sampling and the hull contact sheet remain unchanged.

`node --test src/game/WakeInstances.test.js` covers expiry, reset/reuse, ordering, shrinking and growing active buffers, and idle uploads. Production build and boat behavior tests also pass. This is a verified reduction in submitted instances and requested buffer updates; live-device FPS and visual comparison remain unmeasured.

## Opt-in diagnostics

Normal play no longer mounts the frame collector or performs underwater-pass DOM metric writes. `?debug`, `?gpu`, and `?capture` explicitly enable metrics; unrelated query values do not. The capture UI and frame collector load as separate chunks only when needed, with local Suspense boundaries so they do not delay the scene. Debug capture tools remain accessible with `?debug`; GPU timer queries retain their development-only restriction. Frame summaries also work in production preview when diagnostics are requested.

This removes diagnostic work from ordinary play and modestly reduces its initial script payload. It does not address the large core Three.js/game bundle. Run `node --test src/game/Diagnostics.test.js src/game/PerformanceWindow.test.js` and `npm run build` after changing these entry points.

## Stable UI telemetry

Boat telemetry and traveler status keep their existing sampling intervals but reuse the previous React state object when displayed values are identical. This avoids telemetry-driven parent rerenders during stable idle/paused play. Movement and beach recovery timestamps retain full precision. The relief message's UI timestamp stops at eight seconds, when the message disappears; the simulation's release clock keeps running. The unused cloned boat-position vector was removed from telemetry. Audio updates still run at the original sampling interval, independently of UI equality.

`node --test src/game/JourneyTelemetry.test.js src/game/JourneyState.test.js` verifies stable samples, all displayed boat fields, boarding/recovery state, message boundaries and reset. This is an update/allocation reduction, not a measured frame-rate gain.
