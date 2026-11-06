import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const configPath = fileURLToPath(new URL('../../../next.config.ts', import.meta.url));

test('CSP allows fonts from the configured jsDelivr host', () => {
  const config = readFileSync(configPath, 'utf8');

  assert.match(config, /font-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.doesNotMatch(config, /cdn\.jsdelivr\.connect/);
});
