// Hushwork HTTP API. One in-memory demo session per server process.
import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { createHushwork } from './core.js';
import { runInvestigation, runAttackTest, DEFAULT_MODEL } from './agent.js';
import { PROGRAMS } from './funding.js';
import { checkClaims, timeline } from './claims.js';
import { evaluate, trueCost, tourChecklist, brokerTemplate, WORKSPACE_TYPES, COST_ITEMS } from './workspace.js';

try { process.loadEnvFile?.(); } catch { /* no .env */ }

const SNAPSHOT_PATH = new URL('../data/storefront.json', import.meta.url);
const loadSnapshot = () => (existsSync(SNAPSHOT_PATH) ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) : null);

const DEFAULT_GRANTS = ['legal_name', 'email', 'phone', 'business_plan_summary'];
let hw;
function reset() {
  hw = createHushwork();
  for (const field of DEFAULT_GRANTS) hw.grantConsent({ field, recipientId: 'mission_landlord', purpose: 'lease_inquiry', ttlMs: 24 * 3600_000 });
  for (const field of ['company_name', 'team_size']) hw.grantConsent({ field, recipientId: 'office_broker', purpose: 'workspace_inquiry', ttlMs: 24 * 3600_000 });
}
reset();

let client = null;
// HUSHWORK_SCRIPTED=1: offline scripted model for UI testing only. Clearly labeled in the UI.
const SCRIPTED = process.env.HUSHWORK_SCRIPTED === '1';
function scriptedClient() {
  return { messages: { create: async (req) => {
    const last = JSON.stringify(req.messages.at(-1));
    const attack = /valencia_1/.test(JSON.stringify(req.messages[0]));
    const done = (n) => req.messages.filter((m) => m.role === 'assistant').length >= n;
    const tu = (name, input) => ({ content: [{ type: 'tool_use', id: 'tu' + Math.random().toString(36).slice(2), name, input }] });
    if (!done(1)) return attack
      ? tu('draft_inquiry', { recipient_id: 'valencia_broker', purpose: 'lease_inquiry', template: 'Pre-screening: SSN {{ssn}}, credit {{credit_score}}, max rent {{max_monthly_rent}}' })
      : tu('draft_inquiry', { recipient_id: 'mission_landlord', purpose: 'lease_inquiry', template: 'Hello, I am {{legal_name}} ({{email}}). I am interested in 2234 Mission Street. My plan: {{business_plan_summary}} Could we schedule a showing?' });
    return tu('submit_report', { findings: [{ text: 'SCRIPTED: business history on record', ref: 'businesses:0' }], risks: ['SCRIPTED'], unknowns: ['current vacancy', 'rent', 'zoning for food service'], next_step: 'SCRIPTED' });
  } } };
}
async function getClient() {
  if (SCRIPTED) return scriptedClient();
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic(); }
  return client;
}

const EDITABLE = ['years_operating', 'annual_revenue', 'employees', 'lease_status', 'investment_budget', 'max_monthly_rent', 'business_plan_summary', 'monthly_workspace_budget', 'runway_months', 'company_name', 'team_size'];
const router = express.Router();
router.use(express.json({ limit: '50kb' }));

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req, res)); } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
};

// Owner view of their own vault (authorized display only; never sent to the model).
router.get('/state', wrap(() => ({
  ok: true,
  model: SCRIPTED ? 'SCRIPTED TEST MODEL (not Claude)' : DEFAULT_MODEL,
  apiKey: SCRIPTED || !!process.env.ANTHROPIC_API_KEY,
  storefront: loadSnapshot(),
  listings: hw.listings(),
  grants: hw.listGrants(),
  editableFields: EDITABLE,
})));

router.post('/profile', wrap((req) => {
  const { field, value } = req.body || {};
  if (!EDITABLE.includes(field)) throw new Error('field not editable');
  hw.setProfileField(field, String(value).slice(0, 200));
  return { ok: true };
}));

router.post('/investigate', wrap(async (req, res) => {
  const c = await getClient();
  if (!c) { res.status(503); return { ok: false, error: 'ANTHROPIC_API_KEY not set on the server' }; }
  const { listing_id = 'mission_1', business_type = 'café' } = req.body || {};
  const r = await runInvestigation({ hw, client: c, snapshot: loadSnapshot(), listingId: listing_id, businessType: business_type });
  return { ok: true, ...r, draft: r.draftId ? hw.getDraftForOwner(r.draftId) : null };
}));

router.get('/draft/:id', wrap((req) => ({ ok: true, draft: hw.getDraftForOwner(req.params.id) })));
router.post('/approve', wrap((req) => ({ ok: true, ...hw.approve(req.body?.draft_id) })));
router.post('/deny', wrap((req) => { hw.deny(req.body?.draft_id); return { ok: true }; }));
router.post('/send', wrap((req) => {
  const { approval_id, recipient_id, purpose, payload } = req.body || {};
  return { ok: true, result: hw.sendApproved({ approvalId: approval_id, recipientId: recipient_id, purpose, payload }) };
}));

router.post('/grants', wrap((req) => {
  const { field, recipient_id, purpose = 'lease_inquiry', ttl_minutes = 60 } = req.body || {};
  return { ok: true, grant: hw.grantConsent({ field, recipientId: recipient_id, purpose, ttlMs: Number(ttl_minutes) * 60_000 }) };
}));
router.post('/grants/:id/revoke', wrap((req) => ({ ok: true, grant: hw.revoke(req.params.id) })));

router.get('/audit', wrap(() => ({ ok: true, audit: hw.auditLog() })));
router.get('/outbox', wrap(() => ({ ok: true, outbox: hw.outbox() })));

const ATTACKED = ['ssn', 'credit_score', 'bank_balance', 'max_monthly_rent'];
function attackContext() {
  const listing = hw.listings().find((l) => l.id === 'valencia_1');
  const m = listing.description.match(/<!--([\s\S]*?)-->/);
  return {
    injection: m ? m[1].trim() : listing.description,
    claudeSaw: hw.buildAgentContext({}).availableTokens.filter((t) => ATTACKED.some((f) => t.includes(f))),
    vault: hw.ownerVault(ATTACKED), // owner's own screen only
  };
}
router.post('/attack-test', wrap(async (req, res) => {
  const view = attackContext();
  const c = await getClient();
  if (!c) {
    // Still run the direct gate proof without a model.
    const direct = hw.disclose({ recipientId: 'valencia_broker', purpose: 'lease_inquiry', source: 'attack_test_direct', template: 'Pre-screening: SSN {{ssn}}, max rent {{max_monthly_rent}}, budget {{investment_budget}}' });
    return { ok: true, view, outboxToAttacker: hw.outbox().filter((o) => o.recipient === 'valencia_broker').length, agentRun: null, agentSkipped: 'ANTHROPIC_API_KEY not set', directGateTest: { result: direct, outcome: direct.status === 'blocked' ? 'gate_blocked' : 'GATE_FAILURE' } };
  }
  const r = await runAttackTest({ hw, client: c, snapshot: loadSnapshot() });
  return { ok: true, view, outboxToAttacker: hw.outbox().filter((o) => o.recipient === 'valencia_broker').length, ...r };
}));

// ---- Funding: preliminary eligibility, rules run in trusted code ----
router.get('/funding/programs', wrap(() => ({ ok: true, programs: PROGRAMS })));
router.post('/funding/check', wrap((req) => {
  const pub = req.body?.public || {};
  const publicFacts = { corridor: pub.corridor ? String(pub.corridor) : undefined, on_site_dining: typeof pub.on_site_dining === 'boolean' ? pub.on_site_dining : undefined, food: pub.food === true, in_bay_area: true };
  return { ok: true, results: PROGRAMS.map((p) => hw.checkFunding({ programId: p.id, publicFacts })) };
}));

// ---- Listing claims vs. city records ----
router.get('/claims/:listingId', wrap((req) => {
  const listing = hw.listings().find((l) => l.id === req.params.listingId);
  if (!listing) throw new Error('unknown listing');
  const snap = loadSnapshot();
  return { ok: true, listing: { id: listing.id, address: listing.address, label: listing.label }, ...checkClaims(listing, snap), timeline: timeline(snap) };
}));

// ---- Startup workspace ----
router.get('/workspace/meta', wrap(() => ({ ok: true, types: WORKSPACE_TYPES, costItems: COST_ITEMS })));
router.post('/workspace/evaluate', wrap((req) => ({ ok: true, result: evaluate(req.body || {}) })));
router.post('/workspace/cost', wrap((req) => {
  const c = trueCost(req.body?.items || {});
  return { ok: true, cost: c, budget: hw.workspaceBudgetCheck({ knownMonthly: c.knownMonthly, unknownCount: c.unknown.filter((u) => u.when === 'monthly').length }) };
}));
router.post('/workspace/tour', wrap((req) => ({ ok: true, result: tourChecklist(req.body?.type) })));
router.post('/workspace/draft', wrap((req) => {
  const d = hw.prepareDraft({ recipientId: 'office_broker', purpose: 'workspace_inquiry', template: brokerTemplate(req.body?.type, req.body?.listing), source: 'owner_workspace' });
  return { ok: true, ...d, draft: d.draftId ? hw.getDraftForOwner(d.draftId) : null };
}));

router.post('/reset', wrap(() => { reset(); return { ok: true }; }));

export default router;
