# Adiyogi island blockout

Added 15 October 2026. This is open ground for the next landmark; no statue, plinth, temple, or other architecture is included.

Isha's [Guinness announcement](https://isha.sadhguru.org/en/blog/article/second-guinness-world-record-isha-foundation) gives Adiyogi as 34.24 m high, 24.99 m wide and 44.90 m long. Those last two numbers use the record's axis terminology; use the actual model orientation when fitting the sculpture. Isha's [visitor guide](https://isha.sadhguru.org/en/blog/article/everything-you-need-to-know-about-the-isha-yoga-center-and-more) describes Malai Vasal's 235-ton crown boulder but provides no gate height. No verified gate dimensions were found, so a precise physical scale ratio is not claimed.

The current gate asset was normalized by an artistic 0.79 scale, not a documented survey calibration. For this blockout, provision approximately one scene unit per meter for Adiyogi, then revisit the final scale when the statue is supplied. The new island's nominal footprint is 60 × 44 units, compared with Malai Vasal island's 24 × 18: 2.5× the width, 2.44× the depth and roughly 6.1× the area. This is an artistic land allocation, not the real Adiyogi grounds' measured area. The center remains open; final foundation size and forecourt can be adjusted with the statue.

The provisional center is (130, -84), northeast of the existing island in world/map coordinates. Position and channel spacing serve the island map composition, not real campus geography. `AdiyogiTerrain.js` holds its footprint and terrain; the shared seabed feeds rendering, water optics and hull collision. Both shores support landing, walking, boarding, and local save/resume. Malai Vasal's gate and story remain on the original island.

The map shows both islands; “Explore both islands” frames the pair. Debug capture view “Adiyogi Island” frames the new land alone. The sailing radius is 200 units, and the camera/water/terrain extents include the second island. No new downloadable assets are needed.

Validation: 152 tests passed in the current working tree, including four new second-island integration tests. The water CPU/GPU comparison also covers the new coast and extended far-water taper. Production build passed with the existing chunk-size advisory; lint reports only the existing `_ref/foliage-pixel-ray-audit-100.mjs` warning. Browser overview visibly showed both islands with no console errors (one existing Three.Clock deprecation warning). A preview is saved as `adiyogi-island-preview.jpg`. This verifies the blockout and core interaction logic, not final statue fit or mobile performance.

Spacing follow-up: moved Adiyogi 20 units east and 12 units north at the user’s request, increasing center separation from about 63 to 86 units while retaining its size. Map framing and navigable terrain/water extents follow the new placement.

Second spacing revision: moved the island to (130, -84), making the center separation approximately 149 units (previously 86). The open-water gap is now roughly 110 units. Island dimensions remain 60 × 44.
