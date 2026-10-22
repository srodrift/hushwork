import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHushwork } from '../src/core.js';
import { PROGRAMS } from '../src/funding.js';
import { checkClaims } from '../src/claims.js';
import { DEMO_LISTINGS } from '../src/listings.js';

const pub = { corridor: 'mission', on_site_dining: true, food: true };

test('first-time founder: SOG is likely not eligible because of the 3-year rule', () => {
  const hw = createHushwork();
  const r = hw.checkFunding({ programId: 'sog', publicFacts: pub });
  assert.equal(r.match, 'likely_not_eligible');
  assert.equal(r.results.find((x) => /3 years/.test(x.label)).result, 'fail');
  assert.equal(r.results.find((x) => /eligible area/.test(x.label)).result, 'pass');
  assert.equal(r.openNow, false, 'unclear status is never shown as open');
});

test('eligibility results carry only pass/fail/unknown, never vault values', () => {
  const hw = createHushwork();
  const all = PROGRAMS.map((p) => hw.checkFunding({ programId: p.id, publicFacts: pub }));
  const text = JSON.stringify(all) + JSON.stringify(hw.auditLog());
  for (const v of hw._vaultValuesForTests()) assert.ok(!text.includes(v), v);
  for (const r of all) for (const c of r.results) assert.ok(['pass', 'fail', 'unknown'].includes(c.result));
});

test('changing private facts changes the result (experienced operator)', () => {
  const hw = createHushwork();
  hw.setProfileField('years_operating', '4');
  hw.setProfileField('lease_status', 'signed_new');
  assert.equal(hw.checkFunding({ programId: 'sog', publicFacts: pub }).match, 'may_be_eligible');
});

test('missing facts are unknown, not pass', () => {
  const hw = createHushwork();
  const r = hw.checkFunding({ programId: 'sog', publicFacts: {} });
  assert.equal(r.results.find((x) => /eligible area/.test(x.label)).result, 'unknown');
  assert.equal(hw.checkFunding({ programId: 'dishwashing', publicFacts: {} }).results[0].result, 'unknown');
  assert.equal(hw.checkFunding({ programId: 'dishwashing', publicFacts: { on_site_dining: false } }).results[0].result, 'fail');
  hw.setProfileField('employees', '');
  assert.equal(hw.checkFunding({ programId: 'sog', publicFacts: pub }).results.find((x) => /employees/.test(x.label)).result, 'unknown');
});

test('closed programs are never open; every program has a source and check date', () => {
  for (const p of PROGRAMS) { assert.match(p.source, /^https:\/\//); }
  const hw = createHushwork();
  assert.equal(hw.checkFunding({ programId: 'sf_shines_equipment', publicFacts: pub }).openNow, false);
  assert.equal(hw.checkFunding({ programId: 'la_cocina', publicFacts: pub }).checkedOn, '2026-10-22');
});

const snap = JSON.parse(readFileSync(new URL('../data/storefront.json', import.meta.url)));

test('claims: "available now" conflicts with an open registration, cited, and hedged', () => {
  const r = checkClaims(DEMO_LISTINGS.mission_1, snap);
  const c = r.claims.find((x) => x.kind === 'available');
  assert.equal(c.verdict, 'conflicts_with_records');
  assert.match(c.explanation, /not proof/);
  assert.match(c.evidence.url, /^https:\/\/data\.sfgov\.org/);
});

test('claims: café-ready is only partly supported by past food permits; rent has no record', () => {
  const r = checkClaims(DEMO_LISTINGS.mission_1, snap);
  assert.equal(r.claims.find((x) => x.kind === 'food_ready').verdict, 'partly_supported');
  assert.equal(r.claims.find((x) => x.kind === 'rent').verdict, 'no_public_record');
});

test('claims: without records every claim is no_public_record', () => {
  const r = checkClaims(DEMO_LISTINGS.mission_1, null);
  assert.ok(r.claims.every((c) => c.verdict === 'no_public_record'));
});

test('first-time founder: startup loans may fit; 12-month lender does not, with alternatives', () => {
  const hw = createHushwork();
  const pubBA = { ...pub, in_bay_area: true };
  assert.equal(hw.checkFunding({ programId: 'kiva', publicFacts: pubBA }).match, 'may_be_eligible');
  assert.equal(hw.checkFunding({ programId: 'pcv', publicFacts: pubBA }).match, 'likely_not_eligible');
  assert.deepEqual(PROGRAMS.find((p) => p.id === 'pcv').instead, ['kiva', 'working_solutions']);
  for (const p of PROGRAMS) for (const i of p.instead || []) assert.ok(PROGRAMS.some((x) => x.id === i), i);
});

test('timeline: dated, newest first, open registrations flagged, caution included', async () => {
  const { timeline } = await import('../src/claims.js');
  const t = timeline(snap);
  assert.ok(t.events.length > 5);
  const dated = t.events.filter((e) => e.date);
  for (let i = 1; i < dated.length; i++) assert.ok(dated[i - 1].date >= dated[i].date);
  assert.ok(t.events.some((e) => e.kind === 'registration_open'));
  assert.match(t.caution, /not that it occupied/);
});
