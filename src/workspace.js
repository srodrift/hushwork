// Startup workspace guide. Rule-based fit reasoning and true-cost math over
// figures the founder enters. No invented prices: blank figures are unknown.

export const WORKSPACE_TYPES = Object.freeze({
  coworking_desk: { label: 'Coworking memberships (hot or dedicated desks)', commitment: 'Usually month to month', question: 'Do we need desks every day?' },
  private_office: { label: 'Private office in a coworking space', commitment: 'Often 1–12 months', question: 'Can we get privacy with less setup?' },
  sublease: { label: 'Sublease or shared office', commitment: 'Fixed to the remaining term of the original lease', question: 'What is included, and what restrictions apply?' },
  direct_lease: { label: 'Direct office lease', commitment: 'Commonly multi-year', question: 'Is the commitment justified by our needs?' },
  incubator: { label: 'Incubator or accelerator space', commitment: 'Tied to the program term', question: 'Are we eligible, and what obligations come with it?' },
});

export const COST_ITEMS = Object.freeze({
  rent: { label: 'Rent or membership', when: 'monthly' },
  utilities: { label: 'Utilities', when: 'monthly' },
  internet: { label: 'Internet', when: 'monthly' },
  meeting_rooms: { label: 'Meeting-room fees', when: 'monthly' },
  insurance: { label: 'Insurance', when: 'monthly' },
  other_monthly: { label: 'Other monthly fees', when: 'monthly' },
  deposit: { label: 'Security deposit', when: 'upfront' },
  furniture: { label: 'Furniture and setup', when: 'upfront' },
  other_upfront: { label: 'Other upfront costs', when: 'upfront' },
});

const has = (needs, n) => Array.isArray(needs) && needs.includes(n);

export function evaluate(p) {
  const teamNow = Math.max(1, Number(p.teamNow) || 1);
  const team12 = Math.max(teamNow, Number(p.team12) || teamNow);
  const days = Math.min(5, Math.max(0, Number(p.daysPerWeek) || 0));
  const maxCommit = Number(p.commitMonthsMax) || 0; // 0 = unspecified
  const growth = team12 / teamNow;
  const needs = p.needs || [];
  const peakDesks = Math.ceil(teamNow * Math.min(1, days / 5 + 0.2)); // rough peak attendance; shown as an estimate

  const out = {};
  for (const [key, t] of Object.entries(WORKSPACE_TYPES)) {
    const fit = [], concerns = [], unknowns = [], next = [];
    switch (key) {
      case 'coworking_desk':
        if (days <= 3) fit.push(`You come in ${days} day${days === 1 ? '' : 's'} a week, so paying for every desk every day may not be necessary.`);
        else concerns.push(`At ${days} days a week, daily desk fees can add up close to a private office.`);
        if (has(needs, 'privacy')) concerns.push('Open desks give little privacy for calls or confidential work.');
        if (has(needs, 'lab')) concerns.push('Coworking desks rarely support lab or equipment needs.');
        if (growth > 1.4) fit.push('Easy to add members as you hire.');
        unknowns.push('Phone booth and meeting-room availability at your peak days');
        next.push('Ask for a day pass and work there on your busiest day.');
        break;
      case 'private_office':
        fit.push('Lockable space without buying furniture or setting up internet.');
        if (has(needs, 'privacy')) fit.push('Matches your privacy need.');
        if (growth > 1.4) concerns.push(`You expect to grow from ${teamNow} to ${team12}. Ask whether you can move to a bigger office mid-term.`);
        if (has(needs, 'lab')) concerns.push('Most coworking offices do not allow lab equipment.');
        unknowns.push('Price to upgrade to a larger office', 'Meeting-room credits included per month');
        next.push('Ask for the price of the next size up today, not later.');
        break;
      case 'sublease':
        fit.push('Often furnished, sometimes below direct-lease prices.');
        if (maxCommit && maxCommit < 12) concerns.push('The remaining term may be longer than you want to commit.');
        concerns.push('You depend on the original tenant and the landlord’s consent.');
        unknowns.push('Remaining term of the master lease', 'Whether the landlord has approved subleasing', 'What happens if the original tenant defaults');
        next.push('Ask to see the landlord’s written consent and the master lease term.');
        break;
      case 'direct_lease':
        if (team12 >= 10 && days >= 4) fit.push('A stable team in the office most days is the case where a lease can make sense.');
        if (growth > 1.4) concerns.push('Hard to size a multi-year lease when your headcount may change a lot.');
        if (maxCommit && maxCommit < 36) concerns.push(`You said you'd commit at most ${maxCommit} months. Direct leases are commonly longer.`);
        concerns.push('Furniture, internet, and buildout are usually on you, and may need cash up front.');
        if (has(needs, 'lab')) fit.push('Lab or equipment needs may require a direct lease you can modify.');
        unknowns.push('Personal guarantee requirement', 'Who pays for improvements', 'Operating expenses beyond base rent');
        next.push('Ask whether a personal guarantee is required before you share any financials.');
        break;
      case 'incubator':
        fit.push('May include space, mentorship, and investor access.');
        concerns.push('Programs can take equity or have obligations. Read the terms.');
        unknowns.push('Eligibility for your stage and sector', 'Equity or fee terms', 'Application deadlines');
        next.push('List programs for your sector and check whether applications are currently open.');
        break;
    }
    if (has(needs, 'meeting_rooms')) unknowns.push('Meeting-room cost and availability');
    if (has(needs, 'accessibility')) unknowns.push('Step-free access, elevators, and accessible restrooms (verify on a tour)');
    out[key] = { key, ...t, fit, concerns, unknowns, next };
  }
  return { inputs: { teamNow, team12, daysPerWeek: days, commitMonthsMax: maxCommit || null, needs }, peakDesksEstimate: peakDesks, options: out };
}

// True cost. Blank items are unknown and are never counted as zero.
export function trueCost(items = {}) {
  let monthly = 0, upfront = 0;
  const known = [], unknown = [];
  for (const [key, def] of Object.entries(COST_ITEMS)) {
    const raw = items[key];
    const n = raw === '' || raw == null ? NaN : Number(String(raw).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && String(raw).trim() !== '') {
      known.push({ key, label: def.label, when: def.when, amount: n });
      if (def.when === 'monthly') monthly += n; else upfront += n;
    } else unknown.push({ key, label: def.label, when: def.when });
  }
  return { knownMonthly: monthly, knownUpfront: upfront, known, unknown, complete: unknown.length === 0 };
}

export function tourChecklist(typeKey) {
  const t = WORKSPACE_TYPES[typeKey];
  if (!t) throw new Error('unknown workspace type');
  const common = [
    'Visit on the day of the week your team is busiest.',
    'Test the internet speed and cell signal yourself.',
    'Ask for every fee in writing: deposit, utilities, internet, meeting rooms, insurance, after-hours access.',
    'Check commute time for each team member, and accessibility for anyone who needs it.',
    'Ask how and when you can leave, and what it costs.',
  ];
  const specific = {
    coworking_desk: ['Count free desks and phone booths at your peak hour.', 'Ask about guest policy and mail handling.'],
    private_office: ['Ask the price of the next size up and how fast you can move.', 'Ask what is included: furniture, cleaning, printing.'],
    sublease: ['See the landlord’s written consent to sublease.', 'Confirm the master lease end date.'],
    direct_lease: ['Ask whether a personal guarantee is required.', 'Ask who pays for improvements and operating expenses.'],
    incubator: ['Read the program terms: equity, fees, obligations.', 'Ask what happens to your space after the program ends.'],
  }[typeKey];
  return { title: `Tour checklist: ${t.label}`, items: [...specific, ...common] };
}

// Broker questions as a {{token}} template. Only company name and team size are
// referenced; budget and runway stay in the vault.
export function brokerTemplate(typeKey, listingName) {
  const t = WORKSPACE_TYPES[typeKey];
  if (!t) throw new Error('unknown workspace type');
  const name = String(listingName || 'your space').slice(0, 80);
  return `Hello, I'm writing on behalf of {{company_name}} ({{team_size}}). We're interested in ${name}. Could you share:\n` +
    `1. The full monthly cost, including utilities, internet, meeting rooms, and any other fees.\n` +
    `2. All upfront costs, including deposit.\n` +
    `3. The minimum commitment and how early exit works.\n` +
    `4. Whether a personal guarantee is required.\n` +
    `5. Available tour times this week.\nThank you.`;
}
