// Pull neighborhood-level public-records counts from DataSF for every business type.
// Usage: npm run neighborhoods   → writes data/neighborhood_evidence.json
// Every count keeps its query URL. Failures are recorded, never filled in.
import { writeFileSync } from 'node:fs';
import { BUSINESS_TYPES } from '../src/guide.js';

const BIZ = 'g8m3-pdis';     // Registered Business Locations - San Francisco
const PERMITS = 'i98e-djp9'; // Building Permits
const NB = 'neighborhoods_analysis_boundaries';

const now = new Date();
const iso = (d) => d.toISOString().slice(0, 19);
const threeYearsAgo = iso(new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grouped(dataset, where) {
  const qs = `$select=${NB},count(*) as n&$where=${encodeURIComponent(where)}&$group=${NB}&$limit=200`;
  const queryUrl = `https://data.sfgov.org/resource/${dataset}.json?${qs}`;
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(2500 * attempt);
    try {
      const r = await fetch(queryUrl, { headers: { Accept: 'application/json' } });
      const body = await r.text();
      if (r.status === 428 || r.status === 429 || r.status >= 500) { last = `${r.status} (throttled, retrying)`; continue; }
      if (!r.ok) return { ok: false, queryUrl, error: `${r.status} ${body.slice(0, 200)}` };
      const rows = JSON.parse(body);
      const counts = {};
      for (const row of rows) if (row[NB]) counts[row[NB]] = Number(row.n);
      await sleep(1200);
      return { ok: true, queryUrl, dataset, counts };
    } catch (e) { last = e.message; }
  }
  return { ok: false, queryUrl, error: `gave up after retries: ${last}` };
}

const nameWhere = (kws) => '(' + kws.map((k) => `upper(dba_name) like '%${k}%'`).join(' OR ') + ')';
const out = { retrievedAt: now.toISOString(), source: 'DataSF (data.sfgov.org)', datasets: { [BIZ]: 'Registered Business Locations - San Francisco', [PERMITS]: 'Building Permits' }, shared: {}, types: {} };

const log = (label, r) => console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${label}${r.ok ? ` (${Object.keys(r.counts).length} neighborhoods)` : ' ' + r.error}`);

// Shared: food-use permits since 2016 (same for every food type)
out.shared.food_permits = await grouped(PERMITS, `permit_creation_date >= '2016-01-01T00:00:00' AND (upper(existing_use) like '%FOOD%' OR upper(proposed_use) like '%FOOD%')`);
log('food_permits', out.shared.food_permits);

for (const [key, t] of Object.entries(BUSINESS_TYPES)) {
  const signals = {};
  const base = `${nameWhere(t.keywords)} AND upper(city)='SAN FRANCISCO'`;
  signals.similar_active = await grouped(BIZ, `${base} AND location_end_date IS NULL`);
  log(`${key}.similar_active`, signals.similar_active);
  if (t.signals.includes('sector_openings')) {
    signals.sector_openings = await grouped(BIZ, `${base} AND location_start_date >= '${threeYearsAgo}'`);
    log(`${key}.openings`, signals.sector_openings);
  }
  if (t.signals.includes('sector_closures')) {
    signals.sector_closures = await grouped(BIZ, `${base} AND location_end_date >= '${threeYearsAgo}'`);
    log(`${key}.closures`, signals.sector_closures);
  }
  out.types[key] = { keywords: t.keywords, signals };
}

writeFileSync(new URL('../data/neighborhood_evidence.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote data/neighborhood_evidence.json');
