import data from './world-markers.json' with { type: 'json' };

export function validateWorldMarkers(document) {
  if (document.version !== 1 || document.space !== 'game-world-y-up') throw new Error('Unsupported marker coordinate space/version');
  for (const name of ['spawn', 'gateEntry', 'gateExit', 'gateCamera', 'gateDetailCamera', 'luggageOrigin', 'luggage0', 'luggage1', 'luggage2', 'luggage3']) {
    const point = document.markers?.[name];
    if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new Error(`Invalid marker: ${name}`);
  }
  const m = document.markers;
  // Current island collision uses an axis-aligned doorway. Reject unsupported
  // rotations rather than silently breaking release/collision alignment.
  if (m.gateEntry[0] !== m.gateExit[0] || m.gateEntry[2] <= m.gateExit[2]) throw new Error('Gate markers must face the arrival shore (+Z)');
  for (let i = 0; i < 4; i++) if (m[`luggage${i}`][2] <= m.luggageOrigin[2]) throw new Error('Luggage must fly toward the arrival shore');
  return m;
}
export const WORLD_MARKERS = validateWorldMarkers(data);
export const LUGGAGE_OFFSETS = Array.from({length: 4}, (_, i) => {
  const target = WORLD_MARKERS[`luggage${i}`], origin = WORLD_MARKERS.luggageOrigin;
  return [target[0] - origin[0], target[2] - origin[2]];
});
