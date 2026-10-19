// Keep high-frequency simulation refs separate from the scalar UI snapshots.
const BOAT_FIELDS = ['x', 'z', 'heading', 'speed', 'beached', 'beachedTime', 'openingVoyage'];
const JOURNEY_FIELDS = ['performingAction', 'nearBench', 'benchSeated', 'nearActivity', 'crabInvited', 'crabHint', 'noteRead', 'shellRevealed', 'shellFound', 'nearDiscovery', 'activeDiscovery', 'mode', 'canLand', 'released', 'releaseTime', 'nearBoat', 'nearRest', 'completed', 'restTime', 'chapterStep'];

export function updateBoatTelemetry(previous, data) {
  if (BOAT_FIELDS.every(key => Object.is(previous[key], data[key]))) return previous;
  return Object.fromEntries(BOAT_FIELDS.map(key => [key, data[key]]));
}

export function updateJourneyStatus(previous, data) {
  // The relief message ends at eight seconds. Its simulation clock continues
  // independently, but later timestamps cannot change any UI.
  const releaseTime = Math.min(8, data.releaseTime ?? 0);
  const restTime = Math.min(8, data.restTime ?? 0);
  if (JOURNEY_FIELDS.every(key => Object.is(previous[key], key === 'releaseTime' ? releaseTime : key === 'restTime' ? restTime : data[key]))) return previous;
  return { ...data, releaseTime, restTime };
}
