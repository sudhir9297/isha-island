# Boat introduction

The opening follows the two-stage sequence in Bruno Simon's `Reveal.js`: a small world-space circle opens around the vehicle, followed by an expanding reveal and camera pullback on activation. Port uses its own boat, sea colors and interface. The existing Bruno reference and MIT notice remain in `public/licenses/bruno-simon-folio-2025.txt`.

`SceneStartup` waits for the models and warm-up frames. `StartupSequence.js` then animates a visual boat entrance for 1.6 seconds, waits for Set sail / Enter / Space / W / Arrow Up, and opens the world over 2.2 seconds. Gameplay, menus, automatic quality sampling and saving remain gated until the transition completes. New journeys start offshore in the wooden rowboat. Refresh restores valid Chapter One progress and position; the visual introduction still runs. Legacy saves without a chapter are ignored. Field notes and render-quality preferences remain saved.

`StartupReveal.js` reconstructs world positions from the scene depth using Three's backend-aware helper, applying a radial mask and luminous edge over a sea-plane grid. It is composited after the existing bloom and blur. Camera adjustment happens before underwater capture. The normal output node replaces the intro node on completion, removing its per-pixel work during gameplay. Boat and seated traveler entrance offsets affect rendered transforms only.

Reduced motion removes the boat glide, zoom and expanding wave, using a short fade. Hidden tabs do not advance the sequence. Renderer/load failures retain a retry action. The lazy application chunk has the same loading shell.

Verification: run `npm test`, `npm run lint`, and `npm run build`; inspect a fresh page load with both the default WebGPU renderer and `?backend=webgl`. Check the waiting circle, click/keyboard activation, full-scene handoff, narrow viewport, and reload with an existing saved journey.

## Arrival from the sea

New journeys begin at (0, 48), south of Malai Vasal, facing north toward its arrival shore. After the circular reveal, normal boat physics carries the boat slowly toward (0, -0.2) at a target speed of 1.6 scene units/second. The approach takes roughly half a minute and brakes in clear water before the shore. Manual steering, braking or a water click cancels the guided approach immediately. The player can then choose where to land.

The authored spawn is in `world-markers.json`; approach coordinates/speed and the separate harbour return position are in `WorldConfig.js`. Restart journey begins this arrival again. Return to harbour uses the sheltered harbour location. Chapter progress, position and the motorboat unlock are saved every two seconds and on page hide. Restart journey clears that progression and begins offshore again.
