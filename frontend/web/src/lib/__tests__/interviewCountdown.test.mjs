import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decrementDisplayedSeconds,
  readAuthoritativeSeconds,
  startInterviewCountdownTicker,
} from '../interviewCountdown';

test('one countdown ticker produces exactly one decrement each second', () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let callback;
  let active = true;
  globalThis.setInterval = (fn, delay) => {
    assert.equal(delay, 1000);
    callback = fn;
    return 1;
  };
  globalThis.clearInterval = (id) => { assert.equal(id, 1); active = false; };
  const tick = () => { if (active) callback(); };
  let remaining = 8;
  let updates = 0;
  const stop = startInterviewCountdownTicker(() => {
    updates += 1;
    remaining = decrementDisplayedSeconds(remaining);
  });

  tick();
  assert.equal(updates, 1);
  assert.equal(remaining, 7);
  tick();
  tick();
  assert.equal(updates, 3);
  assert.equal(remaining, 5);
  stop();
  tick();
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  assert.equal(updates, 3);
});

test('authoritative zero and refreshed remaining time never fall back to duration', () => {
  assert.equal(readAuthoritativeSeconds(0), 0);
  assert.equal(readAuthoritativeSeconds(12), 12);
  assert.equal(readAuthoritativeSeconds(null), null);
  assert.equal(readAuthoritativeSeconds(undefined), null);

  // Simulates a refresh after the deadline and a later contract read: only the
  // server's current remaining value is rendered, not the original duration.
  const refreshed = readAuthoritativeSeconds(0);
  const laterExpiredSnapshot = readAuthoritativeSeconds(0);
  assert.equal(refreshed, 0);
  assert.equal(laterExpiredSnapshot, 0);
  assert.equal(decrementDisplayedSeconds(0), 0);
});
