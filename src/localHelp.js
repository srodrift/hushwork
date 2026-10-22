// "Find the right local help" card. City level only today; state and federal
// levels are modeled but not built. Contacts verified by hand from official pages.

export const VERIFIED_ON = '2026-10-22';
export const LOOKUP = { label: 'Official SF district lookup (SF Planning)', url: 'https://sfplanninggis.org/sffind/' };

// Roster from https://sf.gov/sfbos, checked 2026-10-22. Contact details are only
// included where we opened that supervisor's official page.
export const SUPERVISORS = Object.freeze({
  1: { name: 'Connie Chan' }, 2: { name: 'Stephen Sherrill' }, 3: { name: 'Danny Sauter' }, 4: { name: 'Alan Wong' },
  5: { name: 'Bilal Mahmood' }, 6: { name: 'Matt Dorsey' }, 7: { name: 'Myrna Melgar' }, 8: { name: 'Rafael Mandelman' },
  9: {
    name: 'Jackie Fielder', phone: '415-554-5144', email: 'fielderstaff@sfgov.org',
    office: 'City Hall, Room 244, 1 Dr. Carlton B. Goodlett Place, San Francisco, CA 94102',
    contactForm: 'https://forms.gle/gDekFXa7kVkHLK2k9',
    source: 'https://www.sf.gov/district-9-supervisor-jackie-fielder',
  },
  10: { name: 'Shamann Walton' }, 11: { name: 'Chyanne Chen' },
});
export const ROSTER_SOURCE = 'https://sf.gov/sfbos';

// Levels of government, for later. Only "city" is implemented.
export const LEVELS = Object.freeze([
  { level: 'city', who: 'SF supervisor', for: 'City departments and neighborhood matters', built: true },
  { level: 'state', who: 'California state senator or Assembly member', for: 'State agencies (for example, state licensing)', built: false },
  { level: 'federal', who: 'U.S. senator or House representative', for: 'Federal agency casework. Often needs a signed privacy release; no guaranteed outcome.', built: false },
]);

export const FIRST_CONTACTS = Object.freeze([
  { when: 'Starting a business, leases, which permits you need', who: 'SF Office of Small Business', url: 'https://www.sf.gov/departments--office-economic-and-workforce-development--office-small-business/' },
  { when: 'Permits and change of use', who: 'SF Permit Center business services', url: 'https://www.sf.gov/information--permit-center-business-services' },
  { when: 'Food facility plan check', who: 'SF guide: building and remodeling a food facility', url: 'https://www.sf.gov/plan-check-guide-building-and-remodeling-food-facility' },
]);

// District from the city's own records for this exact address (permits and
// business registrations carry supervisor_district). Never from a neighborhood name.
export function districtFromRecords(snapshot) {
  if (!snapshot) return { status: 'unknown', reason: 'No city records pulled for this address.' };
  const vals = [];
  for (const [key, label] of [['permits', 'Building permits'], ['businesses', 'Business registrations']]) {
    for (const r of snapshot.sources?.[key]?.rows || []) if (r.supervisor_district) vals.push({ d: String(r.supervisor_district), from: label, url: snapshot.sources[key].queryUrl });
  }
  if (!vals.length) return { status: 'unknown', reason: 'The pulled records do not include a supervisor district.' };
  const distinct = [...new Set(vals.map((v) => v.d))];
  if (distinct.length > 1) return { status: 'conflicting', reason: `Records disagree (${distinct.join(', ')}).` };
  const from = [...new Set(vals.map((v) => v.from))];
  return { status: 'from_records', district: Number(distinct[0]), from, recordCount: vals.length, sources: [...new Set(vals.map((v) => v.url))], retrievedAt: snapshot.retrievedAt };
}

export function localHelpCard({ site, snapshot, supportedSiteId }) {
  const base = {
    lookup: LOOKUP, levels: LEVELS, firstContacts: FIRST_CONTACTS, verifiedOn: VERIFIED_ON, rosterSource: ROSTER_SOURCE,
    mayHelp: ['Finding the right city department when you are stuck', 'Following up on an unresolved local service issue', 'Referrals to small-business and community resources'],
    limits: ['Cannot guarantee grants or funding', 'Cannot skip or speed past permit requirements', 'Does not give immigration legal advice'],
  };
  if (!site || site.id !== supportedSiteId) {
    return { ...base, district: { status: 'unknown', reason: 'City records have not been pulled for this address. Use the official lookup.' }, supervisor: null };
  }
  const district = districtFromRecords(snapshot);
  const sup = district.status === 'from_records' ? SUPERVISORS[district.district] || null : null;
  return { ...base, district, supervisor: sup ? { district: district.district, ...sup, contactVerified: !!sup.source } : null };
}

// Editable draft. Uses only what the founder types plus the public address.
export function draftRequest({ issue, address, previousSteps, ask, supervisorName }) {
  const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return `Hello${supervisorName ? ` Supervisor ${clean(supervisorName, 60)}'s office` : ''},\n\n` +
    `I'm planning to open a small business at ${clean(address, 120)} and need help with: ${clean(issue, 300)}.\n\n` +
    `What I've already tried: ${clean(previousSteps, 500) || '(add what you have tried)'}\n\n` +
    `What I'm asking for: ${clean(ask, 400) || '(for example, a referral to the right department or contact)'}\n\n` +
    `Thank you.`;
}
