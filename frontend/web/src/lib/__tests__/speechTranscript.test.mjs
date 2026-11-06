import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnswerSubmissionText, SpeechTranscriptAccumulator } from '../hooks/speechTranscript';

const result = (text, isFinal = false) => ({ isFinal, 0: { transcript: text } });

test('final phrases accumulate while each interim result replaces only its own slot', () => {
  const transcript = new SpeechTranscriptAccumulator();

  let snapshot = transcript.update([result('I built a service', true), result('that handles', false)], 0);
  assert.equal(snapshot.committed, 'I built a service');
  assert.equal(snapshot.interim, 'that handles');
  assert.equal(snapshot.displayed, 'I built a service that handles');

  snapshot = transcript.update([result('I built a service', true), result('that handles requests', false)], 1);
  assert.equal(snapshot.displayed, 'I built a service that handles requests');

  snapshot = transcript.update([result('I built a service', true), result('that handles requests', true)], 1);
  assert.equal(snapshot.committed, 'I built a service that handles requests');
  assert.equal(snapshot.interim, '');
});

test('cumulative recognition events do not duplicate final text; restart preserves it', () => {
  const transcript = new SpeechTranscriptAccumulator();
  transcript.update([result('First sentence.', true)], 0);
  // Browser sends the cumulative final again together with a revised interim.
  transcript.update([result('First sentence.', true), result('Second phrase', false)], 0);
  assert.equal(transcript.snapshot().displayed, 'First sentence. Second phrase');

  transcript.endRecognition(); // Recognition ended; this is also used before restart.
  assert.equal(transcript.snapshot().committed, 'First sentence.');
  transcript.update([result('Second phrase, now final.', true)], 0);
  assert.equal(transcript.getFinalTranscript(), 'First sentence. Second phrase, now final.');
});

test('empty results do not erase text and finalized transcript is the submission value', () => {
  const transcript = new SpeechTranscriptAccumulator();
  transcript.update([result('Complete answer with multiple sentences.', true)], 0);
  transcript.update([], 0);
  assert.equal(transcript.snapshot().displayed, 'Complete answer with multiple sentences.');

  transcript.endRecognition();
  assert.equal(transcript.getFinalTranscript(), 'Complete answer with multiple sentences.');
  transcript.reset(); // Called only when a new answer/turn begins.
  assert.equal(transcript.getFinalTranscript(), '');
});

test('submission preserves the live interim phrase when stopping recognition', () => {
  const transcript = new SpeechTranscriptAccumulator();
  transcript.update([result('I designed the service', true), result('for payment processing', false)], 0);
  const transcriptAtSubmit = transcript.snapshot().displayed;

  transcript.endRecognition();
  assert.equal(transcript.snapshot().displayed, 'I designed the service');
  assert.equal(resolveAnswerSubmissionText({
    speechTranscript: transcriptAtSubmit,
    candidateAnswer: 'I designed the service for payment processing',
    isUserEditing: false,
  }), 'I designed the service for payment processing');
});

test('manual edits remain authoritative over the speech transcript', () => {
  assert.equal(resolveAnswerSubmissionText({
    speechTranscript: 'recognized words',
    candidateAnswer: 'typed complete answer',
    answerOverride: 'typed complete answer',
    isUserEditing: true,
  }), 'typed complete answer');
});
