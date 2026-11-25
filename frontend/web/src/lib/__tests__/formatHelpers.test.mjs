import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatAbsoluteDateTime, getIsoWeekNumber } from '../dateTime';
import { buildReportReference } from '../reportReference';
import {
  bonusCreditsForPack,
  checkoutProviderFor,
  formatCredits,
  formatInrFromCredits,
  formatRatePerMinute,
  minutesForCredits,
} from '../billing';
import {
  formatDemoLabel,
  formatPercentile,
  formatRecommendation,
} from '../formatters';
import { uniqueBy } from '../collections';

test('ISO week numbers match ISO-8601, including year boundaries', () => {
  assert.equal(getIsoWeekNumber(new Date(2026, 10, 23)), 48);
  assert.equal(getIsoWeekNumber(new Date(2021, 0, 1)), 53);
  assert.equal(getIsoWeekNumber(new Date(2024, 11, 30)), 1);
});

test('notification timestamps are absolute, not relative', () => {
  const formatted = formatAbsoluteDateTime('2026-11-17T08:30:00Z');
  assert.match(formatted, /2026/);
  assert.match(formatted, /Nov/);
  assert.doesNotMatch(formatted, /ago/i);
  assert.equal(formatAbsoluteDateTime(undefined), 'Date unavailable');
});

test('report references use metadata instead of the internal session id', () => {
  const reference = buildReportReference('2026-11-22T18:14:00Z', 'Senior Full-Stack Engineer');
  assert.equal(reference, 'PG-2026-SEN-FUL-ENG');
  assert.doesNotMatch(reference, /dd612247/i);
});

test('billing copy uses the API rate and explains bonus credits', () => {
  assert.equal(
    formatRatePerMinute(0.5),
    '₹0.50 / min (0.5 credits/min · 2 min/₹1)'
  );
  assert.equal(formatRatePerMinute(0), 'Rate unavailable');
  assert.equal(formatCredits(1), '1 credit');
  assert.equal(formatCredits(2), '2 credits');
  assert.equal(bonusCreditsForPack(50, 49), 1);
  assert.equal(bonusCreditsForPack(100, 99), 1);
  assert.equal(bonusCreditsForPack(1, 1), 0);
});

test('wallet display never advertises fractional credits or a fabricated rate', () => {
  assert.equal(formatCredits(2.5), '2 credits');
  assert.equal(formatInrFromCredits(2.5), '₹2');
  assert.equal(formatInrFromCredits(127.5), '₹127');
  assert.equal(formatRatePerMinute(null), 'Rate unavailable');
  assert.equal(minutesForCredits(10, 0.5), 20);
  assert.equal(minutesForCredits(10, null), null);
  assert.equal(checkoutProviderFor('upi'), 'upi-gateway');
  assert.equal(checkoutProviderFor('card'), 'razorpay');
  assert.equal(checkoutProviderFor('netbanking'), 'razorpay');
});

test('shared labels are consistent across candidate surfaces', () => {
  assert.equal(formatRecommendation('not_evaluated'), 'Not Evaluated');
  assert.equal(formatRecommendation(null), 'Not available yet');
  assert.equal(formatPercentile(29.2), '29.2 percentile');
  assert.equal(formatPercentile(null), '—');
  assert.equal(formatDemoLabel(2), 'Demo #2');
  assert.equal(formatDemoLabel(null), 'Demo interview');
});

test('uniqueBy keeps first occurrence and API order', () => {
  const rows = [
    { id: 'a', score: 1 },
    { id: 'b', score: 2 },
    { id: 'a', score: 3 },
  ];
  assert.deepEqual(uniqueBy(rows, (row) => row.id), [rows[0], rows[1]]);
});
