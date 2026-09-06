# Discretionary / long-short equity hedge funds & activist funds, London (11-discretionary-hf)

> **RESEARCH BLOCKED — READ THIS FIRST.** This segment is substantially **incomplete**. Two hard
> tooling failures stopped the work after only 4 usable searches:
>
> 1. **WebFetch is 100% unavailable in this session.** Every fetch returns
>    `EGRESS_BLOCKED — blocked by the network egress proxy`. Confirmed against company sites
>    (tcifund.com, egertoncapital.com, cheynecapital.com), ATS hosts
>    (job-boards.greenhouse.io), and even wikipedia.org and google.com. `curl` to the same hosts
>    returns `CONNECT tunnel failed, response 403`. The proxy status endpoint confirms an
>    org egress-policy denial, which the proxy README says must be reported, not routed around.
>    **Consequence: I could not open a single live listing, so per BRIEF rule 4 NOTHING in this
>    segment can be marked VERIFIED.**
> 2. **The session-wide WebSearch budget (200/200) was exhausted** after my 4th search — it is
>    shared across all parallel segment agents. Every subsequent search returns the budget error.
>
> Of the ~35 firms in scope, **3 were actually researched** (TCI, Egerton, Lansdowne).
> **~32 were never searched at all.** They are listed under "Not researched" below so the
> orchestrator can re-queue them — they are NOT dead ends, they are simply unexamined.
> To finish this segment, re-run it with WebFetch egress allowed and a fresh search budget.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| — | *None found* | — | — | — | — | — | No open part-time / off-cycle research intern role was located. This is a **null result caused by tooling failure, not evidence that none exist** — only 3 firms were reachable and none of their listings could be opened. |

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| — | *None found* | — | — | — | — | — | See blocker note. Discretionary L/S funds of this size rarely run public graduate schemes, but this was not confirmable here. |

## Speculative targets (no open role, worth emailing)

Only firms where I actually saw the contact detail in a real search result are listed.
No URL or address below is inferred or constructed.

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| **Lansdowne Partners** | Fundamental long/short equity, ~70 staff — exactly the small-team, direct-outreach profile the segment targets. Search result stated **no open positions currently listed, and that they explicitly invite prospective candidates to submit for future opportunities** — i.e. a live speculative channel. UNVERIFIED (page not opened). | `https://www.lansdownepartners.com/london/careers/` · open positions: `https://www.lansdownepartners.com/london/open-positions/` · recruitment policy: `https://www.lansdownepartners.com/london/view-our-recruitment-policy/` · contact: `https://www.lansdownepartners.com/london/contact-us/` | **`careers@lansdowne.com`** — send CV with a covering email. This is the single most actionable item in the segment. |
| **TCI Fund Management (The Children's Investment Fund)** | Concentrated, value-oriented global fundamental investor using a private-equity-style deep research approach — a good match for the candidate's PE screening + fundamental research background. | `https://www.tcifund.com/` (homepage; **careers page not confirmed to exist** — site was unfetchable) | No careers email found. Route would have to be direct outreach to a named investment professional; **names not researched** (budget exhausted). |
| **Egerton Capital (UK) LLP** | Partner-owned London global long-only / long-short equity firm, founded 1994. Hires Investment Analysts individually rather than via a scheme (search results referenced 2024 and 2026 analyst joiners), which is the direct-outreach pattern this segment is meant to exploit. | `https://www.egertoncapital.com/` · team page: `https://www.egertoncapital.com/team/` | No careers email found and no evidence of a graduate programme. Team page is the route to named contacts, but it could not be opened. |

## Dead ends

**None confirmed.** No firm in this segment was checked thoroughly enough to be ruled out. Do not
treat any absence below as a negative finding.

One adjacent note, recorded only to prevent a duplicate look: **Marshall Wace** (not on this
segment's list; quant/multi-strat rather than discretionary) surfaced incidentally. Its
Quantitative Research Internship runs **29 Jun – 4 Sep 2026 — already finished as of today's
6 Sep 2026 date** — and required penultimate-year Master's/PhD STEM students graduating 2027, so
it is closed and, as a BSc final-year, the candidate would not have been eligible. Internships
index seen at `https://www.mwam.com/join-us/internships/`. UNVERIFIED.

## Not researched — re-queue these

Never searched; zero information gathered. Each still needs a careers-page + careers-email sweep:

Odey / Brook Asset Management · Pelham Capital · Sand Grove · Melqart · Kite Lake ·
Palliser Capital · Bluebell · Cevian London · Elliott London · Third Point London ·
Pershing Square London · Sachem Head London · Trian London · Gatemore · Chenavari · CQS ·
Cheyne Capital · Polygon/Tetragon · Sona Asset Management · Anchorage London ·
Silver Point London · Attestor · Arini · Kyma Capital · Bybrook · Farallon London ·
Naya Capital · Toscafund · Crispin Odey successors · Ruffer · Lindsell Train · Fundsmith

## Intel

- **Lansdowne Partners operates an open speculative channel**: `careers@lansdowne.com`, CV plus
  covering email, explicitly for candidates applying when nothing is posted. For a ~70-person
  fund this is the highest-yield action available from this segment. Worth pairing with the
  candidate's multi-agent equity-research project, which is a concrete differentiator for a
  fundamental L/S shop.
- **Structural point that survives the tooling failure**: firms in this segment are 10–100 people
  and largely do not run public intern pipelines or ATS boards. Expect careers-page-only or
  email-only routes, and expect most to have no posted role at any given time. That makes the
  speculative table — not the Track A table — the correct centre of gravity here, which is
  consistent with the segment instruction. It also means a re-run needs **WebFetch working**,
  since these firms' contact details live on their own sites, not on fetchable ATS boards.
- **Egerton hires analysts as individual vacancies, not cohorts** (2024 and 2026 joiners
  referenced in search results) — so timing outreach matters more than any deadline.
- Verification caveat repeated for the record: the Lansdowne "no open positions / apply
  speculatively" statement and the `careers@lansdowne.com` address both come from a **search
  result summary**, not a page I opened. Re-confirm before the candidate sends anything.
