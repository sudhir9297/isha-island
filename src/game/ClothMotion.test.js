import test from 'node:test';
import assert from 'node:assert/strict';
import { easeClothForce, clothRipple, canopyDisplacement, pennantY } from './ClothMotion.js';

test('gust response is independent of frame rate and clamps abrupt impulses', () => {
  const run = fps => { let x = 0; for(let i=0;i<fps;i++) x = easeClothForce(x, .8, 1/fps); return x; };
  assert.ok(Math.abs(run(30)-run(144)) < 1e-12);
  assert.equal(easeClothForce(.4, 1, 0), .4);
  assert.ok(easeClothForce(0, 500, 10) <= 1.2);
});
test('cloth attachment is fixed and reduced force eliminates ripple', () => {
  for(let t=0;t<20;t+=.1) {
    assert.equal(Math.abs(clothRipple(0, .2, t, 1, 2)), 0);
    assert.equal(Math.abs(clothRipple(1, .2, t, 0, 2)), 0);
    assert.ok(Math.abs(clothRipple(1, .2, t, 1, 2)) <= .063);
  }
});
test('canopy pins outer rails and both internal support bars', () => {
  for(let t=0;t<10;t+=.2) {
    for(const x of [-.74,.74]) assert.ok(Math.abs(canopyDisplacement(x,.5,t,1)) < 1e-12);
    for(const z of [-.47,-.33,1,1.13]) assert.ok(Math.abs(canopyDisplacement(.2,z,t,1)) < 1e-12);
    assert.ok(canopyDisplacement(0,.4,t,1) >= 0);
  }
});
test('pennant tips retain their length and the top seam remains straight', () => {
  assert.equal(pennantY(0, 0, .32, .46), 0);
  assert.equal(pennantY(.16, -.46, .32, .46), -.46);
  assert.ok(pennantY(0, -.46, .32, .46) > -.46);
});
