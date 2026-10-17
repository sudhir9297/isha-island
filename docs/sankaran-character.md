# Meshy character replacement

The active `public/models/sankaran-pillai.glb` now uses the Meshy 6 Lite character generated from `assets/characters/sankaran-meshy-front.png`, derived from the arms-down turnaround sheet. The original Meshy download is in `assets/characters/meshy/`.

The editable source is `assets/characters/sankaran-pillai.blend`. The textured mesh is normalized to 2.256 m, turned to face game -Z, and attached to the existing 25-bone rig. The garment is separated using its texture colors and height, with seated and alternating stride corrective shapes. Hands use blended wrist/forearm weights; individual finger articulation and facial animation are not implemented on this replacement.

Meshy generation used its displayed CC BY 4.0 option. Credit Meshy when distributing this generated asset. Original reference-art rights are separate. The export contains embedded textures and approximately 152,000 character triangles before the accessory, so further reduction may be useful for mobile targets.

`rig_meshy_character.py` expects the imported download to be named `Meshy_Source` and the previous procedural body/garment to have their original names. It preserves the old geometry in hidden collections, transfers the existing animation rig, and fits weights. Run `update_sankaran_walk.py` and `finalize-traveler-walk.mjs` after this conversion. Do not run `build_sankaran.py` to regenerate this Meshy geometry: it recreates the older procedural model.

Walking and seated poses were visually inspected in Blender. Six asset tests check skinning, independent instances, animation import, skeleton/gait parity, garment corrections, and embedded image payloads. Node skeletal tests stub browser image decoding; texture appearance was checked in Blender. The production build passes.

---

## Previous procedural model history

# Sankaran Pillai character

The playable traveler now uses `public/models/sankaran-pillai.glb`, built in Blender from the supplied character reference. The editable source is `assets/characters/sankaran-pillai.blend`. `scripts/build_sankaran.py` contains the geometry, rig, weighting, corrective shape and animation authoring steps; it replaces only the `Sankaran_Character` collection.

The model has 83,220 triangles, 25 deformation bones, eleven material primitives and no external textures. The GLB is approximately 3.0 MB. It includes a bald head, side hair, moustache, closed eyes, speaking mouth, blue shirt, ivory dhoti with gold borders, and bare feet. Geometry is a stylized interpretation of the reference, not a scanned reconstruction.

## Rig and animation

- Root, body and head controls; paired upper arms, forearms, hands, thighs, shins and feet; five finger controls per hand.
- Every mesh vertex has normalized skin weights. Arms, wrists, palms and fingers use continuous surfaces with blended elbow, wrist and finger weights. The shirt is one joined surface with weighted shoulders and open sleeve hems.
- `Idle`, `Walk`, `Seated` and `Point` clips are included in the GLB. `Point` raises the character's left index finger. The `Seated` clip includes the dhoti corrective shape.
- The Blender source opens with the updated Walk action active on frame 7. Play frames 1–24 to preview the loop. Clear the active action and reset pose transforms for the standing bind pose. Muted NLA tracks contain the other clips. The exported GLB defaults to its standing bind pose.
- The standing and seated garment surfaces share topology. Cloth uses a corrective shape rather than live cloth simulation. The facial expression is fixed; facial/lip-sync controls and IK targets are not included.

## Game integration

`RiggedTraveler.jsx` loads the GLB through Drei and uses `SkeletonUtils.clone` to give each instance independent bones. `TravelerAsset.js` exposes the exported bones through the refs consumed by `Journey.jsx`. Both dhoti material primitives share the seated morph influence.

The game continues to use its distance-driven procedural gait rather than playing the standalone walk clip, so foot speed follows actual movement. The same rig handles boat seating, luggage attachment, burden release and walking. Blender Z-up is exported to glTF Y-up; the character faces -Z. The bone local axes match the existing controller.

Use the existing sailing controls, approach the beach slowly, then use **E** or the shore interaction button to disembark. WASD/arrow keys walk on land. In `/?debug`, select **Traveler portrait**, **Traveler side** or **Traveler back** under Debug tools to inspect the character.

## Verification

The exported GLB is loaded by `TravelerAsset.test.js` to check skin weights, independent skeletons, dimensions, gait deformation, seated cloth and animation import. The revised character was inspected from the front, side and three-quarter views in Blender, including its pointing and seated poses. The game integration was previously inspected in the running game; exported animation and deformation are checked again after revisions.

The production build succeeds. All five character tests pass. The prior full-suite run had 108 passes and one existing failure in `SeabedMaterial.test.js`, whose brightness threshold no longer matches the working tree's sand palette. Lint has an existing unused-variable warning in `_ref/foliage-pixel-ray-audit-100.mjs`.

## Second visual pass

The head is broader, the belly profile is smoothly curved, and the mouth is recessed into the face. Spherical sleeves and segmented arms were replaced with joined surfaces. The dhoti has a quiet wrap silhouette and overlapping front panel instead of repeated narrow pleats. The revised pointing gesture reaches higher while keeping the neutral game skeleton unchanged.

## Walking update

The game uses a 0.56 m step with planted stance feet, a smooth return arc, toe lift, opposing arm swings, torso sway and a small body rise. Arm swing reduces while carrying bags. Alternating dhoti corrective shapes provide room for each forward step. Footstep sounds use the same distance cadence.

To recreate the final animation after rebuilding the character: run `node scripts/sample-traveler-walk.mjs`, run `scripts/update_sankaran_walk.py` in Blender, then run `node scripts/finalize-traveler-walk.mjs`. The last step corrects Blender's NLA morph export using those same samples. For Blender MCP safe mode, substitute the sample JSON inline for the Python script's filesystem read. The exported-walk test checks the imported skeleton and garment against the gameplay samples.

## Third visual pass

Broader, shallower head; larger closed eyes; wider moustache; smaller speaking mouth; warmer matte skin and lighter blue cotton. The shirt has denser smooth geometry and corrected surface normals. The dhoti has soft vertical folds and a more pronounced overlapping panel. The 25-bone rig, seated correction and updated walk are retained. Character and gait tests pass after re-export.
