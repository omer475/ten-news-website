# Tier 1 venture capital funds, London (15-vc-tier1)

> **SEGMENT INCOMPLETE — TOOLING FAILURE. PLEASE RE-RUN.**
> This segment could not be researched. Two independent blockers:
> 1. **All web fetching is blocked.** `WebFetch` returns `EGRESS_BLOCKED` for *every* domain
>    tested — fund sites (indexventures.com, balderton.com, atomico.com, accel.com), ATS boards
>    (boards.greenhouse.io, job-boards.greenhouse.io, jobs.lever.co), aggregators
>    (startupandvc.com) and even example.com / en.wikipedia.org. `curl` through the agent proxy
>    fails identically (`CONNECT tunnel failed, response 403`).
> 2. **The session-wide WebSearch budget was exhausted** (200/200 calls, consumed by other
>    segments) after only my first **two** queries returned.
>
> I therefore checked **2 of the ~35 assigned funds**, and could not open a single live listing.
> Per BRIEF rule 4, **nothing below is VERIFIED**. Per rules 2 and 6 I have not padded the tables
> with plausible-but-unseen roles, URLs or contacts. What follows is only what I actually saw in
> the two search-result sets I received.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| Entrepreneurs First (The Bridge) | Venture Fellowship (London) | London | Unknown | Unknown | UNVERIFIED — search-result title only, page not openable | https://venturecapitalcareers.com/companies/entrepreneurs-first/jobs/venture-fellowship-london-the-bridge | Appeared as a result while searching Balderton. Exactly the Track A shape (venture fellowship, London). Not on my assigned fund list and **I could not confirm it is open** — no date seen. Must be re-checked before any outreach. |

**No other Track A rows.** Not "none exist" — I was unable to look. VC is very likely the highest-yield
segment as the orchestrator expects; that expectation is untested here.

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|

None found. Tier-1 VCs rarely run named graduate schemes, so a thin Track B here would be expected
even with working tools — but I could not check, so treat this as unresearched, not as a finding.

## Speculative targets (no open role, worth emailing)

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| Balderton Capital | Confirmed to run a structured junior-intake programme: Balderton publish a "Welcome to Balderton's Summer Associates" post, and a "Summer Investment Intern" listing and a "VC Internship @ Balderton Capital, London" listing both exist in the wild. So they demonstrably take student interns — the pattern the candidate needs. Summer-shaped, so an Oct/Nov part-time start would be a speculative ask. | https://www.balderton.com/careers/ (**seen only as the site's own domain in results — I could NOT open it; verify before use**) | No named partner or talent contact obtained — I could not open any Balderton page. Evidence of the programme: https://www.balderton.com/news/welcome-to-baldertons-summer-associates/ ; historical listings at https://startup.jobs/summer-investment-intern-balderton-capital-4201856 and https://johngannonblog.com/venture-capital-jobs-in-london/vc-internship-balderton-capital-in-london-england/ . One aggregator snippet said Balderton has no openings "at the moment" — consistent with a speculative-email approach. |
| Index Ventures | Tier-1 London fund. No own-firm internship surfaced, but Index run a large portfolio job board including an intern-filtered London view — a real, usable route into Index-backed startups (adjacent to the candidate's AI-native-finance pitch) even when Index itself is not hiring. | https://www.indexventures.com/startup-jobs/london/intern (portfolio board, intern filter — URL appeared in results; page not openable by me) | No named contact obtained. Portfolio board also at https://www.indexventures.com/startup-jobs/london/1 (~1,167 London roles per the result snippet). |

**The following 33 assigned funds were NOT checked at all** — no careers URL, no contact, no
open/closed determination. They remain entirely open work:
Accel London · Atomico · LocalGlobe / Phoenix Court / Latitude · Northzone London · Felix Capital ·
Dawn Capital · Notion Capital · Octopus Ventures · Molten Ventures · Highland Europe · Eight Roads ·
General Catalyst London · Lightspeed London · Sequoia London · a16z London · Bessemer London ·
Insight Partners London · ICONIQ London · Coatue London · Sofina · EQT Ventures London ·
Creandum London · HV Capital London · Point Nine London · Cherry London · 83North ·
Amadeus Capital · MMC Ventures · IQ Capital · Albion · Beringea · Draper Esprit (now Molten).

## Dead ends

None established. No fund was checked thoroughly enough to be ruled out. Recording an unchecked
fund as a dead end would be a false negative, so this section is deliberately empty.

## Intel

- **Balderton runs a Summer Associate cohort** and publicly announces it (the "Welcome to
  Balderton's Summer Associates" post). Worth timing a speculative email to the cohort
  announcement/recruiting cycle rather than cold in November. Cadence not established — I could not
  open the post to date it.
- **Index Ventures' portfolio job board is intern-filterable by city**
  (`/startup-jobs/london/intern`), giving a standing pipeline of London intern roles at Index-backed
  companies. Useful as a recurring source for other segments too, if fetching is ever restored.
- **Aggregators that surfaced repeatedly and may be more fetchable than fund sites**, worth trying
  first on a re-run: `venturecapitalcareers.com`, `startupandvc.com/vc-firms/<fund>`,
  `johngannonblog.com` (a long-running VC-jobs blog with per-firm London pages), `startup.jobs`.
  John Gannon's blog in particular indexes London VC internships by firm.
- **Search hygiene for the re-run:** the query pattern `"<fund>" venture fellow` /
  `"<fund>" scout programme` / `"<fund>" intern 2026` was not exercised — only the two broad
  fund-name queries ran. Budget ~3 searches per fund; at 35 funds that is ~105 searches, so this
  segment needs a materially larger share of the search budget than it received (it got 2).
- **Environment note for whoever re-runs this:** confirm `WebFetch` works on at least one domain
  before starting. If `EGRESS_BLOCKED` persists, every row will be UNVERIFIED and named
  partner/talent contacts — the main ask for this segment — are unobtainable, since those live on
  fund "team" pages that must be opened.
