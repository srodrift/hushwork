// Live, keyword-based city-record search using the founder's own words.
// No mapping to fixed categories: each word is searched in registered business names.
import { NEIGHBORHOODS } from './guide.js';

const STOP = new Set(('i,me,my,we,our,want,wanna,would,like,to,open,start,a,an,the,and,also,with,which,that,has,have,having,plus,or,of,for,in,on,at,near,small,little,new,shop,shops,store,stores,spot,place,business,kind,sort,some,something,its,it,is,be,both,one,two,where,should,could,can,look,thinking,idea,combined,combo,inside,attached,san,francisco,sf')
  .split(','));
const FOOD = /coffee|cafe|café|espresso|tea|chai|boba|bake|bakery|bread|pastr|cake|donut|bagel|food|kitchen|restaurant|taco|pizza|momo|noodle|dumpling|burger|deli|grocer|juice|ice ?cream|dessert|sandwich|bar|brew|wine|cater/;

export function keywordsFrom(text) {
  const words = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z]+/g) || [];
  const out = [];
  for (let w of words) {
    if (w.length < 3 || STOP.has(w)) continue;
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (!out.includes(w)) out.push(w);
    if (out.length === 3) break;
  }
  return out;
}

export const isFood = (words) => words.some((w) => FOOD.test(w));

const NB = 'neighborhoods_analysis_boundaries';
// fetchImpl injectable for tests. Returns counts per neighborhood key for each word.
export async function liveCounts(words, { fetchImpl = fetch } = {}) {
  const byAnalysis = Object.fromEntries(Object.entries(NEIGHBORHOODS).map(([k, n]) => [n.analysis, k]));
  const results = [];
  for (const w of words.slice(0, 3)) {
    const safe = w.replace(/[^a-z]/g, '').toUpperCase();
    const where = `upper(dba_name) like '%${safe}%' AND location_end_date IS NULL AND upper(city)='SAN FRANCISCO'`;
    const queryUrl = `https://data.sfgov.org/resource/g8m3-pdis.json?$select=${NB},count(*) as n&$where=${encodeURIComponent(where)}&$group=${NB}&$limit=200`;
    try {
      const r = await fetchImpl(queryUrl, { headers: { Accept: 'application/json' } });
      if (!r.ok) { results.push({ word: w, ok: false, queryUrl, error: `HTTP ${r.status}` }); continue; }
      const rows = await r.json();
      const counts = {};
      for (const row of rows) { const k = byAnalysis[row[NB]]; if (k) counts[k] = Number(row.n); }
      results.push({ word: w, ok: true, queryUrl, counts });
    } catch (e) {
      results.push({ word: w, ok: false, queryUrl, error: e.message });
    }
  }
  return { retrievedAt: new Date().toISOString(), source: 'DataSF Registered Business Locations (live)', results };
}
