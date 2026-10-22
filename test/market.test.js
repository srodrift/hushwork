import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_RENT, estimateMonthly } from '../src/market.js';
import { createHushwork } from '../src/core.js';

test('market rent is sourced, dated and labeled citywide', () => {
  assert.match(MARKET_RENT.url, /^https:\/\/kidder\.com\//);
  assert.equal(MARKET_RENT.checkedOn, '2026-10-22');
  assert.match(MARKET_RENT.scope, /citywide/);
  assert.ok(MARKET_RENT.caveats.some((c) => /neighborhood/.test(c)));
});

test('estimate math and bad input', () => {
  assert.equal(estimateMonthly(1200), Math.round(36.56 * 1200 / 12));
  assert.equal(estimateMonthly('abc'), null);
  assert.equal(estimateMonthly(0), null);
});

test('private max rent comparison is coarse and logs no values', () => {
  const hw = createHushwork(); // max rent $7,500
  assert.deepEqual(hw.marketRentCheck({ estimateMonthly: estimateMonthly(1200) }), { result: 'within' });
  assert.deepEqual(hw.marketRentCheck({ estimateMonthly: estimateMonthly(3000) }), { result: 'over' });
  assert.ok(!JSON.stringify(hw.auditLog()).includes('7,500'));
});
