// Save one storefront's public DataSF records to data/storefront.json.
// Usage: npm run snapshot -- "2234 Mission Street"
import { writeFileSync } from 'node:fs';

const address = process.argv.slice(2).join(' ').trim();
const m = address.match(/^(\d+)\s+([A-Za-z0-9]+)/);
if (!m) { console.error('usage: npm run snapshot -- "<number> <street name>"'); process.exit(1); }
const [, number, streetWord] = m;
const street = streetWord.toUpperCase();

const SOURCES = [
  { key: 'businesses', id: 'g8m3-pdis', dataset: 'Registered Business Locations - San Francisco',
    where: `upper(full_business_address) like '${number} ${street}%' AND upper(city)='SAN FRANCISCO'`, order: 'dba_start_date DESC' },
  { key: 'permits', id: 'i98e-djp9', dataset: 'Building Permits',
    where: `street_number='${number}' AND upper(street_name)='${street}'`, order: 'permit_creation_date DESC' },
];

const out = {
  address, retrievedAt: new Date().toISOString(),
  note: 'Public records snapshot. Records show history, not current vacancy, rent, or zoning approval.',
  sources: {},
};

for (const s of SOURCES) {
  const queryUrl = `https://data.sfgov.org/resource/${s.id}.json?$where=${encodeURIComponent(s.where)}&$order=${encodeURIComponent(s.order)}&$limit=12`;
  let rows = [], ok = false, error;
  try {
    const r = await fetch(queryUrl, { headers: { Accept: 'application/json' } });
    ok = r.ok; rows = ok ? await r.json() : [];
  } catch (e) { error = e.message; }
  out.sources[s.key] = { dataset: s.dataset, datasetUrl: `https://data.sfgov.org/d/${s.id}`, queryUrl, ok, count: rows.length, rows, ...(error && { error }) };
  console.log(`${s.key}: ${ok ? rows.length + ' rows' : 'FAILED ' + (error || '')}`);
}

writeFileSync(new URL('../data/storefront.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('wrote data/storefront.json');
