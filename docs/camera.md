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

## Malai Vasal arrival framing

The first visit uses a local framing adjustment on the sea-facing approach to Malai Vasal. The follow target shifts partway toward the gate and the walking view widens according to distance, up to 28 units at the dock. Sailing receives a smaller adjustment. The existing damping eases both focus and zoom; the viewing angle and wheel/pinch zoom remain unchanged.

The adjustment fades out before the doorway and outside the main island's arrival region. It is disabled after luggage release and in resting, map, and capture views. Neem Point and Adiyogi retain their normal follow framing. No terrain, vegetation, collision, save data, or rendering passes are changed.

Camera tests project the dock traveler and gate crown into desktop and narrow-phone viewports, check the regional limits and completion behavior, and verify manual zoom and the transition back to normal follow.

## Navigate overview

The Navigate button, M key and Island map menu tab now open the actual 3D world overview. The old flat-map panel is replaced by a small bottom card. Gameplay pauses while the camera eases its target toward the archipelago center and pulls back to frame the islands. Closing the card, M or Escape reverses the same blend toward the player, preserving manual follow zoom. Rapid toggles reverse from the current blend instead of restarting a camera cut.

`MapCamera.js` provides a two-second transition with quintic easing and geometric zoom interpolation. Target movement trails zoom slightly on opening, reversing on close. Portrait and landscape framing reserve space around the world and for the bottom controls. Reduced-motion preferences bypass the transition. Follow wheel/pinch zoom is disabled while overview is open; free orbit remains a separate Settings option. The existing dialog focus trap and focus restoration remain active.

### Kode comparison

Inspected the saved Kode Clubs `App.bundle.js` controls class. Its `activate` method tweens `targetFactor` and `radiusFactor` over two seconds, using `expo.inOut` on opening and `expo.out` for the returning target. The look target also receives a separate 0.05 lerp. Overview can auto-rotate and respond to drag/wheel.

Port previously used an exponential chase with rate 3.4: highest velocity immediately after activation, then a long diminishing tail. Port now uses a fixed two-second quintic ease with zero endpoint velocity and acceleration. Zoom and target position use separate curves so the camera opens space around the traveler before shifting across the archipelago. Port retains its orthographic view, frame-rate-independent timing and reduced-motion behavior; it does not copy Kode's per-frame rotation or character-heading changes. Interrupted transitions begin from the current blend without a position jump.

## Interactive island overview

Navigate now offers three keyboard-accessible island buttons projected from their actual world positions. Choosing Malai Vasal, Neem Point or Adiyogi glides the map camera to that island over 1.6 seconds and opens a short destination card. All islands reverses the focus to the full archipelago; Return to my journey restores player follow. These actions change only the view, never boat position, discoveries or chapter progress.

`MapDestinations.js` defines the island centers, framing sizes and interruptible focus interpolation. `MapIslandMarkers.jsx` projects DOM buttons after the camera update; buttons remain inside the existing dialog and keyboard focus moves between island selection and the card. Reduced motion resolves focus immediately. Adiyogi's card explicitly describes it as unfinished. The other proposed improvements remain separate future work.

## Map orbit

Drag horizontally across the open map to rotate around its current focus. Pointer capture keeps mouse, pen and single-touch drags attached until release or cancellation. Island labels and destination controls remain separate interactive elements above the drag surface. The background no longer dismisses the map; use Return, close, M or Escape.

Rotate left/right buttons and Reset view provide alternatives to dragging. The focusable map surface also accepts left/right arrow keys and Home. Rotation eases toward the requested angle, remains within a half-turn in either direction, and blends back to the gameplay bearing when Navigate closes. It resets after the close transition, and never changes the player's heading or movement. Reduced motion responds directly without residual damping.

## Open navigation interface

Replaced the dark destination card with a Madbox-inspired open composition. Headings and descriptions sit at the upper left over the sea; islands are selected directly through transparent, camera-aligned hit areas. Floating icons and labels have been removed. Keyboard focus still shows an outline, and each island retains an accessible name. Close sits at the upper right, orbit controls at the lower left and the journey return action at the lower right. Narrow screens stack the bottom controls. No new reference artwork, fonts or assets are copied. Existing camera transitions, pointer handling, reduced-motion behavior and keyboard focus management remain in place.

## Circular opening

The opening keeps the normal traveler-centered camera orientation. A circular window opens over 1.6 seconds while the view gently zooms from 1× to 1.5×. Set sail expands the circle into the world and eases back to normal gameplay zoom over 2.2 seconds. There is no flyover, descent, orbit, or boat-position animation. Skip shortens the sequence; reduced motion and resume avoid the zoom. Asset readiness and hidden-tab timing remain respected.
