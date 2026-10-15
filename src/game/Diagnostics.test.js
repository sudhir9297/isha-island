import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticsOptions } from './Diagnostics.js';

test('ordinary play does not enable diagnostics from unrelated query values', () => {
  for (const search of ['', '?quality=high', '?view=debug', '?notgpu=1', '?scene=capture']) {
    assert.deepEqual(diagnosticsOptions(search), {debug: false, profiling: false});
  }
});

test('debug tools and standalone GPU/capture modes retain metrics', () => {
  assert.deepEqual(diagnosticsOptions('?debug&gpu'), {debug: true, profiling: true});
  for (const search of ['?gpu', '?capture']) {
    assert.deepEqual(diagnosticsOptions(search), {debug: false, profiling: true});
  }
});
