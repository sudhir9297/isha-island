# Island exploration

- At the dock's outer end, stand or walk quietly to draw twelve small golden fish closer. Running, jumping, or a moving boat nearby scatters them. They return after the disturbance stops. They have no reward popup.
- Approach the front of the Neem Point bench and press E or tap the contextual action to sit. The camera eases outward and the existing wind system adds leaf rustle around the tree. E, movement, or Jump stands the traveler up on clear ground. This does not advance the gate chapter. Saved games resume standing beside the bench.
- Walking leaves alternating prints on coastal sand. They fade over 28 seconds. The crab leaves smaller tracks that last 48 seconds. Wood, water, elevated rock contacts, jumps, and teleports do not leave connecting trails.

The dock fish use two instanced meshes. Track pools are bounded and grouped into eight opacity levels per track type. All three features respect gameplay pause. The bench camera respects reduced-motion preferences. No phone performance claim has been made.

Debug tools include a Neem seat rehearsal. The dock discovery rehearsal positions the traveler at the fish lookout; the crab rehearsal can be used to inspect sand tracks. Rehearsals do not save journey progress.

## Dock shoal movement

The dock fish now keep individual positions and velocities. A fixed 60 Hz simulation combines neighbour separation, alignment, cohesion, gentle changes to their foraging area, and bounded turning. Disturbances steer each fish away from their source. Body orientation and tail rate follow actual swimming motion. There are no assigned orbit angles or shared-radius expansion animations.

References: Craig Reynolds' [Boids model](https://red3d.com/cwr/boids/index.html) and Herbert-Read et al.'s [How predation shapes the social interaction rules of shoaling fish](https://pubmed.ncbi.nlm.nih.gov/28855361/). These inform the movement model; the visitor-attraction mechanic and numerical tuning are game design choices, not species-specific biological measurements.

## Discovery polish

Interaction rings and collectible glints are proximity gated; the current action takes priority and hides the cue while playing. Bell ringing, stone skipping, and keepsake pickup now pose the traveler. Activity effects start after a short reach/windup; pickup messages wait for the crouch to finish.

Owned keepsakes have a demand-rendered 3D turntable in the satchel, supporting pointer drag, arrow keys, and rotation buttons. Newly collected objects animate into the satchel after the discovery message is dismissed. Reduced motion uses a short fade.

Each keepsake unlocks a matching boat pennant. Equipping one is optional, keeps the existing boat, and persists under `port.boat-pennant.v1`; saved selections are checked against owned keepsakes. Three synthesized island sound layers (shore wash, grove insects, low open breeze) fade by distance using the existing sound toggle. They fade out while paused or hidden. They are atmosphere, not recordings of the actual locations.

Validation: full suite passed (272 tests), with an additional targeted interaction-cue test passing afterward; production build and lint passed. Browser verified shell inspection, rotation controls, and pennant selection. Device performance and listening balance still need physical-device testing.
