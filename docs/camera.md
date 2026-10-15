# Character-follow camera

Reference: Bruno Simon's [2025 View.js](https://github.com/brunosimon/folio-2025/blob/41046b57eeed8d156d9c3fd7fa259900baef7816/sources/Game/View.js), especially `setFocusPoint`, `setZoom`, and `update`.

The camera follows a smoothed focus point, with separately eased zoom and speed-dependent pullback. Port retains its orthographic projection and original viewing angle: walking input is aligned to that angle, and the ocean's optics assume an orthographic view. Bruno uses a 25-degree perspective camera; this implementation adapts his follow behavior rather than replacing Port's projection.

- On foot, the focus tracks the character's ground position with a 13-unit view height.
- Aboard, it tracks the boat with a 26-unit view height.
- Movement gradually adds up to 22% viewing room; the threshold is tuned separately for walking and boating.
- Wheel/trackpad scrolling and two-finger pinch adjust zoom within bounds. Zoom remains set when boarding or disembarking.
- The map/free camera retains its pan, rotate and zoom controls. Returning to follow starts from the map's current target, angle and zoom and eases back.
- A journey reset snaps focus to the respawn. Reduced motion removes follow lag and automatic speed zoom.

`src/game/CameraFollow.js` owns the tuning and deterministic follow calculations. Exponential damping makes the response independent of frame rate. `CameraRig.jsx` connects it to the character/boat and canvas input, retaining the authored capture views and resting viewpoint.

Frame ordering is explicit: simulation runs at priority 0, camera at 0.5, underwater capture at 0.75, final rendering at 1. The camera updates its world matrix before capture, so water and the visible scene use the same frame's camera pose.

Verification: `node --test src/game/CameraFollow.test.js` covers saved-position initialization, frame-rate independence, mode transitions, speed limits, respawn, zoom bounds, and reduced motion.
