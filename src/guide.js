// Hushwork guide: business-type profiles, neighborhood comparison, checklist.
// Pure functions over a public-records evidence snapshot. No invented numbers:
// anything we do not have a record for is returned as { status: 'unknown' }.

export const NEIGHBORHOODS = Object.freeze({
  // corridor key → display name + DataSF "Analysis Neighborhood" used for counts
  mission:       { name: 'The Mission',        analysis: 'Mission' },
  excelsior:     { name: 'Excelsior',          analysis: 'Excelsior' },
  outersunset:   { name: 'Outer Sunset',       analysis: 'Sunset/Parkside' },
  sunset:        { name: 'Inner Sunset',       analysis: 'Inner Sunset' },
  richmond:      { name: 'Inner Richmond',     analysis: 'Inner Richmond' },
  outerrichmond: { name: 'Outer Richmond',     analysis: 'Outer Richmond' },
  fillmore:      { name: 'Fillmore',           analysis: 'Western Addition' },
  tenderloin:    { name: 'Tenderloin',         analysis: 'Tenderloin' },
  downtown:      { name: 'Downtown / Market',  analysis: 'Financial District/South Beach' },
  bayview:       { name: 'Bayview',            analysis: 'Bayview Hunters Point' },
  ocean:         { name: 'Ocean / Ingleside',  analysis: 'Oceanview/Merced/Ingleside' },
});

// What each business type needs to know. `signals` decides which public records
// are counted; a bookstore and a bakery get different comparisons.
export const BUSINESS_TYPES = Object.freeze({
  bakery: {
    label: 'Bakery', food: true, sector: 'food',
    keywords: ['BAKERY', 'BAKE', 'PANADERIA', 'PATISSERIE', 'BOULANGERIE', 'PASTRY', 'DONUT'],
    signals: ['similar_active', 'food_permits', 'sector_openings', 'sector_closures'],
    needs: ['Ovens need ventilation (a hood) and adequate electrical or gas service', 'Health permit and plan check for a food facility', 'Prep sinks, hand sinks and a mop sink', 'Early-morning production hours'],
  },
  chai: {
    label: 'Chai shop', food: true, sector: 'food',
    keywords: ['CHAI', 'TEA'],
    signals: ['similar_active', 'food_permits', 'sector_openings', 'sector_closures'],
    needs: ['Health permit for beverage and food service', 'Hand and prep sinks', 'Seating if customers will linger'],
  },
  restaurant: {
    label: 'Restaurant', food: true, sector: 'food',
    keywords: ['RESTAURANT', 'KITCHEN', 'GRILL', 'TAQUERIA', 'BISTRO', 'EATERY'],
    signals: ['similar_active', 'food_permits', 'sector_openings', 'sector_closures'],
    needs: ['Type I hood and grease interceptor are common requirements', 'Health permit and plan check', 'Restrooms and accessibility for seated dining'],
  },
  grocery: {
    label: 'Grocery', food: true, sector: 'retail',
    keywords: ['GROCERY', 'MERCADO', 'MARKET', 'FOODS'],
    signals: ['similar_active', 'food_permits', 'sector_openings', 'sector_closures'],
    needs: ['Refrigeration load on electrical service', 'Health permit for packaged and fresh food', 'Delivery access and storage'],
  },
  salon: {
    label: 'Salon', food: false, sector: 'none',
    keywords: ['SALON', 'HAIR', 'NAIL', 'BEAUTY', 'BARBER'],
    signals: ['similar_active'],
    needs: ['Shampoo-sink plumbing and hot water capacity', 'State Board of Barbering and Cosmetology licensing for operators', 'Ventilation for nail services'],
  },
  bookstore: {
    label: 'Bookstore', food: false, sector: 'retail',
    keywords: ['BOOK'],
    signals: ['similar_active', 'sector_openings', 'sector_closures'],
    needs: ['Retail use (usually simpler than food)', 'Floor load and shelving layout', 'Change of use if the last use was food and you remove the kitchen'],
  },
});

export const SIGNALS = Object.freeze({
  similar_active: {
    label: 'Similar businesses registered and active',
    means: 'Businesses whose registered name contains words like the ones for this type. Shows that similar businesses operate here. It can mean demand or competition; the record cannot tell which.',
    caveat: 'Name match only. Misses businesses with other names; may include unrelated names.',
  },
  food_permits: {
    label: 'Building permits involving food or beverage use (since 2016)',
    means: 'Buildings that have had food-related permit work. More of these means more spaces that may have had kitchen infrastructure.',
    caveat: 'Does not say whether any of those spaces is available or still has working equipment.',
  },
  sector_openings: {
    label: 'New registrations in this sector (last 3 years)',
    means: 'Business locations in this sector that registered recently.',
    caveat: 'A registration is not proof the business opened to the public.',
  },
  sector_closures: {
    label: 'Ended registrations in this sector (last 3 years)',
    means: 'Business locations in this sector whose registration ended recently.',
    caveat: 'An ended registration can mean a move, a sale, or a closure.',
  },
});

// Always unknown: no trustworthy public source in this prototype.
export const ALWAYS_UNKNOWN = Object.freeze([
  'Commercial rent (no public rent data; broker quotes are unverified)',
  'Foot traffic (no public counts used)',
  'Current vacancy of any storefront (records show history, not today)',
  'Transit access for your customers and staff (not analyzed yet)',
  'Whether a specific space suits your business (requires a site visit and permit review)',
]);

const PRIORITY_TO_SIGNAL = Object.freeze({
  buildout: 'food_permits',
  similar: 'similar_active',
  momentum: 'sector_openings',
});

export function signalValue(evidence, typeKey, signal, analysisName) {
  const s = evidence?.types?.[typeKey]?.signals?.[signal] ?? evidence?.shared?.[signal];
  if (!s || !s.ok) return { status: 'unknown', reason: s?.error ? 'query failed' : 'not retrieved' };
  const n = s.counts?.[analysisName];
  return { status: 'known', value: Number(n || 0), queryUrl: s.queryUrl, retrievedAt: evidence.retrievedAt };
}

// Compare up to three neighborhoods for a business type. No scoring, no ranking.
export function compare({ evidence, typeKey, keys, sites = [] }) {
  const type = BUSINESS_TYPES[typeKey];
  if (!type) throw new Error('unknown business type');
  const chosen = keys.filter((k) => NEIGHBORHOODS[k]).slice(0, 3);
  const notUsed = Object.keys(SIGNALS).filter((s) => !type.signals.includes(s));
  return {
    type: { key: typeKey, label: type.label, food: type.food, needs: type.needs },
    signalsUsed: type.signals.map((s) => ({ key: s, ...SIGNALS[s] })),
    signalsNotUsed: notUsed.map((s) => ({ key: s, label: SIGNALS[s].label, why: `Not relevant to a ${type.label.toLowerCase()}.` })),
    alwaysUnknown: ALWAYS_UNKNOWN,
    neighborhoods: chosen.map((k) => ({
      key: k,
      name: NEIGHBORHOODS[k].name,
      analysisNeighborhood: NEIGHBORHOODS[k].analysis,
      candidateStorefronts: sites.filter((s) => s.corridor === k).length,
      evidence: Object.fromEntries(type.signals.map((s) => [s, signalValue(evidence, typeKey, s, NEIGHBORHOODS[k].analysis)])),
    })),
  };
}

// "Help me choose": transparent sort on ONE signal the user picked. Neighborhoods
// with unknown evidence are listed separately, never silently treated as zero.
export function helpMeChoose({ evidence, typeKey, priority }) {
  const type = BUSINESS_TYPES[typeKey];
  if (!type) throw new Error('unknown business type');
  let signal = PRIORITY_TO_SIGNAL[priority];
  if (!signal || !type.signals.includes(signal)) signal = 'similar_active';
  const rows = Object.entries(NEIGHBORHOODS).map(([k, n]) => ({ key: k, name: n.name, v: signalValue(evidence, typeKey, signal, n.analysis) }));
  const known = rows.filter((r) => r.v.status === 'known').sort((a, b) => b.v.value - a.v.value || a.name.localeCompare(b.name));
  return {
    picks: known.slice(0, 3).map((r) => r.key),
    rule: `Sorted by "${SIGNALS[signal].label}" for a ${type.label.toLowerCase()}, highest first. This is one count from public records, not a ranking of where you will succeed.`,
    signal,
    unknown: rows.filter((r) => r.v.status !== 'known').map((r) => r.name),
  };
}

export const RESOURCES = Object.freeze({
  pim: { label: 'SF Planning Property Information Map (zoning, permits, history)', url: 'https://sfplanninggis.org/pim/' },
  permitCenter: { label: 'SF Permit Center business services', url: 'https://www.sf.gov/information--permit-center-business-services' },
  sfBusiness: { label: 'SF.gov business resources', url: 'https://www.sf.gov/topics/business' },
  foodFacility: { label: 'SF guide: building and remodeling a food facility', url: 'https://www.sf.gov/plan-check-guide-building-and-remodeling-food-facility' },
  sfImmigrationHelp: { label: 'SF.gov: Get immigration legal help', url: 'https://www.sf.gov/get-immigration-legal-help' },
  eoir: { label: 'U.S. DOJ: Recognized organizations and accredited representatives (FAQ)', url: 'https://www.justice.gov/eoir/recognition-and-accreditation-program-frequently-asked-questions' },
  uscisLegal: { label: 'USCIS: Find legal services and avoid scams', url: 'https://www.uscis.gov/scams-fraud-and-misconduct/avoid-scams/find-legal-services' },
  sba: { label: 'U.S. SBA business guide', url: 'https://www.sba.gov/business-guide' },
});

export function checklist({ typeKey, site }) {
  const type = BUSINESS_TYPES[typeKey];
  if (!type) throw new Error('unknown business type');
  const where = site ? `${site.name} (block ${site.block}, lot ${site.lot})` : 'each storefront you consider';
  const sections = [
    {
      title: 'Public records',
      items: [
        { text: `Look up ${where} on the Property Information Map: zoning district, permit history, and any open complaints.`, link: RESOURCES.pim },
        { text: 'Find the last legally permitted use of the space. Ask the Permit Center whether your use needs a change-of-use permit.', link: RESOURCES.permitCenter },
        ...(type.food ? [{ text: 'Check past permits for food or beverage use: they hint at existing hoods, sinks, and grease interceptors, but do not prove they still work.', link: null }] : []),
      ],
    },
    {
      title: 'Questions for the owner or broker',
      items: [
        { text: 'Is the space available now, and since when has it been empty?' },
        { text: 'What is the asking rent, and what is included (taxes, insurance, maintenance)?' },
        { text: 'What equipment and infrastructure stays: electrical capacity, gas, plumbing' + (type.food ? ', hood, grease interceptor' : '') + '?' },
        { text: 'Will the owner contribute to improvements or give free rent during buildout?' },
        { text: 'Is a personal guarantee required? Ask before you share any financial documents.' },
      ],
    },
    {
      title: `Permitted use and licenses for a ${type.label.toLowerCase()}`,
      items: [
        ...type.needs.map((t) => ({ text: t })),
        ...(type.food ? [{ text: 'Read the city’s food facility plan-check guide before signing a lease.', link: RESOURCES.foodFacility }] : []),
        { text: 'Register the business and confirm local license requirements.', link: RESOURCES.sfBusiness },
      ],
    },
    {
      title: 'Buildout',
      items: [
        { text: 'Get a contractor or architect to walk the space before you sign.' },
        { text: 'Ask for a written estimate of what must be built and how long permits may take.' },
      ],
    },
    {
      title: 'Questions for a qualified immigration adviser',
      note: 'Hushwork does not decide immigration or work eligibility. Bring these questions to an immigration attorney or a DOJ-accredited representative at a recognized organization.',
      items: [
        { text: 'Does my current status allow me to own a business? To work in it myself? To receive income from it?' },
        { text: 'Does signing a lease or personal guarantee, or forming an LLC, affect my status or any pending application?' },
        { text: 'Can I hire employees, and what do I need for employment verification?' },
        { text: 'What should I avoid doing until I have an answer?' },
        { text: 'Find free or low-cost legal help in San Francisco.', link: RESOURCES.sfImmigrationHelp },
        { text: 'Check that an adviser is an attorney or accredited representative; avoid "notario" scams.', link: RESOURCES.uscisLegal },
        { text: 'What recognized organizations and accredited representatives are.', link: RESOURCES.eoir },
      ],
    },
  ];
  return { title: `Next steps: ${type.label} at ${site ? site.name : 'your shortlist'}`, sections };
}
