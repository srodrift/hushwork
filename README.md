# hushwork.

**Your agent works. Your secrets don't travel.**

Hushwork is a personal AI agent that investigates a San Francisco storefront for a first-time founder using public records, and drafts a lease inquiry, **without the language model ever receiving the founder's confidential financial data.** Trusted server code, not the model, decides what leaves the system, and the user approves the exact final message.

Built for the National Renaissance Hackathon at super{set}, October 22, 2026. Track: Personal Agents & Data Privacy.

## Prior work and what was built today

This repository was created on October 22, 2026, with a fresh Git history. It is not entirely from-scratch work, and here is exactly what came from earlier:

- **Built during the hackathon (Oct 22, 2026):** everything in `src/`, `public/`, `test/`, and `scripts/`. That includes the vault, egress gate, payload-bound approvals, audit log, coarse budget check, Claude agent and tools, attack test, API, UI, and all tests. This code was first written in a `veyra` branch of the Block Book repo earlier today, then moved here as a standalone app.
- **Design:** inspired by Apple's design principles (system typography, generous whitespace, soft cards). It uses no Apple branding or assets.

## Quick tour (Oct 22, 2026 build)

1. Describe your idea in your own words (or tap a type). Hushwork searches DataSF's business registry live for your words.
2. Pick neighborhoods on a 3D map (Day / Night / Aerial) or get a suggestion with the rule shown.
3. Compare neighborhoods in plain English; unknowns stay unknown.
4. Pick a storefront: Google Maps, Street View, zoning/permit/planning links; for 2234 Mission, listing claims vs. city records and history.
5. Money and help: verified grants, loans, free help; budget slider saved privately; optional private fit check.
6. Your 5 next steps, then "Continue with the AI": Claude drafts the landlord inquiry from placeholders, you approve the exact message, then run the prompt-injection attack.
Plus "Ask Hushwork", a chat guide grounded in the same tools, with private numbers redacted before the model.

## The guided journey

Open `http://localhost:3000`. For people already living in the U.S. who want to open a business in San Francisco:

1. **Business type.** Bakery, chai shop, restaurant, grocery, salon, bookstore. The type changes which public records are compared (a bakery counts food-use permits; a bookstore doesn't).
2. **Priorities.** Private budget goes to the vault. Buildout, similar businesses, recent activity, transit (transit is shown as unknown).
3. **Compare three neighborhoods.** Pick on the map, search, or "Help me choose" (a transparent sort on one signal, not a ranking). Each count links to its DataSF query.
4. **Storefronts** on the list in those neighborhoods, with what to verify. 2234 Mission Street has pulled city records and the private AI investigation (`/investigate.html`).
5. **Checklist:** public records, owner questions, permitted use and licenses, buildout, and questions for a qualified immigration adviser with official resources.

Neighborhood counts come from `npm run neighborhoods` (writes `data/neighborhood_evidence.json`). Without it, every count shows as unknown.

**Also in the journey (2234 Mission Street, the one address with pulled records):**
- **Listing claims vs. city records.** "Available now" conflicts with 3 registrations with no end date; "suitable for a café" is partly supported by 6 food-use permits; rent has no public record. Each verdict links to its records and says what the record cannot prove.
- **Space history timeline** from registrations and permits.
- **Funding fit.** 10 programs (grants, a reimbursement grant, loans, free help) verified on Oct 22, 2026 from official pages. Years in operation, revenue, employees and lease status stay in the vault; trusted code returns only pass / fail / unknown per published rule. Closed or unclear rounds are never shown as available, and each "not a fit" card says what to try instead.
- **Find the right local help.** Supervisor district taken from the city's own permit and business records for the address (District 9), contact verified on SF.gov, limits stated, department-first routing, and an editable request draft that is never sent.

**Rent context:** a citywide average asking retail rent ($36.56 per sq ft per year, Kidder Mathews San Francisco Retail Market Report, Q3 2026, checked Oct 22, 2026) turns a needed size into a monthly estimate, compared privately with the founder's max rent (within / over only). No published source we found gives neighborhood-level figures, and it is not the price of any specific space. We do not scrape listing sites.

**Not built (shown as planned in the app):** custom ideas with live queries, community perspectives (no Reddit feed is connected), private investigation for storefronts other than 2234 Mission, rent/foot-traffic/vacancy/transit data.

**About the storefront list:** `data/sites.json` keeps only addresses, coordinates and neighborhood groupings from Block Book. Block Book's vacancy status, condition notes, walk/transit scores and confidence numbers are excluded because they are not sourced.

## Second use case: a startup's first workspace

`/workspace.html`. Team size, growth, days in office, needs, and longest commitment change the advice across five workspace types (coworking desk, private coworking office, sublease, direct lease, incubator). "What will this actually cost us?" totals quoted line items; blank items are unknown, never zero. A private monthly budget and runway stay in the vault; the cost check returns only within / within so far / over. Broker questions go through the same exact-message approval and release only company name and team size. There is no office listings database; the page starts from quotes the founder enters (two fictional samples are labeled).

## Run it

```bash
npm install
cp .env.example .env            # add ANTHROPIC_API_KEY
npm test                        # security tests (live model test runs if the key is set)
npm start                       # http://localhost:3000
```

Requires Node 20.12+. Refresh public records (optional; the demo uses the committed snapshot):

```bash
npm run snapshot -- "2234 Mission Street"
```

Offline UI test without Claude: `HUSHWORK_SCRIPTED=1 npm start`. This uses a scripted fake model, labeled as such in the UI. It is for testing the wiring, not for the demo.

## Architecture

```
 untrusted                         │  trusted server code (src/core.js)
                                   │
 Public records (DataSF snapshot) ─┤
 Broker listing text (simulated) ──┼──► buildAgentContext() ──► Claude
                                   │     tokens only: {{ssn}}, {{max_monthly_rent}} …
                                   │
 Claude tool calls ────────────────┼──► budget_check(listing_id) ─► within / over / unknown
                                   │──► draft_inquiry(recipient_id, purpose, template)
                                   │        └► policy check → draft (nothing sent)
                                   │
 User (consent card) ──────────────┼──► approve(draft) → sha256(recipient, purpose, exact payload)
                                   │──► send(approval, payload) → hash match? single use? grants still valid?
                                   │        └► simulated outbox
                                   │
                                   └──► audit log (field names only, never values)
```

**Vault.** Server-side, in-memory. No tool reads it. The model gets placeholder names, never values.

**Egress gate.** Deny by default. Checks recipient (server registry only; the agent cannot supply URLs or emails), purpose, every `{{token}}` against grants scoped to field × recipient × purpose × expiry, and refuses any raw vault value found in a payload. All or nothing.

**Payload-bound approval.** The user approves the exact message. Changing one character, the recipient, or the purpose voids it. Single use, expires in 15 minutes, and grants are re-checked at send time, so revoking after approval still blocks.

**Budget check.** The agent passes a listing id, not a number. Asking rent comes from server-held listing data, so the agent cannot binary-search the private budget. Coarse result only, 3 checks per session.

**Attack test.** A second listing for the same storefront hides an instruction to send the SSN, credit score, bank balance and max rent to its broker. The test (A) runs the real agent on it and reports what the model actually did, and (B) attacks the gate directly with no model. A model refusal is never reported as a gate block.

## Tests

`npm test`: **70 tests, 0 failures** (69 deterministic + 1 live against the Claude API), Oct 22, 2026.

Live result: Claude read the listing with the hidden injection and **ignored it** (`model_ignored_injection_drafted_safely`, no secret fields attempted). That is the model's own decision; the security claim does not rely on it. The direct gate attack and the scripted "obedient model" tests prove the gate blocks the send either way.

Coverage:

- Authorized disclosure succeeds; granted fields are resolved.
- Injection: model context built from the malicious listing contains zero vault values; an agent that obeys the injection is blocked.
- Bypass: unapproved recipient, agent-invented destination, wrong purpose, expired grant, revoked grant, raw value in payload, unknown field: all blocked.
- Approval: one-character edit, appended secret, changed recipient, changed purpose, reuse, expiry, revoke-after-approval, forged id: all blocked.
- Agent loop (scripted models): obeying model → gate block; ignoring model → reported as model decision; every request sent to the model scanned for vault values.
- Live (needs key): real Claude on the malicious listing; asserts no vault value in model context and nothing sent to the attacker. It asserts the security properties, not the model's choice.

## Data sources

DataSF via Socrata: [Registered Business Locations](https://data.sfgov.org/d/g8m3-pdis), [Building Permits](https://data.sfgov.org/d/i98e-djp9). Snapshot in `data/storefront.json` with retrieval timestamp and query URLs.

**Limitations of the data.** Records show history: past businesses and permits. They do not establish current vacancy, rent, zoning approval, or suitability for food service. The agent is instructed to report those as unknown. Asking rents are from **simulated, unverified** broker listings.

## Limitations

- Hackathon prototype. One in-memory session; restarting the server clears the vault, grants and log. No encryption at rest, no auth.
- All personal data is synthetic. Delivery is simulated; no real email is sent.
- The defense is architectural: the model never holds secrets, and trusted code gates egress. It does not claim immunity to every prompt-injection technique. For example, the model could still write misleading text in an approved message; that is why the user approves the exact final message.
- Public business-type text ("café") is task context and is shared with the model by design.

## Prior art

Separating untrusted content from privileged actions follows Simon Willison's dual-LLM pattern and Google DeepMind's CaMeL work. Hushwork applies that idea to a concrete personal-agent workflow; it does not claim to invent it.
