# Port

A small boat exploration game built with Vite, React, React Three Fiber, Three.js and Drei. It has a tropical harbor, submerged coral gardens, three selectable boats, schooling and reef fish, a manta ray, a shark, wind-blown foliage, and four places to discover.

## Run locally

Use Node.js 22.12+ or 24+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run preview` serves the production build after `npm run build`.

## Controls

- WASD or arrow keys accelerate, reverse and steer. Space brakes.
- Click open water to sail toward it. Manual steering cancels the destination.
- Touch steering controls appear on narrow screens.
- M opens the map. Escape closes a panel. Opening a panel pauses sailing.
- Settings offers boat selection, sea audio, a free orbit camera, render quality and a return to harbor. Changing boats returns to the starting position.

The Tide skiff is nimble, the Reef runner accelerates faster and has a wider turning arc, and the Harbour launch has a canopy and gentler handling. All three support forward, reverse, braking, drift, steering and click navigation.

Field notes are saved in the browser. Audio starts only when enabled. Fonts and scene assets are local.

## Implementation

`src/game/BoatPhysics.js` integrates forward and lateral velocity, hull contact with the shore and dock, and click navigation. It uses short substeps to keep handling consistent across refresh rates. Shared spawn, camera, boat scale and collision dimensions live in `src/game/WorldConfig.js`.

`src/game/Ocean.jsx` captures geometry between the sea surface and the shared seabed into a depth buffer, then renders depth tint, refraction, caustics, shoreline wash and sun shadows. Island and reef geometry is procedural. The boat emits fading foam and surface ripples.

`src/game/Seabed.js` supplies the physical sediment mesh, its GPU height field and matching triangle queries. Reef roots use that surface and the authored rock triangles. Surface foam is excluded from the underwater pass so it is rendered once.

`src/game/WildlifeSimulation.js` advances 44 animals in fixed substeps, with schooling, reef territories, manta gliding, shark patrols and avoidance. Animated geometry has measured shore, surface and seabed clearances. `src/game/Wind.js` deforms foliage around anchored roots and applies the same motion to its shadows.

## Checks

```sh
npm test
npm run lint
npm run build
```

The tests cover each boat's handling, hull contact, navigation, resets and frame-rate consistency, plus wildlife behavior and actual animated geometry bounds. Visual quality and browser behavior need separate runtime review.

## Reference and status

Historical reference videos and comparison captures were removed during repository cleanup. `_ref/` retains audit scripts and metadata; new local captures are ignored by Git.

The game is under active visual refinement. Passing the checks does not establish reference-level visual quality. Current review evidence and remaining gaps are recorded locally in `_ref/qa-status.json`.

## Malai Vasal island

The former cabin is replaced by the gate exported from `malaiVasal_detailed_day_v2.blend` on a raised central hill. Its stone pillars, asymmetric boulder lintel, gold finial, side entrances and forked ironwork retain the Blender geometry, consistent with the [official Isha reference](https://isha.sadhguru.org/en/blog/article/everything-you-need-to-know-about-the-isha-yoga-center-and-more). `MalaiVasalAsset.js` adapts the materials to the island: sage-gray boulder, warm limestone supports, muted sandstone masonry, green bronze ironwork and a satin brass finial. Baked stone textures provide restrained grain; the fine retaining net is hidden to avoid visual noise at game distance. The source Blender file and cached GLB remain unchanged. The dock opens onto a clear sandy approach, without paving, signs or display furniture. The side walls descend in straight, level masonry steps into dense trees. Only the buried footings extend to meet the slope; the wall courses and ironwork remain horizontal.

This pass builds the setting. Disembarking, walking collision and travel through the portal are not implemented yet. The game still uses sailing controls. For model review during development, open `/?debug`, expand **Debug tools**, and choose **Malai Vasal** in Capture view. Capture controls are hidden without the `debug` query parameter. Clip downloads work in debug mode; saving directly to `_ref/` is available only on the local development server.

The island art direction, research sources, geometry budget and verification notes are documented in [docs/island-art-direction.md](docs/island-art-direction.md).
