# Chapter One: The Arrival

New journeys open offshore in a wooden rowboat with animated oars. The boat slowly approaches Malai Vasal, stopping within landing range. Manual movement cancels the approach.

Press E to step ashore, then walk through the central gate. The original luggage throw, relief animation, sound and checkpoint message play. Crossing the gate unlocks the existing motorboat. The player can pause by the sea or return to the boat. There are no volunteer characters, shelter, welcome mat, supply baskets or gardening tasks.

Open-sea arrows remain unlabeled and disappear when an island is visible. Progress saves automatically; refresh restores the gate milestone and unlocked boat. Restart journey begins offshore again. Saves from the retired volunteer tasks migrate to the gate objective with luggage carried again.

`ChapterOne.js` owns the chapter milestone. `JourneyState.js` detects the full central gate crossing, and `Journey.jsx` plays the original luggage and relief sequence. `ChapterOne.jsx` only renders the objective HUD, which stays hidden during the relief message. Later chapters are not implemented.
