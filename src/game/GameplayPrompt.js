// A single priority list owns the bottom HUD slot, so contextual actions and
// passive guidance cannot stack on top of one another.
export function selectGameplayPrompt({ journey: s, telemetry, paused, freeCamera, showHint, nearbyPlace, touch }) {
  if (paused || freeCamera || s.activeDiscovery) return null;
  if (s.mode === 'aboard' && telemetry.beached) return {
    action: 'reset', key: 'R', label: 'Reset to water',
    detail: `Automatic return in ${Math.max(1, Math.ceil(5 - (telemetry.beachedTime ?? 0)))}s`,
  };
  let label;
  if (s.mode !== 'aboard' && s.nearDiscovery) label = s.nearDiscovery === 'note' ? 'Discover' : 'Examine shell';
  else if (s.mode === 'resting') label = 'Continue exploring';
  else if (s.mode === 'walking' && s.nearRest && s.releaseTime >= 2) label = 'Pause by the sea';
  else if (s.mode === 'aboard' && s.canLand) label = 'Step ashore';
  else if (s.mode === 'walking' && s.nearBoat) label = 'Board boat';
  if (label) return { action: 'interact', key: 'E', label };
  if (s.mode === 'aboard' && nearbyPlace) return { label: `Nearby · ${nearbyPlace}` };
  if (s.released && s.releaseTime >= 8 && !s.completed) return { label: 'Find a quiet moment by the sea' };
  if (showHint) return { label: s.mode === 'aboard'
    ? touch ? 'Tap the sea to sail, or use the arrows' : 'Click the sea to sail · WASD to steer'
    : touch ? 'Use the arrows to walk · Tap Jump to hop' : 'WASD to walk · Shift to run · Space to jump' };
  return null;
}
