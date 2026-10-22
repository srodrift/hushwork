// Match our storefronts to San Francisco Commercial Vacancy Tax data by block/lot.
// Usage: npm run vacancy   → writes data/vacancy.json
// Schema-agnostic: reads the dataset's own metadata and column names, and reports them.
import { readFileSync, writeFileSync } from 'node:fs';

const ID = process.env.VACANCY_DATASET || 'rzkk-54yv';
const sites = JSON.parse(readFileSync(new URL('../data/sites.json', import.meta.url))).sites;

const meta = await fetch(`https://data.sfgov.org/api/views/${ID}.json`).then((r) => r.json()).catch(() => ({}));
console.log(`Dataset ${ID}: "${meta.name || 'unknown name'}" (updated ${meta.rowsUpdatedAt ? new Date(meta.rowsUpdatedAt * 1000).toISOString().slice(0, 10) : '?'})`);

const url = `https://data.sfgov.org/resource/${ID}.json?$limit=50000`;
const rows = await fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json());
if (!Array.isArray(rows) || !rows.length) { console.log('No rows returned:', JSON.stringify(rows).slice(0, 300)); process.exit(1); }
const cols = Object.keys(Object.assign({}, ...rows.slice(0, 200)));
console.log(`${rows.length} rows. Columns: ${cols.join(', ')}`);

const find = (re) => cols.find((c) => re.test(c));
const blockCol = find(/^block$|block_num|^blk/i), lotCol = find(/^lot$|lot_num/i);
const parcelCol = find(/parcel|apn|blklot|block_lot/i);
const vacCols = cols.filter((c) => /vacan/i.test(c));
const yearCol = find(/tax_year|year|period/i);
console.log(`Matching on: ${blockCol && lotCol ? `${blockCol}+${lotCol}` : parcelCol || 'NONE'} · vacancy columns: ${vacCols.join(', ') || 'NONE'} · year: ${yearCol || 'none'}`);

const norm = (s) => String(s || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
const keyOf = (r) => blockCol && lotCol ? norm(r[blockCol]).padStart(4, '0') + norm(r[lotCol]).padStart(3, '0') : norm(r[parcelCol]);
const index = new Map();
for (const r of rows) { const k = keyOf(r); if (!k) continue; if (!index.has(k)) index.set(k, []); index.get(k).push(r); }

const out = { dataset: ID, name: meta.name || null, datasetUrl: `https://data.sfgov.org/d/${ID}`, retrievedAt: new Date().toISOString(), columns: { block: blockCol, lot: lotCol, parcel: parcelCol, vacancy: vacCols, year: yearCol }, sites: {} };
let matched = 0;
for (const s of sites) {
  const k = norm(s.block).padStart(4, '0') + norm(s.lot).padStart(3, '0');
  const hits = index.get(k) || [];
  if (hits.length) matched++;
  out.sites[s.id] = hits.slice(0, 10).map((r) => ({ year: yearCol ? r[yearCol] : null, ...Object.fromEntries(vacCols.map((c) => [c, r[c]])) }));
}
console.log(`Storefronts with a filing: ${matched}/${sites.length}`);
writeFileSync(new URL('../data/vacancy.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote data/vacancy.json');
