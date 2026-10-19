# Tropical sanctuary island

The island is a small stylized coastal sanctuary with a broad sandy landing and Malai Vasal as its landmark. This is an art-directed coastal setting, not a geographically exact reconstruction or a claim that all islands have the same ecology.

## Research translated into the scene

- [National Park Service: dune communities](https://www.nps.gov/guis/learn/nature/dune-communities.htm): use a progression from bare shore to low vegetation and sheltered inland growth. Planting occupies irregular pockets instead of an even decorative border.
- [Tobias Koepp / Epic: creating a stylized world](https://www.unrealengine.com/tech-blog/creating-a-stylized-world-with-unreal-engine-4): emphasize recognizable silhouettes, modular organic assets, simple material treatments and a landmark that guides the player. The gate remains recognizable; the open sand remains free of road markings, furniture and signs.
- [Tony Theng: stylized tropical island](https://tonytheng.artstation.com/projects/982q1R): reference for a unified tropical environment assembled from reusable vegetation and rock forms. No third-party assets were copied.
- [Three.js: optimizing lots of objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html): combine repeated static detail to control scene overhead.

## Palette and composition

Ivory sand (#efdfbd), damp sand (#d9cbaa), jade and sage foliage, warm pale stone (#d0cbb3), gray-green outcrops (#a2ad99), muted sandstone masonry, dark green metal, satin brass and sparse peach/coral flowers. These colors are an artistic choice for this game, not a universal island palette.

The central ground is lowered from 3.05 to 2.35 scene units. Unequal dune shoulders retain a level gate foundation and meet the existing shoreline. Ground-cover color is part of the existing terrain vertex colors. Small dune grasses, trailing wall leaves and clustered outcrops connect the architecture with its setting. Side walls retain their straight stepped profile.

## Rendering budget

Grass and wall leaves share one opaque mesh; outcrops share one more. Neither uses transparency textures or per-blade animation. The grass receives shadows but does not cast them. Terrain color adds no draw calls. Palm frond rows drop from 41 to 25, and other leaf steps from 20 to 12. Standard foliage materials replace clearcoat materials, and two redundant grove trees and their beds are removed. No new lights, postprocessing or texture downloads are added.

## Verification — 13 October 2026

79 tests pass, lint is clean, and the production build succeeds (existing large-chunk advisory remains). No browser console errors during visual review. The local in-app browser at 1200×800, default high quality, showed 92 FPS in a gate-view snapshot and 96 FPS in a gameplay-view snapshot after reload. These are brief local observations, not a controlled benchmark or a mobile performance guarantee. Main-pass triangles were approximately 1.30 million in the gate view and 1.25 million in the gameplay view; these include the rest of the game. Camera culling, wildlife and ocean capture make counts vary.

## Composition follow-up

Repositioned the existing six background trees into a staggered grove behind the opening. Left-side planting is taller and fuller; right-side planting is lower. Baked localized pillar, plant and rock contact shading into the sand color texture. Increased broad dune asymmetry without moving the physical coast; the wet-material margin now has a subtle irregular boundary alongside the existing animated swash. Cooler fill and lighter shadow strength reveal sand detail. Six shoreward planks extend the existing merged dock mesh into the sand. High-quality device pixel ratio is capped at 1.5 rather than 2 to reduce fill cost while retaining antialiasing. Focused geometry tests and lint pass; build succeeds. Local gameplay FPS sampled at 65 after the pixel-ratio change, compared with a prior 51 snapshot at 2x; this is not a controlled benchmark.

## Shoreline foam follow-up

The water shader now renders a broken white swash crest moving across actual shallow-water depth, with locally offset arrival phases, filtered edges and sparse dissolving flecks behind the crest. The former 18% opacity ceiling made the foam nearly invisible; the crest now reaches up to 82% locally, with gaps and tapered coverage. The cycle is approximately 6.6 seconds. This changes surface appearance only: existing wave geometry, buoyancy and animated sand wetting remain intact. No particles, textures or additional draw calls are introduced. The 13 water-optics tests, lint and production build pass.

## Boat beaching
Fast coastal contact (over 2.8 world units/s) now preserves planar momentum instead of applying the old ellipse barrier. The hull follows the sand slope; uphill work, sand friction, and decaying yaw bring it to rest. Propulsion is disabled while grounded. Dock and reef contacts remain solid. Grounding starts a five-second simulation-time recovery timer, and R or Reset to water restores the last clear-water position with velocity and navigation cleared. Pausing freezes the timer. No new render passes or geometry are required.

## Traveler and luggage refinement
Travel silhouettes reference Osprey's Farpoint 40 travel pack (https://www.osprey.com/farpointtm-40-travel-pack-1), Away's carry-on (https://www.awaytravel.com/products/carry-on-jet-black), and weekender duffels (https://www.awaytravel.com/collections/duffle-bags). The scene uses original unbranded procedural models: terracotta ribbed carry-on, sage backpack with compression straps and bottle pocket, ochre canvas duffel, and small indigo satchel. Hand luggage follows the articulated hands; backpack and satchel follow the torso. Gait blends actual traveled distance with knee flexion, shoulder sway, smooth turning and start/stop easing. No downloaded models or textures were added.

## Dock approach planting — 19 October 2026

The arrival clearing now follows the shore end of the dock into the central gate entrance. `IslandHabitat.js` supplies one soft planting exclusion shared by the sand's ground-cover color, grass generation, and procedural beds. It keeps a two-unit-wide bare center with feathered edges; it does not add a paved path or alter terrain heights.

The right-hand bed moves toward the wall shoulder, the harbor flowers become a smaller cluster beside the dock, and the left bed and one loose rock regroup toward the western planting. Existing palms, the gate, shore, and rear passage remain. Grounding textures use the same authored bed positions. No downloaded Coastal World assets are used.

The habitat test samples the intended route from the actual dock landing, including lateral room for luggage, and checks both bare cover and walkable terrain. Visual review uses the Malai Vasal capture view and dock rehearsal.

## Sanctuary lighting and palette — 19 October 2026

Applied the Kode Clubs / Madbox reference study to Port's existing scene. Shared daylight and water colors live in `ArtDirection.js`: cream sky fill, pale blue ground fill, warm sunlight, jade/turquoise water and a deeper blue offshore. The sunlight is less dominant and directional shadows are lighter, while existing baked ground contacts are tighter and slightly stronger. The walking traveler has a small feathered contact shadow that hides aboard and during jumps.

The sand is ivory rather than yellow, foliage uses related sage/jade families, and outcrops use gray-green stone. Neem ground cover and the oak palette follow the same family. Gate stone keeps its existing baked texture but has reduced contrast and bump strength; brick and brass remain restrained warm accents. Dock grain is quieter and rougher. Boat reflections use the same cream-sky/turquoise-water direction.

The dock-to-gate planting exclusion is slightly wider, preserving the entrance as the focal point without changing terrain or collision. Bloom is reduced and its threshold raised; edge blur is weaker and starts farther from the center. Existing wave, shore-foam, refraction and wet-sand behavior are preserved. No reference assets were imported. Static grounding reuses the existing generated textures rather than adding a screen-space occlusion pass.

Validation: 225 tests passed after the main pass, plus lint and production build. Browser review confirmed the palette, shoreline, foliage and traveler under the new lighting. This was a visual review, not a device performance benchmark.

## Richer Malai Vasal palette

The saved Madbox scene bundle (`_ref/madbox/files/madbox.io/_nuxt/564c057.js`) routes scene assets through baked textures or matcap materials in `applyMaterials`. It also exposes a focus blur strength. This supports an asset-led color approach; the inspected scene code does not establish a saturation/bloom grade as the source of its colorful look.

Malai Vasal now uses stronger emerald and lime foliage, orange flower accents, and golden sand. Shared hemisphere fill is reduced from 1.05 to 0.75, sunlight from 2.7 to 2.25, and shadow intensity increases from 0.58 to 0.65 to preserve form and pigment. Bloom strength drops from 0.12 to 0.06 with threshold raised to 1.35. Neutral tone mapping and exposure 1 remain unchanged. Shared lighting, sand and post-processing also affect other islands; foliage edits are in the main island component. No reference textures are copied.

Validation: lint and production build pass; inspect the focused Malai Vasal map view for palette and highlight balance.

## Illustrated tropical palette

The October 19 reference image guides this color pass: saturated blue offshore water, mint shallows, cream sand, yellow-green foliage, warm stone and orange-brown timber. The shared ocean/daylight palette lives in `ArtDirection.js`; sand and underwater sand stay paired through `ISLAND_SAND_PALETTE` in `Seabed.js`. Malai Vasal planting, gate stone and dock wood carry the coordinated land colors. Shared ocean and daylight changes also affect the other islands.

Use the Malai Vasal capture view to judge color separation at gameplay scale. Keep highlights below white and retain dark leaf undersides and contact shadows. This pass adjusts materials and lighting; it does not replace the reference's painted texture work or rock silhouettes.

The follow-up daylight adjustment lifts hemisphere fill to 1.4, uses a pale ground-bounce tint, and reduces cast-shadow intensity to 0.56. Weather now dims sunlight by at most 18%, keeping the illustrated palette readable through the cloud cycle. Exposure stays at 1 to preserve the ocean and highlight calibration.

## Illustrated surface follow-up

Sand now uses a broad, subtle pigment wash with reduced fine grain and ripple relief. Ground cover varies between fresh green and yellow-green using island-local coordinates, while retaining the habitat mask that clears the dock approach, gate passage and shore. Coastal outcrop faces use warm cream upper planes and muted lavender undersides instead of random per-vertex brightness. The brighter daylight remains unchanged. These adjustments reuse existing generated textures and vertex colors, with no additional draw calls or downloaded assets.

Validation: lint, production build and focused habitat/gate asset tests pass. Reviewed the Malai Vasal view in the local browser. Existing large-bundle build advisory remains.

## Fuller foliage with a smaller geometry budget

Palm fronds are broader, more arched and more distinctly folded, with brighter tip/midrib pigment. Existing broadleaf leaves gain width and curvature. Crown leaf counts, merged meshes, materials and wind behavior are unchanged. Palm subdivision drops from 37×7 to 29×5 per half: 448 triangles per frond instead of 864 (48% fewer). Wider leaves may still cover more pixels, so this is a geometry saving rather than an equivalent FPS promise.

Validation: lint and build pass; 30 procedural frond seeds have finite positions, normals, pigments and wind attributes within the 448-triangle budget. Browser review preserves the open gate approach. A short local Malai Vasal sample reported 88 FPS, 11.59 ms mean frame time, 16.9 ms p95 and no frames above 33 ms across 345 frames. This is a local observation, not a before/after benchmark or mobile guarantee. Preview: `_ref/fuller-palm-crowns.jpg`.

## Walking collisions

Solid scenery meshes opt into `userData.walkingSolid`: palm/broadleaf trunks, the oak wood, coastal and loose rocks, dock posts, Neem furniture/signs/rocks and overlook stones. `WalkingObstacles.js` builds a world-space triangle grid when the mounted solid mesh set changes; walking queries only nearby cells. The traveler has a 0.3-unit clearance radius and body-height checks, with substeps capped at 0.1 units and tangential sliding. Existing gate, seat, boat and shoreline rules remain active. Grass, foliage, floating interaction markers and effects are not solid walls. New solid props must opt into the same flag. Static collision geometry follows authored transforms rather than shader wind motion.

Regression checks cover transformed solids, overhead clearance, narrow-obstacle tunnelling, sliding and open gaps. The overlook regression now permits sliding while still asserting that the player cannot enter the seat.
