// "Ask Hushwork": a conversational guide grounded in the app's own tools.
// Private numbers typed into chat are redacted before the model sees them.
// Funding fit runs in trusted core code; the model receives only pass/fail/unknown.
import { DEFAULT_MODEL, scanForSecrets } from './agent.js';
import { BUSINESS_TYPES, NEIGHBORHOODS, compare } from './guide.js';
import { PROGRAMS } from './funding.js';
import { MARKET_RENT, estimateMonthly } from './market.js';
import { checkClaims } from './claims.js';

export function redact(text) {
  return String(text || '').slice(0, 1500)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ID number hidden]')
    .replace(/\$\s?\d[\d,]*(\.\d+)?\s?(k|K|m|M)?/g, '[amount hidden: use the private fields]')
    .replace(/\b\d{1,3}(,\d{3})+\b/g, '[amount hidden: use the private fields]');
}

const SYSTEM = `You are Hushwork, a warm, practical guide for people already living in the U.S. who want to open a small business in San Francisco, whether they spotted a storefront on a walk or are exploring from home.
Style: short (under 120 words), plain English, one question at a time. End EVERY reply with a line "OPTIONS: a | b | c" giving 2-4 short tap-able answers.
Ground every fact in a tool result. Never invent numbers. Spend per customer, revenue, profit, foot traffic and current vacancy are UNKNOWN: say so plainly and suggest how to find out (talk to nearby owners, count customers at peak hours, ask the landlord).
Business types we have city data for: ${Object.entries(BUSINESS_TYPES).map(([k, t]) => `${k} (${t.label})`).join(', ')}. Neighborhood keys: ${Object.entries(NEIGHBORHOODS).map(([k, n]) => `${k} (${n.name})`).join(', ')}.
Never ask the user to type private numbers (budget, revenue, SSN). If money matters, tell them to use the private fields in the Money step; check_funding reads those privately and returns only fit results.
You never apply for anything and never decide immigration eligibility. For immigration questions, point to a qualified adviser.
Full city records exist only for 2234 Mission Street (listing id mission_1).`;

const TOOLS = [
  { name: 'compare_neighborhoods', description: 'City-record counts for a business type in 1-3 neighborhoods.', input_schema: { type: 'object', properties: { type: { type: 'string' }, neighborhoods: { type: 'array', items: { type: 'string' } } }, required: ['type', 'neighborhoods'] } },
  { name: 'check_funding', description: 'Preliminary fit for verified grants, loans and free help, using the private vault. Returns only fit results, amounts and official links.', input_schema: { type: 'object', properties: { neighborhood: { type: 'string' }, food: { type: 'boolean' }, seating: { type: 'boolean' } }, required: ['food'] } },
  { name: 'market_rent', description: 'Citywide average asking retail rent turned into a monthly estimate for a size in sq ft.', input_schema: { type: 'object', properties: { sqft: { type: 'number' } }, required: ['sqft'] } },
  { name: 'check_listing', description: 'Compare the broker listing for 2234 Mission Street against city records.', input_schema: { type: 'object', properties: {} } },
];

export async function guideChat({ hw, client, evidence, snapshot, sites, history, context, model = DEFAULT_MODEL }) {
  const messages = (history || []).slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.role === 'assistant' ? String(m.content).slice(0, 2000) : redact(m.content) }))
    .filter((m) => m.content);
  if (!messages.length || messages[messages.length - 1].role !== 'user') throw new Error('send a user message');
  // What the user already chose on screen (public choices only; redacted like chat text).
  const ctx = context && typeof context === 'object' ? {
    business_types: (context.business_types || []).filter((k) => BUSINESS_TYPES[k]).slice(0, 2),
    idea_text: context.idea_text ? redact(String(context.idea_text).slice(0, 200)) : null,
    neighborhoods: (context.neighborhoods || []).filter((k) => NEIGHBORHOODS[k]).slice(0, 3),
    storefront: context.storefront ? String(context.storefront).slice(0, 80) : null,
    priority: ['buildout', 'similar', 'momentum'].includes(context.priority) ? context.priority : null,
  } : null;
  const system = ctx ? `${SYSTEM}\nWhat the user has already selected on screen (use it, consider ALL selected types together, don't ask again): ${JSON.stringify(ctx)}` : SYSTEM;
  const modelLog = [];
  const used = [];
  for (let turn = 0; turn < 5; turn++) {
    modelLog.push(JSON.parse(JSON.stringify(messages)));
    const res = await client.messages.create({ model, max_tokens: 700, system, tools: TOOLS, messages });
    messages.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      const m = text.match(/\n?OPTIONS:\s*(.+)\s*$/i);
      return { reply: m ? text.slice(0, m.index).trim() : text, options: m ? m[1].split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4) : [], toolsUsed: used, secretsInModelContext: scanForSecrets(hw, modelLog) };
    }
    const results = [];
    for (const u of uses) {
      let out;
      try {
        if (u.name === 'compare_neighborhoods') {
          const r = compare({ evidence, typeKey: BUSINESS_TYPES[u.input.type] ? u.input.type : 'bakery', keys: (u.input.neighborhoods || []).filter((k) => NEIGHBORHOODS[k]).slice(0, 3), sites });
          out = r.neighborhoods.map((n) => ({ neighborhood: n.name, ...Object.fromEntries(Object.entries(n.evidence).map(([k, v]) => [k, v.status === 'known' ? v.value : 'unknown'])) }));
          out = { counts: out, meaning: r.signalsUsed.map((s) => `${s.key}: ${s.label}`), unknown: r.alwaysUnknown };
        } else if (u.name === 'check_funding') {
          const pub = { corridor: NEIGHBORHOODS[u.input.neighborhood] ? u.input.neighborhood : undefined, food: !!u.input.food, on_site_dining: typeof u.input.seating === 'boolean' ? u.input.seating : undefined, in_bay_area: true };
          out = PROGRAMS.map((p) => { const c = hw.checkFunding({ programId: p.id, publicFacts: pub }); return { name: p.name, kind: p.kind, amount: p.amount, status: p.status, fit: c.match, failed_rules: c.results.filter((x) => x.result === 'fail').map((x) => x.label), link: p.apply || p.source }; });
        } else if (u.name === 'market_rent') {
          out = { estimate_per_month: estimateMonthly(u.input.sqft), basis: `${MARKET_RENT.scope} ${MARKET_RENT.basis}, $${MARKET_RENT.perSqFtYear}/sq ft/yr, ${MARKET_RENT.period}`, source: MARKET_RENT.url, caveats: MARKET_RENT.caveats };
        } else if (u.name === 'check_listing') {
          out = checkClaims(hw.listings().find((l) => l.id === 'mission_1'), snapshot).claims.map((c) => ({ claim: c.text, verdict: c.verdict, why: c.explanation }));
        } else out = { error: 'unknown tool' };
      } catch (e) { out = { error: e.message }; }
      used.push(u.name);
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out).slice(0, 6000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'I gathered a lot of information. Could you ask me one specific thing next?', options: ['Is this neighborhood a good fit?', 'What money could I get?', 'What should I do first?'], toolsUsed: used, secretsInModelContext: scanForSecrets(hw, modelLog) };
}
