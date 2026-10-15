# Port cleanup audit

Audited 2026-10-15; approved cleanup applied afterward. See completion record below. Sizes below are decimal MB. This is a static audit of source imports (including literal dynamic imports), test and script references, asset paths, package scripts, authoring documentation, and file hashes. Manually opened Blender inputs and external workflows cannot be proven unused by an import scan. The checkout contains substantial uncommitted work; archive authoring history before discarding it.

## Confirmed unused code and UI asset

| File / section | Finding | Suggested action |
| --- | --- | --- |
| `src/game/MalaiVasalMaterials.js` | `makeEntranceTextures` has no importers or callers in current source, tests or scripts. | Delete the file. |
| `public/ui/island-preview.jpg` | Old menu preview; no application reference. 48,706 bytes. | Delete if the old mockup is no longer wanted. |
| `src/game/TravelerModels.jsx`, from `Dhoti` onward | Old named `Traveler` export is unused; `Journey.jsx` uses `RiggedTraveler` instead. `Dhoti` and `Hand` only serve the old traveler. | Remove that section and its React/Three imports. **Keep `Luggage`, `SoftBox`, `Handle`, `Tag`, and the Drei import.** Do not delete the whole file. |
| `public/fonts/manrope-extrabold.ttf` | Only referenced by the 800-weight font-face declaration; no current UI style requests that weight. 95,688 bytes. | Remove together with its font-face declaration after a visual check. Keep other Manrope weights. |

All other scanned non-test source modules are reachable from application or tooling/test entry points. This does not mean every export inside them is used.

## Regenerable files

| Path | Size | Action |
| --- | ---: | --- |
| `dist/` | 32.59 MB | Can delete; regenerate with `npm run build`. Keep if serving this build locally. |
| `reports/assets.json` | 10,293 bytes | Can delete; regenerate with `npm run assets:audit`. |
| `scripts/__pycache__/` | 46,706 bytes | Python bytecode cache; safe to delete. |
| `.DS_Store` files | Small | Finder metadata; safe to delete. |
| `node_modules/` | About 238 MiB allocated | Reinstallable with `npm ci`, but needed for development. Not an unused dependency finding. |

## Large history and review artifacts

These are not loaded by the game. Their deletion loses review or rollback material, so treat them as archive candidates.

| Path | Size | Recommendation |
| --- | ---: | --- |
| `_ref/` | 555.66 MB; 3,686 files | Mostly historical captures and audit outputs. **Do not delete wholesale:** boat tests import `_ref/boat-coast-audit-99.mjs`. Move that helper into a maintained test-helper location and update imports before archiving the directory. README also references `qa-status.json`. |
| `assets/characters/versions/` | 57.50 MB | Historical character models and build scripts. Archive if no longer needed for rollback. |
| `assets/characters/sankaran-pillai.blend1` | 47.96 MB | Blender previous-save backup. Remove only after confirming the current `.blend` is saved, healthy and backed up. |
| Root-level PNG/JPG screenshots | 3.01 MB; 31 files | No references found in current source, scripts or docs. Move to an external review archive, or delete if unwanted. |

`_ref/` contains ten exact-content duplicate groups, totaling 865,351 redundant bytes. Some are repeated frames in capture sequences: removing individual frames can disrupt sequence processing. Prefer archiving entire obsolete captures. Duplicate pairs/groups include `qa-status.json` / `qa-status-98.json`, wake callback audits 99/95 and 93/90, source snapshots `ocean-before-51.jsx` / `ocean-before-55.jsx`, and repeated frames under native foliage/manta captures. Preserve `qa-status.json` if its README reference remains.

## Keep, or relocate with corresponding code changes

- `public/models/malai-vasal-day-v2.glb` (11.42 MB): original input used by compression scripts, asset tests and auditing. The game loads the compressed GLB, but the original is not redundant. Move it out of `public/` into authoring assets and update the export/compression/test/audit paths to avoid copying it into production builds.
- `public/models/malai-vasal-day-v2.json` (47,722 bytes): provenance checked by asset tests. Can move alongside the original model with updated references.
- `public/models/malai-vasal-day-v2-compressed.glb` and `public/models/sankaran-pillai.glb`: active runtime assets.
- `assets/characters/sankaran-pillai.blend`, Meshy source GLB, reference/turnaround images, and `assets/port-gameplay-markers.blend`: editable source material, not obsolete because the browser does not load it.
- `assets/characters/walk-cycle.json`: used by walk animation tooling.
- `scripts/`: export, compression, audit, marker and character workflows remain useful; standalone authoring scripts need not be imported by the application.
- `src/game/CaptureTools.jsx` and `FrameMetrics.jsx`: debug-only modules are still dynamically imported.
- `public/licenses/`, font license files and `public/port.svg`: retain attribution and the active favicon.
- Package dependencies: no confirmed removable package. React type packages serve editor/type tooling even without application imports.

Moving the original gate GLB and provenance out of `public/` would reduce deployed file size by approximately **11.47 MB**. It does not imply an equivalent initial-network saving: the runtime already loads the compressed asset.

## Small redundancies and stale documentation

- `src/index.css` has two `.panel h1` rules; the later Manrope declaration overrides the earlier DM Sans declaration. Consolidate according to the desired design.
- README still says disembarking/walking are not implemented, despite the current journey implementation.
- Asset workflow documentation says automatic quality is not enabled, while current source includes `AutoQuality`.
- Character documentation and older workflow test results should be refreshed to reflect the current Meshy/rigged character and current checks, rather than deleted.

## Suggested cleanup order

1. Remove the confirmed unused module, old preview and unused procedural traveler section; remove unused font weight if desired.
2. Delete caches and generated reports/build output only where no local process needs them.
3. Move the boat audit helper into test support, update its consumers, then archive obsolete `_ref` material.
4. Back up and archive character versions, Blender backup and review screenshots.
5. Relocate the uncompressed gate input and provenance out of `public/`, updating all producers and consumers.
6. Run `npm test`, `npm run assets:check`, `npm run build`, and `npm run lint` after actual cleanup; check the menu and character visually after UI/model code changes.

No tests were rerun for this report-only audit; no new claim about test or build health is made.

## Cleanup completion

User approved removal of the audited candidates except `_ref/`. Removed the unused material module, old UI preview and unused font weight (including its CSS declaration), the procedural traveler section (preserving luggage), historical character versions, Blender `.blend1` backup, the 31 audited root screenshots, Python cache, Finder metadata, generated build and asset report. Added Python bytecode ignores. Active authoring sources, runtime models, dependencies, licenses and documentation remain. New screenshots created after the audit were not included.

All 3,686 `_ref/` files were verified unchanged by SHA-256. Deleted files totaled 151,981,212 bytes (about 152 MB), excluding the additional dead code removed from surviving files. Build and asset audit regenerated disposable output during verification; that output was removed again afterward.

Validation: production build passed (large-chunk advisory); gameplay tests passed; all 13 dedicated asset tests passed. Lint completed with the existing unused-variable warning in `_ref/foliage-pixel-ray-audit-100.mjs`, which was left untouched. The combined asset-budget command failed because the unchanged current character GLB is 11,780,288 bytes against a 4,000,000-byte budget and 152,204 triangles against a 115,000-triangle budget.

### Deleted files

- `sankaran-pillai-front.png`
- `malai-vasal-sketch-preview.jpg`
- `island-sand-refined.png`
- `traveler-arrival.png`
- `island-open-sand.png`
- `malai-vasal-blender-source.png`
- `map-camera-controls.png`
- `ui-refresh-preview.png`
- `malai-vasal-rock-preview.jpg`
- `natural-traveler.png`
- `island-vibrant-palette.png`
- `boat-water-reset.png`
- `malai-vasal-stepped-walls.png`
- `malai-vasal-preview.jpg`
- `island-sanctuary-preview.png`
- `traveler-luggage-redesign.png`
- `island-shoreline-foam.png`
- `minimal-ui-preview.png`
- `gate-clear-passage.png`
- `traveler-refined.png`
- `storybook-traveler.png`
- `island-composition-refined.png`
- `malai-vasal-reference-detail.jpg`
- `menu-layout-preview.jpg`
- `malai-vasal-island-palette.png`
- `sea-glass-ui-preview.jpg`
- `malai-vasal-centered-preview.jpg`
- `sankaran-pillai-seated.png`
- `gate-planted-footpath.png`
- `island-sunset.png`
- `island-night.png`
- `src/game/MalaiVasalMaterials.js`
- `public/ui/island-preview.jpg`
- `public/fonts/manrope-extrabold.ttf`
- `assets/characters/versions/v1/sankaran-pillai.blend`
- `assets/characters/versions/v1/build_sankaran.py`
- `assets/characters/versions/v1/sankaran-pillai.glb`
- `assets/characters/versions/v2/sankaran-pillai.blend`
- `assets/characters/versions/v2/sankaran-pillai.glb`
- `assets/characters/versions/pre-visual-refinement/sankaran-pillai.blend`
- `assets/characters/versions/pre-visual-refinement/build_sankaran.py`
- `assets/characters/versions/pre-visual-refinement/sankaran-pillai.glb`
- `assets/characters/versions/pre-meshy/sankaran-pillai.blend`
- `assets/characters/versions/pre-meshy/sankaran-pillai.glb`
- `assets/characters/sankaran-pillai.blend1`
- `scripts/__pycache__/build_sankaran.cpython-314.pyc`
- `dist/index.html`
- `dist/port.svg`
- `dist/ui/island-preview.jpg`
- `dist/licenses/bruno-simon-folio-2025.txt`
- `dist/models/malai-vasal-day-v2.glb`
- `dist/models/malai-vasal-day-v2.json`
- `dist/models/malai-vasal-day-v2-compressed.glb`
- `dist/models/sankaran-pillai.glb`
- `dist/fonts/dm-sans.ttf`
- `dist/fonts/dm-sans-semibold.ttf`
- `dist/fonts/manrope-semibold.ttf`
- `dist/fonts/DM-Sans-LICENSE.txt`
- `dist/fonts/manrope.ttf`
- `dist/fonts/dm-sans-medium.ttf`
- `dist/fonts/manrope-extrabold.ttf`
- `dist/fonts/Manrope-LICENSE.txt`
- `dist/assets/index-DI1ib-oa.css`
- `dist/assets/CaptureTools-L1nE6opO.js`
- `dist/assets/index-CEGJ8ThB.js`
- `dist/assets/FrameMetrics-CuAxiNMN.js`
- `reports/assets.json`
- `.DS_Store`
- `assets/.DS_Store`
- `assets/characters/.DS_Store`
- `assets/characters/meshy/.DS_Store`
