import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { copyTextToClipboard } from '../clipboard';

const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function restoreGlobals() {
  for (const [name, descriptor] of [
    ['document', savedDocument],
    ['navigator', savedNavigator],
  ]) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

function makeDocument({ execCommandResult = true, throwOnCreate = false } = {}) {
  const appended = [];
  const removed = [];
  return {
    appended,
    removed,
    createElement: () => {
      if (throwOnCreate) throw new Error('DOM unavailable');
      return {
        value: '',
        style: {},
        setAttribute() {},
        select() {},
      };
    },
    body: {
      appendChild: (node) => appended.push(node),
      removeChild: (node) => removed.push(node),
    },
    execCommand: () => execCommandResult,
  };
}

after(() => {
  restoreGlobals();
});

test('copyTextToClipboard uses the async Clipboard API when available', async () => {
  const written = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async (value) => written.push(value) } },
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: makeDocument() });

  assert.equal(await copyTextToClipboard('https://atlas.progeni.live/report'), true);
  assert.deepEqual(written, ['https://atlas.progeni.live/report']);
});

test('copyTextToClipboard falls back to selection when the async API rejects', async () => {
  const doc = makeDocument({ execCommandResult: true });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async () => { throw new Error('blocked'); } } },
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });

  assert.equal(await copyTextToClipboard('share-link'), true);
  assert.equal(doc.appended.length, 1);
  assert.equal(doc.appended[0].value, 'share-link');
  assert.deepEqual(doc.removed, doc.appended);
});

test('copyTextToClipboard reports failure honestly when no fallback succeeds', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: makeDocument({ execCommandResult: false }),
  });

  assert.equal(await copyTextToClipboard('share-link'), false);

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: makeDocument({ throwOnCreate: true }),
  });
  assert.equal(await copyTextToClipboard('share-link'), false);
});

test('copyTextToClipboard fails closed outside a browser', async () => {
  delete globalThis.document;
  assert.equal(await copyTextToClipboard('share-link'), false);
});
