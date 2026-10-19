import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrabLegSolver, CRAB_UPPER_LEG, CRAB_LOWER_LEG } from './CrabLeg.js';

test('leg segments keep their length throughout a rock descent and climb', () => {
  const solve = createCrabLegSolver();
  for (const side of [-1,1]) for(let floor=-2;floor<=2;floor+=.01) {
    const {hip,knee,foot}=solve(side*.12,.14,0,side*.32,.025+floor,.025,side);
    assert.ok(Math.abs(hip.distanceTo(knee)-CRAB_UPPER_LEG)<1e-9);
    assert.ok(Math.abs(knee.distanceTo(foot)-CRAB_LOWER_LEG)<1e-9);
    assert.ok(hip.distanceTo(foot)<CRAB_UPPER_LEG+CRAB_LOWER_LEG);
  }
});
test('reachable sand contacts stay planted; distant sand cannot pull the foot down', () => {
  const solve=createCrabLegSolver();
  const planted=solve(.12,.14,0,.32,.025,.025,1);
  assert.ok(Math.abs(planted.foot.y-.025)<1e-9);
  const ledge=solve(.12,.14,0,.32,-1,.025,1);
  assert.ok(ledge.foot.y>-.2);
});
test('a target at the hip produces a finite bent leg', () => {
  const {hip,knee,foot}=createCrabLegSolver()(.12,.14,0,.12,.14,0,1);
  assert.ok(Number.isFinite(knee.x));
  assert.ok(Math.abs(hip.distanceTo(knee)-CRAB_UPPER_LEG)<1e-9);
  assert.ok(Math.abs(knee.distanceTo(foot)-CRAB_LOWER_LEG)<1e-9);
});
