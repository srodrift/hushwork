import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHushwork } from '../src/core.js';
import { evaluate, trueCost, tourChecklist, brokerTemplate } from '../src/workspace.js';

test('inputs change the advice: part-time team favors desks, full-time flags cost', () => {
  const part = evaluate({ teamNow: 6, team12: 10, daysPerWeek: 2 });
  const full = evaluate({ teamNow: 6, team12: 10, daysPerWeek: 5 });
  assert.ok(part.options.coworking_desk.fit.some((f) => /2 days a week/.test(f)));
  assert.ok(full.options.coworking_desk.concerns.some((c) => /5 days a week/.test(c)));
});

test('fast growth and short commitment raise direct-lease concerns', () => {
  const r = evaluate({ teamNow: 4, team12: 12, daysPerWeek: 4, commitMonthsMax: 12 });
  const c = r.options.direct_lease.concerns.join(' ');
  assert.match(c, /headcount/);
  assert.match(c, /at most 12 months/);
});

test('needs are reflected (privacy, lab, accessibility)', () => {
  const r = evaluate({ teamNow: 5, daysPerWeek: 3, needs: ['privacy', 'lab', 'accessibility'] });
  assert.ok(r.options.coworking_desk.concerns.some((c) => /privacy/.test(c)));
  assert.ok(r.options.private_office.concerns.some((c) => /lab/.test(c)));
  assert.ok(r.options.direct_lease.unknowns.some((u) => /Step-free/.test(u)));
});

test('true cost: blank items are unknown, never zero; upfront kept separate', () => {
  const c = trueCost({ rent: '$4,500', deposit: '9000', internet: '', utilities: undefined });
  assert.equal(c.knownMonthly, 4500);
  assert.equal(c.knownUpfront, 9000);
  assert.ok(c.unknown.some((u) => u.key === 'internet'));
  assert.ok(c.unknown.some((u) => u.key === 'utilities'));
  assert.equal(c.complete, false);
  const zero = trueCost({ internet: '0' });
  assert.ok(zero.known.some((k) => k.key === 'internet' && k.amount === 0), 'an explicit 0 is known');
});

test('private budget check is coarse and flags remaining unknowns', () => {
  const hw = createHushwork(); // budget $9,000
  assert.deepEqual(hw.workspaceBudgetCheck({ knownMonthly: 7000, unknownCount: 2 }), { result: 'within_so_far' });
  assert.deepEqual(hw.workspaceBudgetCheck({ knownMonthly: 7000, unknownCount: 0 }), { result: 'within' });
  assert.deepEqual(hw.workspaceBudgetCheck({ knownMonthly: 9500, unknownCount: 0 }), { result: 'over' });
  assert.ok(!JSON.stringify(hw.auditLog()).includes('9,000'));
});

test('broker draft releases company and team size only; budget and runway cannot be sent', () => {
  const hw = createHushwork();
  for (const f of ['company_name', 'team_size']) hw.grantConsent({ field: f, recipientId: 'office_broker', purpose: 'workspace_inquiry', ttlMs: 3600_000 });
  const d = hw.prepareDraft({ recipientId: 'office_broker', purpose: 'workspace_inquiry', template: brokerTemplate('private_office', 'Example Space') });
  assert.equal(d.status, 'awaiting_approval');
  const card = hw.getDraftForOwner(d.draftId);
  assert.deepEqual(card.includedFields.sort(), ['company_name', 'team_size']);
  assert.ok(card.excludedFields.includes('monthly_workspace_budget'));
  assert.ok(card.excludedFields.includes('runway_months'));
  const leak = hw.prepareDraft({ recipientId: 'office_broker', purpose: 'workspace_inquiry', template: 'Budget {{monthly_workspace_budget}}, runway {{runway_months}}' });
  assert.equal(leak.status, 'blocked');
  // A workspace grant does not open the storefront landlord path
  assert.equal(hw.prepareDraft({ recipientId: 'mission_landlord', purpose: 'workspace_inquiry', template: '{{company_name}}' }).status, 'blocked');
});

test('tour checklist is specific to the workspace type', () => {
  assert.match(tourChecklist('sublease').items.join(' '), /consent to sublease/);
  assert.doesNotMatch(tourChecklist('coworking_desk').items.join(' '), /sublease/);
});
