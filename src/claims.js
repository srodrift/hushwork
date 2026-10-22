// Compare a broker listing's claims against cited city records.
// Verdicts: conflicts_with_records | partly_supported | supported | no_public_record.
// A registration "with no end date" is evidence to check, not proof of occupancy.

export function checkClaims(listing, snapshot) {
  const biz = snapshot?.sources?.businesses?.rows || [];
  const permits = snapshot?.sources?.permits?.rows || [];
  const bizUrl = snapshot?.sources?.businesses?.queryUrl;
  const permitUrl = snapshot?.sources?.permits?.queryUrl;
  const out = [];
  if (!snapshot) return { checkedAgainst: null, claims: (listing.claims || []).map((c) => ({ ...c, verdict: 'no_public_record', explanation: 'No city records have been pulled for this address.' })) };

  for (const c of listing.claims || []) {
    if (c.kind === 'available') {
      const open = biz.filter((r) => !(r.location_end_date || r.dba_end_date));
      out.push(open.length
        ? { ...c, verdict: 'conflicts_with_records', explanation: `${open.length} business registration${open.length > 1 ? 's' : ''} at this address ${open.length > 1 ? 'have' : 'has'} no end date on record (${open.map((r) => r.dba_name).slice(0, 3).join('; ')}). Registrations can lag behind real closures, so this is not proof the space is occupied. Ask the owner when the last tenant left and get it in writing.`, evidence: { url: bizUrl, count: open.length } }
        : { ...c, verdict: 'no_public_record', explanation: 'No open business registration found. Records cannot confirm vacancy either way; visit the space.' });
    } else if (c.kind === 'food_ready') {
      const food = permits.filter((r) => /food/i.test(`${r.existing_use || ''} ${r.proposed_use || ''}`));
      const sinks = food.filter((r) => /sink|hood|grease|kitchen/i.test(r.description || ''));
      out.push(food.length
        ? { ...c, verdict: 'partly_supported', explanation: `${food.length} permit${food.length > 1 ? 's' : ''} list food/beverage use${sinks.length ? `, including "${sinks[0].description}" (${String(sinks[0].permit_creation_date || '').slice(0, 10)})` : ''}. This shows past food use. It does not show the equipment still exists or works for a bakery's ovens.`, evidence: { url: permitUrl, count: food.length } }
        : { ...c, verdict: 'no_public_record', explanation: 'No permits with food or beverage use found. A kitchen may need to be built from scratch.' });
    } else if (c.kind === 'rent') {
      out.push({ ...c, verdict: 'no_public_record', explanation: 'Commercial rent is not in any public record. Treat the broker quote as unverified until it is in a written offer.' });
    } else {
      out.push({ ...c, verdict: 'no_public_record', explanation: 'No public record checked for this claim.' });
    }
  }
  return { checkedAgainst: { address: snapshot.address, retrievedAt: snapshot.retrievedAt }, claims: out };
}

// Dated history of the space from city records. "Registered" ≠ "operated here".
export function timeline(snapshot) {
  if (!snapshot) return null;
  const ev = [];
  for (const r of snapshot.sources?.businesses?.rows || []) {
    const start = (r.location_start_date || r.dba_start_date || '').slice(0, 10);
    const end = (r.location_end_date || r.dba_end_date || '').slice(0, 10);
    if (start) ev.push({ date: start, kind: 'registration_start', text: `Business registration begins: ${r.dba_name}` });
    if (end) ev.push({ date: end, kind: 'registration_end', text: `Business registration ends: ${r.dba_name}` });
    else ev.push({ date: null, kind: 'registration_open', text: `${r.dba_name}: no end date on record` });
  }
  for (const r of snapshot.sources?.permits?.rows || []) {
    const d = (r.permit_creation_date || '').slice(0, 10);
    if (d) ev.push({ date: d, kind: 'permit', text: `Permit filed: ${r.permit_type_definition || 'permit'}: ${r.description || ''}${r.status ? ` (${r.status})` : ''}`, use: r.existing_use || r.proposed_use || null });
  }
  ev.sort((a, b) => (a.date === null) - (b.date === null) || String(b.date).localeCompare(String(a.date)));
  return {
    address: snapshot.address, retrievedAt: snapshot.retrievedAt, events: ev,
    sources: { businesses: snapshot.sources?.businesses?.queryUrl, permits: snapshot.sources?.permits?.queryUrl },
    caution: 'A registration shows a business listed this address, not that it occupied this exact shop. Permits show work was filed, not current condition, vacancy, or approval for a new business.',
  };
}
