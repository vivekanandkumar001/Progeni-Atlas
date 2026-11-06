/**
 * TTS voice-quality workstream (Phases 3-4) — frontend unit tests.
 *
 * Covers:
 *  - V-05: /speak request carries an AbortSignal and a deliberate abort is
 *    propagated as AbortError (never wrapped into a VoiceFailure, so the hook
 *    never falls back to browser speechSynthesis for a superseded question).
 *  - V-05: server error envelopes map to VoiceFailure with errorCode/retryable.
 *  - Guard rails: non-audio content type and empty audio bodies are rejected.
 *  - V-12: clampPlaybackRate bounds.
 *  - safeHash identity helper (dialogue-key dedupe).
 *
 * These are unit tests with a mocked fetch; they do NOT prove naturalness or
 * real-device playback (see TTS_VOICE_QUALITY_TEST_REPORT.md, manual section).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  speakInterviewText,
  apiFetch,
} from '../api';
import {
  clampPlaybackRate,
  safeHash,
  useInterviewerSpeech,
} from '../hooks/useInterviewerSpeech';

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponse = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const audioResponse = (bytes, contentType = 'audio/mpeg') =>
  new Response(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: { 'content-type': contentType },
  });

test('module surface: hook and helpers are exported (alias import works under tsx)', () => {
  assert.equal(typeof useInterviewerSpeech, 'function');
  assert.equal(typeof clampPlaybackRate, 'function');
  assert.equal(typeof safeHash, 'function');
  assert.equal(typeof speakInterviewText, 'function');
  assert.equal(typeof apiFetch, 'function');
});

test('speakInterviewText returns a non-empty audio Blob and sends JSON text', async () => {
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return audioResponse([1, 2, 3, 4, 5]);
  };

  const blob = await speakInterviewText('sess-1', 'Tell me about yourself.');
  assert.ok(blob instanceof Blob);
  assert.equal(blob.size, 5);
  assert.match(String(captured.url), /\/api\/interview\/sess-1\/speak$/);
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(captured.init.body), { text: 'Tell me about yourself.' });
});

test('speakInterviewText forwards the caller AbortSignal unchanged (V-05)', async () => {
  let seenSignal = null;
  globalThis.fetch = async (url, init) => {
    seenSignal = init.signal;
    return audioResponse([9]);
  };

  const controller = new AbortController();
  await speakInterviewText('sess-1', 'Question one.', controller.signal);
  assert.equal(seenSignal, controller.signal);
});

test('speakInterviewText propagates a deliberate abort as AbortError, not VoiceFailure (V-05)', async () => {
  globalThis.fetch = (url, init) =>
    new Promise((_, reject) => {
      if (init?.signal?.aborted) {
        reject(new DOMException('This operation was aborted', 'AbortError'));
        return;
      }
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('This operation was aborted', 'AbortError'))
      );
    });

  const controller = new AbortController();
  const pending = speakInterviewText('sess-1', 'Superseded question.', controller.signal);
  controller.abort();
  await assert.rejects(pending, (err) => {
    assert.equal(err.name, 'AbortError');
    // Must not be wrapped: the hook keys its no-fallback rule off this name.
    assert.equal(err.errorCode, undefined);
    return true;
  });
});

test('speakInterviewText maps 429 speech_budget_exceeded envelope to VoiceFailure', async () => {
  globalThis.fetch = async () =>
    jsonResponse(
      { error: 'Interview speech budget exceeded.', error_code: 'speech_budget_exceeded', retryable: true },
      429
    );

  await assert.rejects(speakInterviewText('sess-1', 'Question.'), (err) => {
    assert.equal(err.errorCode, 'speech_budget_exceeded');
    assert.equal(err.retryable, true);
    assert.match(err.message, /budget/i);
    return true;
  });
});

test('speakInterviewText marks 503 speech_not_configured as non-retryable', async () => {
  globalThis.fetch = async () =>
    jsonResponse({ error_code: 'speech_not_configured' }, 503);

  await assert.rejects(speakInterviewText('sess-1', 'Question.'), (err) => {
    assert.equal(err.errorCode, 'speech_not_configured');
    assert.equal(err.retryable, false);
    return true;
  });
});

test('speakInterviewText rejects a 200 non-audio body (proxy error page guard)', async () => {
  globalThis.fetch = async () =>
    new Response('<html>502 Bad Gateway</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

  await assert.rejects(speakInterviewText('sess-1', 'Question.'), (err) => {
    assert.equal(err.errorCode, 'speech_invalid_content_type');
    assert.equal(err.retryable, true);
    return true;
  });
});

test('speakInterviewText rejects an empty audio body', async () => {
  globalThis.fetch = async () => audioResponse([]);

  await assert.rejects(speakInterviewText('sess-1', 'Question.'), (err) => {
    assert.equal(err.errorCode, 'speech_empty_audio');
    assert.equal(err.retryable, true);
    return true;
  });
});

test('clampPlaybackRate keeps natural bounds and defaults non-finite input (V-12)', () => {
  assert.equal(clampPlaybackRate(0.1), 0.5);
  assert.equal(clampPlaybackRate(5), 2);
  assert.equal(clampPlaybackRate(1.25), 1.25);
  assert.equal(clampPlaybackRate(1.5), 1.5);
  assert.equal(clampPlaybackRate(NaN), 1.25);
  assert.equal(clampPlaybackRate(Infinity), 1.25);
  assert.equal(clampPlaybackRate(-Infinity), 1.25);
});

test('safeHash is case/whitespace-insensitive and stable for dialogue-key dedupe', () => {
  assert.equal(safeHash('  What is CI/CD?  '), safeHash('what is ci/cd?'));
  assert.equal(safeHash('Question A'), safeHash('Question A'));
  assert.notEqual(safeHash('Question A'), safeHash('Question B'));
  assert.match(safeHash('Question A'), /^[0-9a-f]+$/);
});
