# Sailing directions

While aboard, three small arrows point toward Malai Vasal, Neem Point and Adiyogi, without visible names. They appear only when no island is in the camera view. If any island’s above-water geometry intersects the view, all arrows hide together. Each arrow points directly at its island's projected center. The indicators are bearings, not automatic routes through obstacles.

The implementation follows the player-centered circle pattern described in [OnScreenPointer](https://github.com/mubasharUnity/OnScreenPointer) and the destination arrow conventions in [Compass Navigator](https://kronnect.com/docs/compass-4/indicator-settings/). No external package or copied source is used.

`IslandDirections.js` gets island centers from the existing terrain configuration and lays labels out around the projected boat. Nearby bearings are separated around the ring; each arrow's orientation is recalculated from its final marker position toward its real target. Positions stay within the viewport. `IslandDirectionTracking` projects through the active camera after CameraRig at frame priority 0.7 and updates DOM transforms without React state updates per frame.

The overlay does not intercept mouse/touch events. It is hidden during loading, the opening reveal, menus, free camera, debug capture views and on-foot gameplay. No pulsing or additional camera animation is introduced.

Regression tests cover collinear destinations, correct pointer angles after layout, phone viewport bounds and overlap, and coincident target handling. Browser review should verify sailing, zoom, the menu visibility gate and narrow screens.

`IslandVisibility.js` caches bounds of the tagged islands’ above-water meshes, including the gate, dock and trees. Every frame the active camera frustum is tested against those bounds, so a partially visible island or a zoom change suppresses the entire arrow overlay. Underwater-only geometry does not count.
