import test from 'node:test';
import assert from 'node:assert/strict';
import { updateBoatTelemetry, updateJourneyStatus } from './JourneyTelemetry.js';

const boat = {x: 0, z: -2, heading: 1, speed: 0, beached: false, beachedTime: 0};
const journey = {mode: 'aboard', canLand: false, released: false, releaseTime: 0, nearBoat: false, nearRest:false, completed:false, restTime:0};

test('repeated idle and paused samples retain the same UI objects', () => {
  for (let i = 0; i < 600; i++) {
    assert.equal(updateBoatTelemetry(boat, {...boat}), boat);
    assert.equal(updateJourneyStatus(journey, {...journey}), journey);
  }
});

test('every displayed boat field still updates, including recovery countdown', () => {
  for (const key of Object.keys(boat)) {
    const changed = {...boat, [key]: typeof boat[key] === 'boolean' ? true : boat[key] + 0.01};
    assert.deepEqual(updateBoatTelemetry(boat, changed), changed);
    assert.notEqual(updateBoatTelemetry(boat, changed), boat);
  }
  assert.equal('position' in updateBoatTelemetry({}, {...boat, position: {x: 0}}), false);
});

test('boarding prompts and relief-message boundaries remain observable', () => {
  for (const change of [{mode: 'walking'}, {canLand: true}, {nearBoat: true}, {released: true}]) {
    assert.notEqual(updateJourneyStatus(journey, {...journey, ...change}), journey);
  }
  let previous = journey;
  for (const releaseTime of [0.79, 0.8, 7.99, 8]) {
    const next = updateJourneyStatus(previous, {...journey, released: true, releaseTime});
    assert.equal(next.releaseTime, releaseTime);
    assert.notEqual(next, previous);
    previous = next;
  }
  const simulation = {...previous, releaseTime: 120};
  assert.equal(updateJourneyStatus(previous, simulation), previous);
  assert.equal(simulation.releaseTime, 120);
  assert.deepEqual(updateJourneyStatus(previous, journey), journey);
});
