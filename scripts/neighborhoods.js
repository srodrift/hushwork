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

async function grouped(dataset, where) {
  const qs = `$select=${NB},count(*) as n&$where=${encodeURIComponent(where)}&$group=${NB}&$limit=200`;
  const queryUrl = `https://data.sfgov.org/resource/${dataset}.json?${qs}`;
  try {
    const r = await fetch(queryUrl, { headers: { Accept: 'application/json' } });
    const body = await r.text();
    if (!r.ok) return { ok: false, queryUrl, error: `${r.status} ${body.slice(0, 200)}` };
    const rows = JSON.parse(body);
    const counts = {};
    for (const row of rows) if (row[NB]) counts[row[NB]] = Number(row.n);
    return { ok: true, queryUrl, dataset, counts };
  } catch (e) {
    return { ok: false, queryUrl, error: e.message };
  }
}

const nameWhere = (kws) => '(' + kws.map((k) => `upper(dba_name) like '%${k}%'`).join(' OR ') + ')';
const sectorWhere = { food: `naic_code_description like '%Food%'`, retail: `naic_code_description like '%Retail%'` };

const out = { retrievedAt: now.toISOString(), source: 'DataSF (data.sfgov.org)', datasets: { [BIZ]: 'Registered Business Locations - San Francisco', [PERMITS]: 'Building Permits' }, shared: {}, types: {} };

const log = (label, r) => console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${label}${r.ok ? ` (${Object.keys(r.counts).length} neighborhoods)` : ' ' + r.error}`);

// Shared: food-use permits since 2016 (same for every food type)
out.shared.food_permits = await grouped(PERMITS, `permit_creation_date >= '2016-01-01T00:00:00' AND (upper(existing_use) like '%FOOD%' OR upper(proposed_use) like '%FOOD%')`);
log('food_permits', out.shared.food_permits);

const sectorCache = {};
for (const [key, t] of Object.entries(BUSINESS_TYPES)) {
  const signals = {};
  signals.similar_active = await grouped(BIZ, `${nameWhere(t.keywords)} AND location_end_date IS NULL AND upper(city)='SAN FRANCISCO'`);
  log(`${key}.similar_active`, signals.similar_active);
  if (sectorWhere[t.sector]) {
    if (!sectorCache[t.sector]) {
      sectorCache[t.sector] = {
        sector_openings: await grouped(BIZ, `${sectorWhere[t.sector]} AND location_start_date >= '${threeYearsAgo}'`),
        sector_closures: await grouped(BIZ, `${sectorWhere[t.sector]} AND location_end_date >= '${threeYearsAgo}'`),
      };
      log(`${t.sector}.openings`, sectorCache[t.sector].sector_openings);
      log(`${t.sector}.closures`, sectorCache[t.sector].sector_closures);
    }
    Object.assign(signals, sectorCache[t.sector]);
  }
  out.types[key] = { keywords: t.keywords, signals };
}

writeFileSync(new URL('../data/neighborhood_evidence.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote data/neighborhood_evidence.json');
