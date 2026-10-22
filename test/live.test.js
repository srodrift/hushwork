import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordsFrom, isFood, liveCounts } from '../src/live.js';
import { checklist } from '../src/guide.js';

test('uses the founder\'s own words, no category mapping', () => {
  assert.deepEqual(keywordsFrom('I want to open a coffee shop which has a salon, a plant shop'), ['coffee', 'salon', 'plant']);
  assert.deepEqual(keywordsFrom('Nepali momo counter'), ['nepali', 'momo', 'counter']);
  assert.equal(isFood(['coffee', 'salon']), true);
  assert.equal(isFood(['salon', 'plant']), false);
});

test('live counts map city neighborhoods and keep failures as failures', async () => {
  const fetchImpl = async (url) => url.includes('COFFEE')
    ? { ok: true, json: async () => [{ neighborhoods_analysis_boundaries: 'Mission', n: '40' }, { neighborhoods_analysis_boundaries: 'Excelsior', n: '5' }] }
    : { ok: false, status: 500 };
  const r = await liveCounts(['coffee', 'salon'], { fetchImpl });
  assert.deepEqual(r.results[0].counts, { mission: 40, excelsior: 5 });
  assert.equal(r.results[1].ok, false);
  assert.match(r.results[0].queryUrl, /COFFEE/);
});

test('custom idea gets a generic, honest checklist', () => {
  const c = checklist({ typeKey: 'custom', custom: { label: 'coffee + salon + plant', food: true }, site: null });
  assert.match(c.title, /coffee \+ salon \+ plant/);
  assert.ok(JSON.stringify(c).includes('mixed uses'));
});
