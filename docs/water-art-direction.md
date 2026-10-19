# Water art direction

Port keeps its depth-based turquoise palette, wave normals, refraction and underwater lighting. The Bruno Simon reference informs the readability of shore movement and object contact rather than replacing that optical model.

- Two or three broken contour bands travel toward shallow water ahead of the existing swash. Their depth mask fades out before open water; screen derivatives soften narrow bands.
- Contact foam uses undistorted underwater capture depth and alpha to follow visible submerged object edges. The seabed has zero capture alpha and is excluded. This is a screen-space effect: hidden intersections cannot contribute.
- Underwater blur stays small in the first 0.35 units of optical path, then grows smoothly toward 2.8 units. Existing depth rejection prevents foreground colors from bleeding into submerged objects.
- Ocean animation and beach wetting use the shared wind clock, so they freeze together on pause and reduced motion. Foam drift and the solar highlight orientation use the wind direction. Surface roughness responds subtly to the same travelling gust pattern and weather strength used by vegetation.

Edit `src/game/rendering/sources/ocean.js` and `src/game/WaterOptics.js`, then run `npm run shaders:generate`. Generated TSL files are checked in. Keep wave geometry and wet-sand sampling on the same clock.

Verification: inspect Malai Vasal's beach and dock in the debug capture view; check that the bands break up, submerged reef edges remain clear, foam does not cover the seafloor, and pause freezes water and wet sand together. Repeat at balanced quality, where the underwater capture has a lower resolution.
