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
