# Wind

Port adapts the shared wind direction and two moving noise layers from Bruno Simon's [folio-2025 wind system](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Wind.js), plus the four pooled, tapered curves in [WindLines](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/WindLines.js). Reviewed reference commit: `41046b57eeed8d156d9c3fd7fa259900baef7816`. Bruno's MIT notice is retained in `public/licenses/bruno-simon-folio-2025.txt`.

`WindSystem.jsx` owns a shared time, direction and strength for each scene. `WindField.js` holds the defaults: angle 0.6π, strength 0.55, four trails, and 4.7-second lifetimes. Pausing freezes the wind clock and trail pool. Reduced motion disables trails and vegetation displacement. Resuming after a background-tab delay cannot advance the wind by more than 0.05 seconds in one frame.

Vegetation samples two smooth, travelling procedural noise layers rather than loading Bruno's Perlin texture. Existing anchored roots, leaf-tip flutter, leaf twist, corrected normals and shadow deformation remain. The GLSL source lives in `Wind.js`; regenerate the WebGPU/WebGL-compatible TSL factories with `npm run shaders:generate` after edits.

`WindLines.jsx` draws four reusable 30-segment curves near the boat or walking character. A pulse tapers both ends and travels along each curve, which also drifts in the wind direction. Width faces the camera. Curves spawn above terrain/water, retain depth testing, and draw after the transparent ocean. The underwater capture excludes them through the existing `seaSurfaceOnly` flag. Map and asset-review views hide them. All geometry/materials are disposed on unmount; no recurring timers, animation dependencies or per-frame geometry allocations are added.

Tests cover pause/reduced-motion timing, resume clamping, ribbon endpoints and pulse direction, focus-relative spawning, terrain clearance, and bounded pool reuse. Visual checks cover water visibility and scene startup. The wind is atmospheric; it does not change boat steering or physics.

## Cloth, leaves, sound and weather

`Atmosphere.js` defines a 180-second cycle from sunny/calm to soft overcast/breezy and back. Wind strength moves between 0.28 and 0.72; sunlight falls from 3.2 to 2.15 and cools slightly. Ocean lighting receives the same changing sun radiance. This is a lighting transition, without rain or storm effects. The cycle freezes with pause or reduced motion.

`WindCloth.jsx` replaces the old independent boat-flag sine wave. Flag artwork is vertex-colored so it deforms with the fabric, including its emblem. The mast edge stays fixed. Three hanging dock pennants keep their top edges fixed. The launch canopy has small interior ripples and fixed perimeter vertices. Cloth follows the shared time and strength, and the flags use the wind direction in their local orientation.

`DriftingLeaves` uses one instanced draw with a reusable pool of 18 leaves. Leaves spawn near actual main-island canopy locations within 23 units of the player, drift downward with the breeze, then disappear at the ground or the end of their lifetime. No leaves spawn in open sea. Map/asset inspection and reduced motion hide the effect.

Low foliage uses a world-space walking-character influence. Blades within 1.3 units bend away from the feet and recover smoothly as the character moves away. Anchors remain fixed; trees, boarding, resting and jumps do not trigger the reaction. The same shader deformation supplies surface normals and shadows.

`WindAudio.js` synthesizes a quiet loop at runtime and routes it through a low-passed air source and fixed spatial tree-rustle sources. Wind follows weather strength and local gusts. A smooth shelter region behind the gate reduces both layers. The existing sound switch controls it; no sound is started without that user action. Wind audio fades during pause and all sources stop when the audio context is disposed. Reduced motion freezes visual movement but does not disable sound.

Tests cover the weather cycle and bounds, spatial gust continuity, cloth attachment edges, grass interaction modes, leaf-pool expiry/reuse, audio distance and shelter responses, and loop seam continuity.

### Cloth refinement

Flags now ease into changing airflow and include the apparent breeze caused by boat travel. Ripples arrive later at the loose edges; mild width contraction prevents a strongly billowing flag from stretching sideways. Hanging pennants have split tips, darker hems and subtle woven color variation. The launch canopy is pinned at its two crossbars as well as the perimeter. Paused cloth skips buffer/normal updates; reduced motion resets the force to zero. `ClothMotion.test.js` checks attachment points, frame-rate independence, force limits and canopy supports.
