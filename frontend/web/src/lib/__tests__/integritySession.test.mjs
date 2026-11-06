import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntegritySessionState,
  createSustainedEpisodeGate,
  shouldReportIntegrityEvent,
} from '../proctoring/integritySession';

test('each interview gets clean integrity state and pre-start events are ignored', () => {
  const oldSession = createIntegritySessionState('session-old');
  oldSession.active = true;
  assert.equal(shouldReportIntegrityEvent(oldSession, 'session-old', 'old-event'), true);

  const newSession = createIntegritySessionState('session-new');
  assert.equal(newSession.active, false);
  assert.equal(newSession.seenEventIds.size, 0);
  assert.equal(shouldReportIntegrityEvent(newSession, 'session-new', 'startup'), false);
  newSession.active = true;
  assert.equal(shouldReportIntegrityEvent(newSession, 'session-new', 'new-event'), true);
  assert.equal(shouldReportIntegrityEvent(newSession, 'session-old', 'wrong-session'), false);
});

test('duplicate event delivery is rejected while a distinct rapid violation is retained', () => {
  const session = createIntegritySessionState('session-1');
  session.active = true;
  assert.equal(shouldReportIntegrityEvent(session, 'session-1', 'event-1'), true);
  assert.equal(shouldReportIntegrityEvent(session, 'session-1', 'event-1'), false);
  assert.equal(shouldReportIntegrityEvent(session, 'session-1', 'event-2'), true);
});

test('normal brief pose changes are ignored; a sustained violation fires once until recovery', () => {
  const gate = createSustainedEpisodeGate(1_500);
  assert.equal(gate.shouldFire('looking_away', true, 0), false);
  assert.equal(gate.shouldFire('looking_away', false, 500), false);
  assert.equal(gate.shouldFire('looking_away', true, 1_000), false);
  assert.equal(gate.shouldFire('looking_away', true, 2_499), false);
  assert.equal(gate.shouldFire('looking_away', true, 2_500), true);
  assert.equal(gate.shouldFire('looking_away', true, 5_000), false);
  gate.reset('looking_away');
  assert.equal(gate.shouldFire('looking_away', true, 6_000), false);
  assert.equal(gate.shouldFire('looking_away', true, 7_500), true);
});
