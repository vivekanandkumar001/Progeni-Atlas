import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  INDUSTRY_OPTIONS,
  INDUSTRY_TAXONOMY_VERSION,
  OTHER_INDUSTRY_OPTION,
  industryOptionForValue,
} from '../industry-taxonomy';

test('frontend taxonomy mirrors the 20 NAICS 2022 sectors plus custom', () => {
  assert.equal(INDUSTRY_TAXONOMY_VERSION, 'NAICS_2022');
  assert.equal(INDUSTRY_OPTIONS.length, 21);
  assert.equal(INDUSTRY_OPTIONS[0].code, '11');
  assert.equal(INDUSTRY_OPTIONS[19].code, '92');
  assert.equal(INDUSTRY_OPTIONS[20].code, OTHER_INDUSTRY_OPTION.code);
});

test('legacy free text falls back to the custom option', () => {
  assert.equal(industryOptionForValue('Information').code, '51');
  assert.equal(industryOptionForValue('Artificial Intelligence / SaaS').code, 'OTHER');
});
