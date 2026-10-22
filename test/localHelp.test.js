import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localHelpCard, districtFromRecords, draftRequest, LEVELS } from '../src/localHelp.js';

const snap = JSON.parse(readFileSync(new URL('../data/storefront.json', import.meta.url)));
const sites = JSON.parse(readFileSync(new URL('../data/sites.json', import.meta.url))).sites;
const s2234 = sites.find((s) => s.id === '2234-mission');

test('district comes from the city records for this address', () => {
  const d = districtFromRecords(snap);
  assert.equal(d.status, 'from_records');
  assert.equal(d.district, 9);
  assert.ok(d.recordCount > 1);
});

test('2234 Mission gets a verified supervisor contact with source and date', () => {
  const c = localHelpCard({ site: s2234, snapshot: snap, supportedSiteId: '2234-mission' });
  assert.equal(c.supervisor.name, 'Jackie Fielder');
  assert.ok(c.supervisor.contactVerified);
  assert.match(c.supervisor.source, /^https:\/\/www\.sf\.gov\//);
  assert.equal(c.verifiedOn, '2026-10-22');
  assert.ok(c.limits.some((l) => /immigration/.test(l)));
  assert.ok(c.firstContacts[0].who.includes('Office of Small Business'));
});

test('other storefronts: no guessed district, official lookup instead', () => {
  const other = sites.find((s) => s.id !== '2234-mission' && s.corridor === 'mission');
  const c = localHelpCard({ site: other, snapshot: snap, supportedSiteId: '2234-mission' });
  assert.equal(c.district.status, 'unknown');
  assert.equal(c.supervisor, null);
  assert.match(c.lookup.url, /sfplanninggis\.org\/sffind/);
});

test('conflicting or missing district data is never resolved by guessing', () => {
  const mixed = { sources: { permits: { rows: [{ supervisor_district: '9' }, { supervisor_district: '8' }] } } };
  assert.equal(districtFromRecords(mixed).status, 'conflicting');
  assert.equal(districtFromRecords(null).status, 'unknown');
});

test('draft uses only typed text and the address; state/federal marked not built', () => {
  const d = draftRequest({ issue: 'which permit I need for a bakery', address: '2234 Mission Street', previousSteps: 'Called the Permit Center', ask: 'a referral', supervisorName: 'Jackie Fielder' });
  assert.match(d, /2234 Mission Street/);
  assert.doesNotMatch(d, /\$|SSN|\{\{/);
  assert.deepEqual(LEVELS.filter((l) => l.built).map((l) => l.level), ['city']);
});
