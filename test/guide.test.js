import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, helpMeChoose, checklist, BUSINESS_TYPES, NEIGHBORHOODS } from '../src/guide.js';

const ev = JSON.parse(readFileSync(new URL('./fixtures/evidence.fake.json', import.meta.url)));
const sites = JSON.parse(readFileSync(new URL('../data/sites.json', import.meta.url))).sites;

test('business type changes what is compared, not just a label', () => {
  const bakery = compare({ evidence: ev, typeKey: 'bakery', keys: ['mission', 'excelsior', 'outersunset'], sites });
  const books = compare({ evidence: ev, typeKey: 'bookstore', keys: ['mission', 'excelsior', 'outersunset'], sites });
  assert.ok(bakery.signalsUsed.some((s) => s.key === 'food_permits'));
  assert.ok(!books.signalsUsed.some((s) => s.key === 'food_permits'));
  assert.ok(books.signalsNotUsed.some((s) => s.key === 'food_permits'));
  assert.notDeepEqual(bakery.neighborhoods[0].evidence, books.neighborhoods[0].evidence);
  assert.ok(bakery.type.needs.some((n) => /hood/i.test(n)));
});

test('missing or failed evidence is unknown, never zero', () => {
  const r = compare({ evidence: ev, typeKey: 'bakery', keys: ['mission'], sites });
  assert.equal(r.neighborhoods[0].evidence.sector_closures.status, 'unknown');
  const empty = compare({ evidence: null, typeKey: 'bakery', keys: ['mission'], sites });
  for (const v of Object.values(empty.neighborhoods[0].evidence)) assert.equal(v.status, 'unknown');
});

test('known evidence carries its query URL', () => {
  const r = compare({ evidence: ev, typeKey: 'bakery', keys: ['mission'], sites });
  assert.equal(r.neighborhoods[0].evidence.similar_active.value, 9);
  assert.equal(r.neighborhoods[0].evidence.similar_active.queryUrl, 'https://example/b');
});

test('rent, foot traffic and vacancy are always reported unknown', () => {
  const r = compare({ evidence: ev, typeKey: 'bakery', keys: ['mission'], sites });
  for (const w of ['rent', 'Foot traffic', 'vacancy']) assert.ok(r.alwaysUnknown.some((u) => u.toLowerCase().includes(w.toLowerCase())), w);
});

test('compare is capped at three neighborhoods and counts candidate storefronts', () => {
  const r = compare({ evidence: ev, typeKey: 'bakery', keys: ['mission', 'excelsior', 'outersunset', 'tenderloin'], sites });
  assert.equal(r.neighborhoods.length, 3);
  assert.equal(r.neighborhoods[0].candidateStorefronts, sites.filter((s) => s.corridor === 'mission').length);
});

test('help me choose: transparent single-signal sort; unknowns listed, not zeroed', () => {
  const h = helpMeChoose({ evidence: ev, typeKey: 'bakery', priority: 'buildout' });
  assert.equal(h.signal, 'food_permits');
  assert.deepEqual(h.picks, ['mission', 'tenderloin', 'outersunset']);
  assert.match(h.rule, /not a ranking/);
  assert.deepEqual(h.unknown, [], 'query succeeded: absent neighborhood is a real zero');
  const none = helpMeChoose({ evidence: null, typeKey: 'bakery', priority: 'buildout' });
  assert.deepEqual(none.picks, [], 'no evidence → no picks, not fake ones');
  assert.equal(none.unknown.length, Object.keys(NEIGHBORHOODS).length);
});

test('help me choose falls back for non-food types asking about buildout', () => {
  const h = helpMeChoose({ evidence: ev, typeKey: 'bookstore', priority: 'buildout' });
  assert.equal(h.signal, 'similar_active');
});

test('checklist differs by type and frames immigration as questions for an adviser', () => {
  const site = sites.find((s) => s.id === '2234-mission');
  const c = checklist({ typeKey: 'bakery', site });
  const text = JSON.stringify(c);
  assert.match(text, /block 3593, lot 006/);
  assert.match(text, /food facility/);
  const imm = c.sections.find((s) => /immigration/i.test(s.title));
  assert.match(imm.note, /does not decide/);
  assert.ok(imm.items.every((i) => i.link || i.text.endsWith('?')));
  assert.doesNotMatch(JSON.stringify(checklist({ typeKey: 'salon', site })), /food facility/);
});

test('every neighborhood key with storefronts has a mapping', () => {
  for (const s of sites) assert.ok(NEIGHBORHOODS[s.corridor], s.corridor);
  assert.ok(Object.keys(BUSINESS_TYPES).includes('bakery'));
});
