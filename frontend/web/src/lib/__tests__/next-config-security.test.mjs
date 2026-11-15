import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const configPath = fileURLToPath(new URL('../../../next.config.ts', import.meta.url));

test('CSP excludes the unused jsDelivr CDN (supply-chain hardening)', () => {
  const config = readFileSync(configPath, 'utf8');

  assert.doesNotMatch(config, /script-src[^;]*cdn\.jsdelivr\.net/);
  assert.doesNotMatch(config, /style-src[^;]*cdn\.jsdelivr\.net/);
  assert.doesNotMatch(config, /font-src[^;]*cdn\.jsdelivr\.net/);
  assert.doesNotMatch(config, /connect-src[^;]*cdn\.jsdelivr\.net/);
});
