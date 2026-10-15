# Loading, authoring, sound and quality

These additions adapt ideas from Bruno Simon's folio-2025 to Port's existing WebGL/R3F scene. They do not replace the fixed lighting or palette.

## Startup

`SceneStartup` waits for the cached gate and traveler GLBs, allows three mounted frames for scene/material/camera setup, then waits for `WebGLRenderer.compileAsync`. The ocean/texture rendering happens behind the loading overlay. Gameplay stays paused until ready; hints start afterward. WebGL failure, a scene error, or a 45-second delay exposes a retry button. This prepares current materials; future boat/material variants can still require compilation when selected.

## Blender markers

Open `assets/port-gameplay-markers.blend` and choose **Port gameplay markers** in the scene selector. It is a compressed workspace copy containing the existing character scene as well; the original character file was not overwritten. The new scene contains ten named Empty objects. Their world positions were checked through Blender MCP against the runtime data.

- `ref_spawn`: boat start/reset X and Z; hull height still follows the water.
- `ref_gateEntry`, `ref_gateExit`: crossing thresholds, keeping the same doorway width. These are gameplay markers, not controls for moving the actual gate or terrain.
- `ref_gateCamera`, `ref_gateDetailCamera`: debug camera targets.
- `ref_luggageOrigin`, `ref_luggage0` through `ref_luggage3`: offsets for the four throws, relative to the player's release position. Landing height is sampled from terrain.

Coordinate conversion is Blender `(x, y, z)` to game `(x, z, -y)`, in game-world units. This template is separate from the scaled gate-source Blender model. Shore disembarking remains dynamically computed from the boat/hull and terrain, rather than forced to a fixed point.

Export with Blender's Python runner:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/port-gameplay-markers.blend --python scripts/blender_game_markers.py
node --test src/game/WorldMarkers.test.js src/game/JourneyState.test.js src/game/LuggageThrow.test.js
```

The export writes `src/game/world-markers.json` and does not save the source blend. Missing/nonfinite markers, reversed gate thresholds and luggage directions toward the far side are rejected. Runtime validation runs as well. Do not rotate the doorway markers: collision still uses an axis-aligned gate. `-- --create` builds a clean standalone template from the JSON in a background Blender process. Headless Blender crashed on this machine during this pass; the provided workspace copy was created through the working Blender MCP connection instead.

## Spatial sound

The existing sound toggle still controls all audio, with AudioContext creation/resume only on user gesture. A 10 Hz bridge places the listener at the player/boat, oriented with the camera's horizontal direction. Boat sound and wake share a distance-attenuated HRTF panner. Footsteps use their world location. Luggage gets one sand-impact sound per initial landing. Occasional synthesized bird calls come from a tree position. Surf fades by coastal proximity and becomes quieter after release. No external recordings or sound licenses were added. Listening and final volume tuning still need a working browser audio session.

## Auto quality

Settings now offer Auto, High and Balanced; selection is stored locally. Auto initially uses high quality, ignores the first four seconds after readiness, and evaluates six-second windows. Two slow windows (mean over 25 ms and more than 30% slow frames) select Balanced. Three windows with mean below 14 ms and fewer than 2% slow frames restore High. There is a 30-second cooldown after changes. Paused/hidden periods and invalid or very long frames reset evaluation. Manual modes bypass the adaptation. It controls the existing resolution/shadow/water-target presets, without changing color or lighting intensity.

## Story sequence

The gate release now shows a centered, responsive checkpoint reveal: “Leave your burdens behind.” It enters after the throw begins, holds, then fades by 7.5 seconds. A subtle camera pullback accompanies it. Reduced-motion preferences remove the scale, blur, and cinematic camera movement. Simulation time drives the reveal, including pause/resume.

Beyond the gate, a small marked overlook offers “Pause by the sea.” This completes the story with “Nothing left to carry.” Movement or the interaction button returns to exploration. Shore rings show boarding/disembarking locations; prompts adapt to touch, and nearby undiscovered places show their names.

Journey position, boat, landing, release and completion save locally every two seconds and on page hide. Resume validates terrain and recovery positions, restores settled luggage, and suppresses completed reveals. Return to harbour and boat changes retain story completion; Restart journey clears it. Storage failure does not block play.

Debug tools offer gate and overlook rehearsals. Rehearsals skip persistence and End rehearsal restores the prior journey. These controls are in the existing development-only tools.

## Verification

Full gameplay suite passed 134 tests before the final clock regression test; focused story/save checks and production build passed afterward. Browser rehearsal verified the actual gate crossing, centered reveal, and quiet-overlook interaction. Save serialization/validation is covered by tests; a complete browser reload of a completed real journey and audible sound mixing were not verified.

The earlier report of unavailable WebGL was incorrect: Canvas fallback text appeared in accessibility output while WebGL rendered normally. Removed the fallback component's erroneous startup-error side effect. Screenshots and live GPU diagnostics confirm successful rendering.

At 1280×720 in the local development browser, Auto stayed on High. One 600-frame sailing sample averaged 11.00 ms, p95 13.90 ms, max 20.60 ms, with no frames above 33 ms; GPU time was 5.29 ms. An overlook sample averaged 11.50 ms, p95 13.40 ms, with no frames above 33 ms; GPU time was 8.86 ms. These are local observations, not a before/after speedup or a mobile guarantee. The scene still submits about 700–760 draws and 2.4 million triangles including the underwater pass. The next performance target is the newer character export and repeated static geometry, based on these measured costs.

Asset audit still fails for the independently updated traveler GLB: 11.78 MB versus the 4 MB budget and 152,204 triangles versus 115,000. Gate budgets pass. No budgets were raised or character appearance changed to hide this warning. Build retains the large-main-chunk warning.

References: [PreRenderer](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/PreRenderer.js), [References](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/References.js), [Audio](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Audio.js), [Quality](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Quality.js). Implementations here are original adaptations for Port.
