# Neem Point

Neem Point sits at (65, -48), halfway between Malai Vasal and Adiyogi. Its nominal footprint is 16 × 12 scene units. A gently sloping sandy beach and submerged shelf keep both channels open.

The island now uses Bruno Simon's actual oak tree asset at its original scale. The previous procedural neem tree has been removed at the user's request. The island name remains Neem Point. A timber bench, name sign, stepping stones, shoreline rocks and a patch of ground cover complete the clearing. The trunk and bench block walking. The shore supports landing, walking, boarding and save/restore. The map and field notes include Neem Point, and the debug capture selector frames it directly.

Tree sources: [Trees.js](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/Trees.js), [Foliage.js](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/Foliage.js), original oak GLB, palette and foliage SDF from revision 41046b57eeed8d156d9c3fd7fa259900baef7816. The original trunk geometry and six authored canopy anchors are retained. Foliage follows Bruno's 80-card clusters, outward normals, camera-facing orientation and oak colors. Materials use this project's lighting and wind clock. Asset provenance is in public/models/bruno-oak/README.md; the MIT notice is in public/licenses/bruno-simon-folio-2025.txt.

Terrain is shared by CPU navigation/physics and GPU water/shading. Generated shaders were regenerated after the shoreline change. Tests cover dry land, open channels, landing/walking/save/restore/boarding, prop collision and water samples around the new coast. The seabed regression hashes were updated for the added island; the existing 35-degree maximum-slope check still passes.

Visual verification remains pending: the available in-app browser reports no WebGPU or WebGL 2 support. In a compatible browser, open Debug tools → Neem Point to inspect the composition and wind animation.
