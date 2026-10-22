// Guided location-selection API. Read-only over public data snapshots.
import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { localHelpCard, draftRequest } from './localHelp.js';
import { keywordsFrom, isFood, liveCounts } from './live.js';
import { BUSINESS_TYPES, NEIGHBORHOODS, SIGNALS, RESOURCES, compare, helpMeChoose, checklist } from './guide.js';

const EVIDENCE_PATH = process.env.HUSHWORK_EVIDENCE
  ? new URL(process.env.HUSHWORK_EVIDENCE, `file://${process.cwd()}/`)
  : new URL('../data/neighborhood_evidence.json', import.meta.url);
const SITES_PATH = new URL('../data/sites.json', import.meta.url);
const STOREFRONT_PATH = new URL('../data/storefront.json', import.meta.url);

const readJson = (u) => (existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')) : null);
const sites = () => readJson(SITES_PATH)?.sites || [];

// The only storefront with pulled records and the private agent wired up.
export const PRIVATE_AGENT_SITE = '2234-mission';

const router = express.Router();
router.use(express.json({ limit: '20kb' }));
const wrap = (fn) => (req, res) => { try { res.json({ ok: true, ...fn(req) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } };

router.get('/meta', wrap(() => {
  const ev = readJson(EVIDENCE_PATH);
  const sf = readJson(STOREFRONT_PATH);
  return {
    types: Object.entries(BUSINESS_TYPES).map(([key, t]) => ({ key, label: t.label, food: t.food })),
    neighborhoods: Object.entries(NEIGHBORHOODS).map(([key, n]) => ({ key, ...n, storefronts: sites().filter((s) => s.corridor === key).length })),
    sites: sites(),
    signals: SIGNALS,
    evidence: ev ? { present: true, retrievedAt: ev.retrievedAt, isFake: !!ev._note } : { present: false },
    privateAgentSite: PRIVATE_AGENT_SITE,
    storefrontRecords: sf ? {
      address: sf.address, retrievedAt: sf.retrievedAt,
      businesses: (sf.sources?.businesses?.rows || []).map((r) => ({ name: r.dba_name, start: (r.location_start_date || r.dba_start_date || '').slice(0, 10), end: (r.location_end_date || r.dba_end_date || '').slice(0, 10) || null })),
      permits: (sf.sources?.permits?.rows || []).map((r) => ({ type: r.permit_type_definition, description: r.description, created: (r.permit_creation_date || '').slice(0, 10), existingUse: r.existing_use || null, proposedUse: r.proposed_use || null })),
      sources: { businesses: sf.sources?.businesses?.datasetUrl, permits: sf.sources?.permits?.datasetUrl },
    } : null,
  };
}));

router.post('/compare', wrap((req) => ({ result: compare({ evidence: readJson(EVIDENCE_PATH), typeKey: req.body?.type, keys: Array.isArray(req.body?.keys) ? req.body.keys : [], sites: sites() }) })));
router.post('/help', wrap((req) => ({ result: helpMeChoose({ evidence: readJson(EVIDENCE_PATH), typeKey: req.body?.type, priority: req.body?.priority }) })));
router.post('/checklist', wrap((req) => {
  const site = sites().find((s) => s.id === req.body?.site_id) || null;
  return { result: checklist({ typeKey: req.body?.type, site, custom: req.body?.custom }), resources: RESOURCES };
}));

router.get('/local-help/:siteId', wrap((req) => {
  const site = sites().find((s) => s.id === req.params.siteId) || null;
  return { card: localHelpCard({ site, snapshot: readJson(STOREFRONT_PATH), supportedSiteId: PRIVATE_AGENT_SITE }) };
}));
// Draft only. Nothing is sent; no vault values are read.
router.post('/local-help/draft', wrap((req) => ({ draft: draftRequest(req.body || {}) })));

// Live search using the founder's own words (no category mapping). Cached 10 minutes.
const liveCache = new Map();
router.post('/live', async (req, res) => {
  try {
    const words = Array.isArray(req.body?.words) && req.body.words.length ? req.body.words.map((w) => String(w).toLowerCase().replace(/[^a-z]/g, '')).filter((w) => w.length >= 3).slice(0, 3) : keywordsFrom(req.body?.text);
    if (!words.length) return res.json({ ok: true, words: [], food: false, results: [] });
    const key = words.join(',');
    const hit = liveCache.get(key);
    const data = hit && Date.now() - hit.t < 600000 ? hit.data : await liveCounts(words);
    liveCache.set(key, { t: Date.now(), data });
    res.json({ ok: true, words, food: isFood(words), ...data });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

export default router;
