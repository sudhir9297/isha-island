# Minimal game interface

The gameplay HUD uses open ivory text, gold waypoint accents and compact round controls. Chapter objectives have a small original SVG waypoint instead of a rectangular card. The map button is a round icon with a small label; action keys are round keycaps. Notifications and control hints have no panel background.

Menus use typography over a sea-colored screen veil. Settings, field notes and controls use simple rows; reset/resume actions are text with an underline. The map retains direct island selection, smaller headings and compact orbit controls. Discovery stories are centered open text over a full-screen veil, with no paper card, shadow or backdrop blur. Touch controls follow the same round style. Startup actions use the same typography and underline.

Dialog semantics, labels, focus trapping, keyboard controls and reduced-motion preferences are preserved. Changes are limited to App markup, ChapterOne, DiscoveryCard and CSS; rendering and simulation are untouched. No image textures or new font downloads are introduced.

The opening screen uses the same gold wordmark/wave, chapter caption and an original circular arrow-and-wave SVG beside “Set sail”. The invitation sits near the bottom to keep the boat clear. The Enter hint is hidden on coarse-pointer devices. Loading has a thin progress line; error/retry states use open text. The existing start action and reveal sequence are unchanged.

Passive hints are claimed once per journey, survive menu remounts and harbour returns, and are included in explicit save/resume. New journeys clear them. Action prompts remain repeatable. The objective follows letter → crab greeting → guide → shell → gate; discovery overlays temporarily hide the objective. Harbour recovery preserves the crab invitation flag. Discovery copy is short and distinct at each step.
