/**
 * API client unit tests (src/lib/api.ts) — pure logic + fetch-mocked flows.
 *
 * Covers (all under plain Node, no DOM, mocked `fetch`):
 *  - URL/constant contracts: getApiUrl, API_PROXY_TARGET, USER_KEY.
 *  - Pure helpers: isValidSessionId, formatBytes, initialsOf.
 *  - HttpOnly-cookie contract: tokens are never readable from JS.
 *  - Session persistence: persistSession/clearSession against a stubbed
 *    localStorage, and their no-window (server) guards.
 *  - refreshAccessToken: server guard, success sentinel, failure → session
 *    cleared, transport error, and the concurrent-refresh collapse.
 *  - apiFetch: JSON Content-Type default, X-Support-Reason passthrough, 401
 *    refresh+retry on data endpoints, no refresh for auth entrypoints, and
 *    the synthetic `session_expired` 401 when refresh fails.
 *  - apiJson: null on non-2xx / 204 / non-JSON bodies, GET response caching +
 *    skipCache, in-flight GET deduplication, and 401 handling.
 *
 * Like interviewerSpeech.test.mjs, api.ts is imported statically: its module
 * init is safe under Node (every browser-global access is guarded by a
 * `typeof window` / try-catch at call time), so browser globals are stubbed
 * per test instead of before import.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  API_PROXY_TARGET,
  USER_KEY,
  answerInterviewQuestion,
  timeoutInterviewQuestion,
  apiFetch,
  apiJson,
  clearSession,
  formatBytes,
  getAccessToken,
  getApiUrl,
  getRefreshToken,
  initialsOf,
  invalidateApiCache,
  isValidSessionId,
  persistSession,
  refreshAccessToken,
} from '../api';
import { FRONTEND_CONFIG } from '../config';

const originalFetch = globalThis.fetch;

/* ------------------------------------------------- browser-global stubs */

const GLOBAL_NAMES = ['window', 'localStorage', 'sessionStorage'];
const savedDescriptors = new Map(
  GLOBAL_NAMES.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);

/** Minimal Web Storage implementation (per-instance Map backing). */
function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(String(k));
    },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
    /** Test-only view of the raw stored values. */
    _store: store,
  };
}

/** Install window + localStorage + sessionStorage stubs; returns the stores. */
function installBrowserStubs() {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.window = {
    localStorage,
    sessionStorage,
    location: { origin: 'http://localhost:3000' },
  };
  return { localStorage, sessionStorage };
}

function removeBrowserGlobals() {
  for (const name of GLOBAL_NAMES) delete globalThis[name];
}

function restoreBrowserGlobals() {
  for (const [name, descriptor] of savedDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

/* ------------------------------------------------------------ helpers */

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Install a fetch mock that answers by URL fragment (checked in order).
 * Returns the array of captured calls; an unanswered request throws so a
 * test can never pass by silently hitting the real network.
 */
function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    for (const [fragment, handler] of routes) {
      if (target.includes(fragment)) {
        return typeof handler === 'function' ? handler(target, init) : handler;
      }
    }
    throw new Error(`fetch called with unexpected URL: ${target}`);
  };
  return calls;
}

beforeEach(() => {
  // Default to the Node/server baseline: no browser globals, no cached
  // responses, and a fetch that fails loudly unless a test stubs it.
  removeBrowserGlobals();
  invalidateApiCache();
  globalThis.fetch = async () => {
    throw new Error('fetch was not stubbed in this test');
  };
});

after(() => {
  restoreBrowserGlobals();
  globalThis.fetch = originalFetch;
});

/* ------------------------------------------- module surface & constants */

test('environment sanity: browser globals are absent outside stubs', () => {
  // Guards every "no window" assertion below: if this fails (e.g. a future
  // runner injects jsdom), those tests would silently test the wrong path.
  assert.equal(typeof globalThis.window, 'undefined');
});

test('module surface: constants and helpers are exported', () => {
  assert.equal(typeof getApiUrl, 'function');
  assert.equal(typeof apiFetch, 'function');
  assert.equal(typeof apiJson, 'function');
  assert.equal(typeof refreshAccessToken, 'function');
  assert.equal(typeof persistSession, 'function');
  assert.equal(typeof clearSession, 'function');
  assert.equal(typeof invalidateApiCache, 'function');
  assert.equal(typeof isValidSessionId, 'function');
  assert.equal(typeof formatBytes, 'function');
  assert.equal(typeof initialsOf, 'function');
  assert.equal(USER_KEY, 'tp_user');
});

test('API_PROXY_TARGET is FRONTEND_CONFIG.apiUrl without trailing slashes', () => {
  assert.equal(API_PROXY_TARGET, FRONTEND_CONFIG.apiUrl.replace(/\/+$/, ''));
  assert.equal(API_PROXY_TARGET.endsWith('/'), false);
});

test('getApiUrl forces a leading slash so requests stay same-origin', () => {
  assert.equal(getApiUrl('/api/candidate/profile'), '/api/candidate/profile');
  assert.equal(getApiUrl('api/candidate/profile'), '/api/candidate/profile');
  assert.equal(getApiUrl('api'), '/api');
});

/* ------------------------------------------------------- pure helpers */

test('isValidSessionId rejects falsy, placeholder and short ids', () => {
  assert.equal(isValidSessionId(null), false);
  assert.equal(isValidSessionId(undefined), false);
  assert.equal(isValidSessionId(''), false);
  assert.equal(isValidSessionId('   '), false);
  // Route-param placeholders must never reach the backend.
  assert.equal(isValidSessionId('undefined'), false);
  assert.equal(isValidSessionId('null'), false);
  assert.equal(isValidSessionId('[id]'), false);
  assert.equal(isValidSessionId('abc123'), false); // 6 chars < 8
  assert.equal(isValidSessionId('sess_12345678'), true);
  assert.equal(isValidSessionId('  SESS_12345678  '), true);
});

test('formatBytes renders human units and rejects non-finite input', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1024 * 1024 * 1.5), '1.50 MB');
  assert.equal(formatBytes(null), null);
  assert.equal(formatBytes(undefined), null);
  assert.equal(formatBytes(NaN), null);
  assert.equal(formatBytes(-1), null);
  assert.equal(formatBytes(Infinity), null);
});

test('initialsOf derives initials and uses ? for empty input', () => {
  assert.equal(initialsOf(null), '?');
  assert.equal(initialsOf(undefined), '?');
  assert.equal(initialsOf(''), '?');
  assert.equal(initialsOf('   '), '?');
  assert.equal(initialsOf('ada'), 'AD');
  assert.equal(initialsOf('Ada Lovelace'), 'AL');
  assert.equal(initialsOf('  Ada   Lovelace  '), 'AL');
});

/* ------------------------------------ session persistence (localStorage) */

test('tokens are never readable from JavaScript, even in a browser', () => {
  installBrowserStubs();
  assert.equal(getAccessToken(), null);
  assert.equal(getRefreshToken(), null);
});

test('persistSession stores only display data under USER_KEY', () => {
  const { localStorage } = installBrowserStubs();
  persistSession('ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', {
    email: 'ada@example.com',
    role: 'candidate',
  });
  assert.equal(
    localStorage.getItem(USER_KEY),
    JSON.stringify({ email: 'ada@example.com', role: 'candidate' }),
  );
  // Tokens are HttpOnly cookies: nothing written to JS-visible storage.
  const writtenValues = [...localStorage._store.values()];
  assert.equal(
    writtenValues.some((value) => value.includes('ACCESS_TOKEN_SECRET')),
    false,
  );
  assert.equal(
    writtenValues.some((value) => value.includes('REFRESH_TOKEN_SECRET')),
    false,
  );
});

test('persistSession is a no-op on the server even if storage exists', () => {
  const localStorage = makeStorage();
  globalThis.localStorage = localStorage; // note: no window
  persistSession('at', 'rt', { email: 'ada@example.com' });
  assert.equal(localStorage.length, 0);
});

test('clearSession wipes USER_KEY, api_cache storages and the in-memory cache', async () => {
  const { localStorage, sessionStorage } = installBrowserStubs();

  // Seed the response cache through the real GET path (60s TTL for profile).
  const calls = stubFetch([['/api/candidate/profile', jsonResponse({ full_name: 'Ada' })]]);
  const first = await apiJson('/api/candidate/profile?unit=clear-session');
  assert.deepEqual(first, { full_name: 'Ada' });
  assert.equal(calls.length, 1);

  localStorage.setItem(USER_KEY, '{"email":"ada@example.com"}');
  localStorage.setItem('api_cache', '[["stale",{}]]');
  sessionStorage.setItem('api_cache', '[["stale",{}]]');

  clearSession();

  assert.equal(localStorage.getItem(USER_KEY), null);
  assert.equal(localStorage.getItem('api_cache'), null);
  assert.equal(sessionStorage.getItem('api_cache'), null);

  // The in-memory cache was cleared too: the same GET hits the network again.
  globalThis.fetch = async () => jsonResponse({ full_name: 'Ada Lovelace' });
  const second = await apiJson('/api/candidate/profile?unit=clear-session');
  assert.deepEqual(second, { full_name: 'Ada Lovelace' });
  assert.equal(calls.length, 1); // second fetch went through the new mock
});

/* ------------------------------------------------------ token refresh */

test('refreshAccessToken returns null on the server (no window)', async () => {
  assert.equal(await refreshAccessToken(), null);
});

test('refreshAccessToken posts to /api/auth/refresh and returns the cookie sentinel', async () => {
  installBrowserStubs();
  const calls = stubFetch([
    ['/api/auth/refresh', jsonResponse({ ok: true })],
  ]);
  assert.equal(await refreshAccessToken(), 'cookie');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/auth/refresh');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'include');
});

test('refreshAccessToken clears the stored session on HTTP failure and transport error', async () => {
  const { localStorage } = installBrowserStubs();

  // HTTP failure → null + session wiped.
  const httpCalls = stubFetch([['/api/auth/refresh', jsonResponse({ error: 'expired' }, 401)]]);
  persistSession(undefined, undefined, { email: 'ada@example.com' });
  assert.equal(await refreshAccessToken(), null);
  assert.equal(httpCalls.length, 1);
  assert.equal(localStorage.getItem(USER_KEY), null);

  // Transport failure (network down) → same contract.
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  persistSession(undefined, undefined, { email: 'ada@example.com' });
  assert.equal(await refreshAccessToken(), null);
  assert.equal(localStorage.getItem(USER_KEY), null);
});

test('concurrent refreshAccessToken calls collapse onto one in-flight request', async () => {
  installBrowserStubs();
  // Refresh tokens are single-use: N parallel refreshes with the same token
  // would invalidate each other, so the module must deduplicate.
  let resolveFetch;
  const calls = [];
  globalThis.fetch = (url, init) => {
    calls.push({ url: String(url), init });
    return new Promise((resolve) => {
      resolveFetch = () => resolve(jsonResponse({ ok: true }));
    });
  };

  const p1 = refreshAccessToken();
  const p2 = refreshAccessToken();
  assert.equal(calls.length, 1); // second caller joined the in-flight request

  resolveFetch();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 'cookie');
  assert.equal(r2, 'cookie');
});

/* ---------------------------------------------------------- apiFetch */

test('apiFetch returns a 401 untouched on the server (no refresh attempt)', async () => {
  const calls = stubFetch([
    ['/api/candidate/profile', jsonResponse({ error: 'nope' }, 401)],
  ]);
  const res = await apiFetch('/api/candidate/profile');
  assert.equal(res.status, 401);
  assert.equal(calls.length, 1);
});

test('apiFetch sets JSON Content-Type and forwards X-Support-Reason', async () => {
  installBrowserStubs();
  globalThis.sessionStorage.setItem('tp_support_reason', 'billing-issue');
  const calls = stubFetch([
    ['/api/candidate/notifications', jsonResponse({ ok: true })],
  ]);

  const res = await apiFetch('/api/candidate/notifications', {
    method: 'POST',
    body: JSON.stringify({ read: true }),
  });

  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.get('Content-Type'), 'application/json');
  assert.equal(calls[0].init.headers.get('X-Support-Reason'), 'billing-issue');
  assert.equal(calls[0].init.credentials, 'include');
});

test('apiFetch refreshes once and retries after a 401 on a data endpoint', async () => {
  installBrowserStubs();
  let dataCalls = 0;
  const calls = stubFetch([
    ['/api/auth/refresh', jsonResponse({ ok: true })],
    [
      '/api/candidate/profile-retry',
      () => {
        dataCalls += 1;
        return dataCalls === 1
          ? jsonResponse({ error: 'expired' }, 401)
          : jsonResponse({ full_name: 'Ada' });
      },
    ],
  ]);

  const res = await apiFetch('/api/candidate/profile-retry');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { full_name: 'Ada' });
  assert.equal(calls.length, 3); // 401 → refresh → retry
  assert.equal(calls[1].url, '/api/auth/refresh');
  assert.equal(calls[2].url, '/api/candidate/profile-retry');
  assert.equal(calls[2].init.credentials, 'include');
});

test('apiFetch does not attempt refresh for auth entrypoints (login 401 as-is)', async () => {
  installBrowserStubs();
  const calls = stubFetch([
    ['/api/auth/login', jsonResponse({ error: 'bad credentials' }, 401)],
  ]);
  const res = await apiFetch('/api/auth/login', { method: 'POST', body: '{}' });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 1); // no /api/auth/refresh call
});

test('apiFetch reports session_expired via a synthetic 401 when refresh fails', async () => {
  const { localStorage } = installBrowserStubs();
  persistSession(undefined, undefined, { email: 'ada@example.com' });
  stubFetch([
    ['/api/auth/refresh', jsonResponse({ error: 'gone' }, 401)],
    ['/api/candidate/notifications-expired', jsonResponse({ error: 'expired' }, 401)],
  ]);

  const res = await apiFetch('/api/candidate/notifications-expired');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error_code, 'session_expired');
  assert.match(body.error, /log in again/i);
  assert.equal(localStorage.getItem(USER_KEY), null); // session wiped
});

/* ---------------------------------------------------------- apiJson */

test('apiJson returns null for non-2xx, 204 and non-JSON responses', async () => {
  const calls = stubFetch([
    ['/api/t-json-500', jsonResponse({ error: 'boom' }, 500)],
    ['/api/t-json-204', new Response(null, { status: 204 })],
    [
      '/api/t-json-html',
      new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    ],
  ]);

  assert.equal(await apiJson('/api/t-json-500'), null);
  assert.equal(await apiJson('/api/t-json-204'), null);
  assert.equal(await apiJson('/api/t-json-html'), null);
  assert.equal(calls.length, 3);
});

test('apiJson caches successful GETs, honors skipCache, and never caches failures', async () => {
  const responses = [jsonResponse({ v: 1 }), jsonResponse({ v: 2 })];
  const calls = stubFetch([
    ['/api/candidate/profile?unit=cache', () => responses.shift()],
  ]);
  const path = '/api/candidate/profile?unit=cache'; // 60s TTL in getTtlForPath

  assert.deepEqual(await apiJson(path), { v: 1 }); // fetch #1
  assert.deepEqual(await apiJson(path), { v: 1 }); // served from cache
  assert.deepEqual(await apiJson(path, {}, { skipCache: true }), { v: 2 }); // fetch #2
  // skipCache bypasses the read but does not overwrite the stored entry.
  assert.deepEqual(await apiJson(path), { v: 1 });
  assert.equal(calls.length, 2);

  // A failing GET must never poison the cache.
  const failurePath = '/api/candidate/profile?unit=cache-failure';
  globalThis.fetch = async () => jsonResponse({ error: 'boom' }, 500);
  assert.equal(await apiJson(failurePath), null);
  assert.equal(await apiJson(failurePath), null); // not cached → null again, honestly
});

test('apiJson deduplicates concurrent identical GETs', async () => {
  const path = '/api/candidate/interviews?unit=dedup'; // 30s TTL
  let resolveFetch;
  const calls = [];
  globalThis.fetch = (url, init) => {
    calls.push({ url: String(url), init });
    return new Promise((resolve) => {
      resolveFetch = () => resolve(jsonResponse([{ id: 's1' }]));
    });
  };

  const p1 = apiJson(path);
  const p2 = apiJson(path);
  assert.equal(calls.length, 1); // second caller reuses the in-flight promise

  resolveFetch();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1, [{ id: 's1' }]);
  assert.deepEqual(r2, [{ id: 's1' }]);
});

test('apiJson returns null when a 401 cannot be refreshed (no invented data)', async () => {
  const { localStorage } = installBrowserStubs();
  persistSession(undefined, undefined, { email: 'ada@example.com' });
  const calls = stubFetch([
    ['/api/auth/refresh', jsonResponse({ error: 'gone' }, 401)],
    ['/api/candidate/skills?unit=session-expired', jsonResponse({ error: 'expired' }, 401)],
  ]);

  const result = await apiJson('/api/candidate/skills?unit=session-expired');
  assert.equal(result, null);
  assert.equal(calls.length, 2); // data 401 → refresh 401
  assert.equal(localStorage.getItem(USER_KEY), null);
});

test('apiJson returns refreshed data after a 401 on a data endpoint', async () => {
  installBrowserStubs();
  let dataCalls = 0;
  const calls = stubFetch([
    ['/api/auth/refresh', jsonResponse({ ok: true })],
    [
      '/api/candidate/skills?unit=refresh-retry',
      () => {
        dataCalls += 1;
        return dataCalls === 1
          ? jsonResponse({ error: 'expired' }, 401)
          : jsonResponse([{ name: 'TypeScript' }]);
      },
    ],
  ]);

  const result = await apiJson('/api/candidate/skills?unit=refresh-retry');
  assert.deepEqual(result, [{ name: 'TypeScript' }]);
  assert.equal(calls.length, 3); // 401 → refresh → retry
});

test('answer submission sends the complete transcript and request id unchanged', async () => {
  const calls = stubFetch([
    ['/api/interview/session-1/answer', jsonResponse({ ok: true })],
  ]);
  const completeAnswer = 'I designed the service. It processed payments reliably.';

  await answerInterviewQuestion('session-1', completeAnswer, 'question-1', 'answer:session-1:turn-1');

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    answer: completeAnswer,
    question_id: 'question-1',
    request_id: 'answer:session-1:turn-1',
  });
});

test('question timeout sends only the explicit in-memory partial response and question id', async () => {
  const calls = stubFetch([
    ['/api/interview/session-1/question-timeout', jsonResponse({ ok: true })],
  ]);

  await timeoutInterviewQuestion('session-1', 'question-2', 'partial transcript');

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    question_id: 'question-2',
    partial_answer: 'partial transcript',
  });
});
