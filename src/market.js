// Market rent context from a published broker report, verified by hand.
// Citywide only: the report gives no neighborhood breakdown. Not the price of any space.
export const MARKET_RENT = Object.freeze({
  scope: 'San Francisco citywide',
  basis: 'average asking retail rent',
  perSqFtYear: 36.56,
  vacancy: '6.6%',
  period: 'Q3 2026',
  source: 'Kidder Mathews, San Francisco Retail Market Report',
  url: 'https://kidder.com/market-reports/san-francisco-retail-market-report/',
  checkedOn: '2026-10-22',
  caveats: [
    'Citywide average; the report gives no figure for individual neighborhoods.',
    'Asking rent, not signed deals. Real leases can be higher or lower.',
    'The report does not say whether this includes taxes, insurance and maintenance (NNN vs. full service). Ask every landlord.',
  ],
});

export function estimateMonthly(sqft) {
  const n = Number(sqft);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round((MARKET_RENT.perSqFtYear * n) / 12);
}
