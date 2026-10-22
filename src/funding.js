// Funding programs, verified by hand on 2026-10-22 from each program's own page
// (or the SF.gov grant finder). Status and rules can change: every card shows
// when it was checked and links to the source. A match here is preliminary.

export const CHECKED_ON = '2026-10-22';

// Criterion ops evaluated in trusted code against vault facts:
//   gte / lte  numeric compare      in   value in list      eq   equality
// `fact` names a vault field (private) or a public input (prefixed "public.").
export const PROGRAMS = Object.freeze([
  {
    id: 'sog',
    name: 'Storefront Opportunity Grant (SOG)',
    kind: 'grant',
    amount: '$50,000–$100,000 by category ($75,000 for a food or café business with limited or no seating)',
    status: 'unclear',
    statusNote: 'The program page says applications are closed, but also lists a portal open Feb 17 – May 29, 2026. Treat as not currently open; confirm with investsf@sfgov.org.',
    deadline: 'Last listed window: Feb 17 – May 29, 2026 (past)',
    source: 'https://www.sf.gov/apply-for-a-grant-to-open-a-new-storefront-lease',
    exclusions: ['Past SOG or Downtown Vibrancy Loan Fund recipients', 'Businesses relocating within San Francisco', 'Lease renewals'],
    instead: ['kiva', 'working_solutions', 'la_cocina', 'sfsbdc'],
    expenses: ['buildout', 'equipment'],
    criteria: [
      { fact: 'years_operating', op: 'gte', value: 3, label: 'Has operated for at least 3 years' },
      { fact: 'annual_revenue', op: 'lte', value: 5_000_000, label: 'Gross revenue $5M or less' },
      { fact: 'employees', op: 'lte', value: 100, label: '100 or fewer employees' },
      { fact: 'public.corridor', op: 'in', value: ['mission', 'bayview', 'downtown', 'fillmore'], label: 'New storefront in an eligible area (Bayview, Chinatown, Downtown, Mid-Market, Mission, Fillmore, some Port properties)' },
      { fact: 'lease_status', op: 'eq', value: 'signed_new', label: 'New lease starting Oct 1, 2025 or later (renewals ineligible)' },
    ],
    prepare: ['City business registration', 'Signed new lease', 'Proof of 3+ years of operation'],
  },
  {
    id: 'vacant_to_vibrant',
    name: 'Vacant to Vibrant',
    kind: 'grant + help',
    amount: 'Grants (amount not stated) plus help with leases, permits, insurance and marketing',
    status: 'open',
    statusNote: 'Listed as open, accepted on a rolling basis.',
    deadline: 'Rolling',
    source: 'https://www.vibrantsf.org/',
    instead: ['kiva', 'working_solutions'],
    expenses: ['buildout', 'working_capital'],
    criteria: [
      { fact: 'public.corridor', op: 'in', value: ['downtown'], label: 'Opening a new pop-up location in downtown San Francisco' },
    ],
    prepare: ['Pop-up concept description', 'Target downtown location'],
  },
  {
    id: 'accessible_barrier',
    name: 'Accessible Barrier Removal grant',
    kind: 'reimbursement',
    amount: 'Up to $10,000, as reimbursement (you pay first)',
    status: 'open',
    statusNote: 'Listed as open with rolling deadlines.',
    deadline: 'Rolling',
    source: 'https://www.sf.gov/apply-for-a-grant-to-make-your-business-accessible',
    instead: ['sfsbdc'],
    expenses: ['accessibility'],
    criteria: [
      { fact: 'lease_status', op: 'in', value: ['signed_new', 'signed'], label: 'Have a storefront to improve (signed lease)' },
    ],
    prepare: ['Accessibility improvement quotes', 'Cash to pay before reimbursement'],
  },
  {
    id: 'dishwashing',
    name: 'Automatic Dishwashing Grant (SF Environment)',
    kind: 'grant',
    amount: 'Up to $2,500 toward leasing or buying an automatic dishwasher',
    status: 'not_stated',
    statusNote: 'The city grant finder does not state whether it is open.',
    deadline: 'Not stated',
    source: 'https://www.sfenvironment.org/incentives-automatic-dishwashers',
    expenses: ['equipment'],
    criteria: [
      { fact: 'public.on_site_dining', op: 'eq', value: true, label: 'Food service with on-site dining' },
    ],
    prepare: ['Dishwasher quote', 'Plan to switch from disposable to reusable foodware (priority)'],
  },
  {
    id: 'la_cocina',
    name: 'La Cocina incubator',
    kind: 'non-cash help',
    amount: 'Affordable commercial kitchen space, training, 1:1 mentorship, sales connections',
    status: 'open_unverified',
    statusNote: 'Application page exists. Formal eligibility is not listed on the homepage; it focuses on working-class food entrepreneurs, especially women, immigrants and people of color.',
    deadline: 'Not stated',
    source: 'https://www.lacocinasf.org/how-the-program-works',
    expenses: ['planning', 'buildout'],
    apply: 'https://www.lacocinasf.org/apply',
    criteria: [
      { fact: 'public.food', op: 'eq', value: true, label: 'Food business' },
    ],
    prepare: ['Your food product and story', 'Read how the program works before applying'],
  },
  {
    id: 'sf_shines_equipment',
    name: 'SF Shines Equipment Grant',
    kind: 'grant',
    amount: 'Up to $10,000 for equipment',
    status: 'closed',
    statusNote: 'Listed as closed.',
    deadline: 'Closed',
    source: 'https://www.sf.gov/apply-for-an-sf-shines-equipment-grant/',
    instead: ['kiva', 'working_solutions'],
    expenses: ['equipment'],
    criteria: [
      { fact: 'lease_status', op: 'in', value: ['signed_new', 'signed'], label: 'Commercially zoned storefront' },
    ],
    prepare: ['Watch for the next round'],
  },
  {
    id: 'kiva',
    name: 'Kiva microloan',
    kind: 'loan',
    amount: 'Up to $15,000 at 0% interest',
    status: 'not_stated',
    statusNote: 'The city loans page does not state a deadline; Kiva lists borrowing on its site.',
    deadline: 'Not stated',
    source: 'https://www.sf.gov/information--loans-and-borrowing-money-your-business',
    apply: 'https://www.kiva.org/borrow',
    criteria: [
      { fact: 'public.in_bay_area', op: 'eq', value: true, label: 'Bay Area small business or start-up (limited experience or poor credit history allowed, per SF.gov)' },
    ],
    expenses: ['equipment', 'buildout', 'working_capital'],
    prepare: ['Short business description and use of funds', 'A plan to repay', 'Read Kiva’s borrower requirements on its site'],
  },
  {
    id: 'working_solutions',
    name: 'Working Solutions small business loans',
    kind: 'loan',
    amount: '$5,000–$100,000, plus one-on-one support',
    status: 'not_stated',
    statusNote: 'The city loans page does not state a deadline.',
    deadline: 'Not stated',
    source: 'https://www.sf.gov/information--loans-and-borrowing-money-your-business',
    apply: 'http://www.workingsolutions.org/',
    criteria: [
      { fact: 'public.in_bay_area', op: 'eq', value: true, label: 'New or existing business in one of nine Bay Area counties (SF.gov notes ITIN holders and non-U.S. residents are included)' },
    ],
    expenses: ['equipment', 'buildout', 'working_capital'],
    prepare: ['Business plan and use of funds', 'ID or ITIN', 'Ask what collateral or credit history they need'],
  },
  {
    id: 'pcv',
    name: 'Pacific Community Ventures loans',
    kind: 'loan',
    amount: 'Up to $500,000',
    status: 'not_stated',
    statusNote: 'The city loans page does not state a deadline.',
    deadline: 'Not stated',
    source: 'https://www.sf.gov/information--loans-and-borrowing-money-your-business',
    apply: 'https://www.pacificcommunityventures.org/small-business-loans/',
    criteria: [
      { fact: 'years_operating', op: 'gte', value: 1, label: 'At least 12 months in business' },
    ],
    expenses: ['equipment', 'buildout', 'working_capital'],
    prepare: ['12 months of financial records'],
    instead: ['kiva', 'working_solutions'],
  },
  {
    id: 'sfsbdc',
    name: 'SF Small Business Development Center',
    kind: 'free help',
    amount: 'Consultant to help decide whether a loan fits, plan your business, and build credit',
    status: 'not_stated',
    statusNote: 'The SF.gov page does not say whether advising is free; ask when you contact them.',
    deadline: 'None',
    source: 'https://www.sf.gov/information--loans-and-borrowing-money-your-business',
    apply: 'https://www.sfsbdc.org/',
    criteria: [],
    expenses: ['planning'],
    prepare: ['Your questions about funding, credit and your business plan'],
  },
]);

const num = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, ''));

export function evalCriterion(c, getFact) {
  const raw = getFact(c.fact);
  if (raw === undefined || raw === null || raw === '' || raw === 'unknown') return 'unknown';
  switch (c.op) {
    case 'gte': return Number.isFinite(num(raw)) && String(raw).trim() !== '' ? (num(raw) >= c.value ? 'pass' : 'fail') : 'unknown';
    case 'lte': return Number.isFinite(num(raw)) && String(raw).trim() !== '' ? (num(raw) <= c.value ? 'pass' : 'fail') : 'unknown';
    case 'in': return c.value.includes(raw) ? 'pass' : 'fail';
    case 'eq': return raw === c.value ? 'pass' : 'fail';
    default: return 'unknown';
  }
}

// Combine: any fail → likely_not_eligible; all pass → may_be_eligible; else needs_info.
export function summarize(results, status) {
  const fails = results.filter((r) => r.result === 'fail');
  const unknowns = results.filter((r) => r.result === 'unknown');
  let match = fails.length ? 'likely_not_eligible' : unknowns.length ? 'needs_info' : 'may_be_eligible';
  const openNow = status === 'open' || status === 'open_unverified';
  return { match, openNow, fails: fails.length, unknowns: unknowns.length };
}
