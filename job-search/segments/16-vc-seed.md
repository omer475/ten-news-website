# Seed, pre-seed & specialist VC funds, London (16-vc-seed)

> **TOOLING FAILURE — READ THIS FIRST.** This segment is only ~5% researched, and not
> because the roles do not exist. Two hard blockers hit:
> 1. **WebFetch is egress-blocked for every domain tested** (`thecreatorfund.com`,
>    `seedcamp.com`, `job-boards.greenhouse.io`, `boards.greenhouse.io`,
>    `jobs.lever.co`, even `en.wikipedia.org`) — all return
>    `EGRESS_BLOCKED ... blocked by the network egress proxy`. `curl` to the same
>    hosts returns `CONNECT tunnel failed, response 403`. This is an org egress
>    policy, not a transient error, so per /root/.ccr/README.md I did not retry or
>    route around it. **Net effect: I could not open a single live listing.**
> 2. **WebSearch budget exhausted at 200/200 for the whole session** after my
>    first batch of 3 queries. Every subsequent query returned
>    "this session has used its web search budget".
>
> Consequence: **every row below is UNVERIFIED** (search snippet only). I got three
> searches' worth of signal and have not checked ~45 of the ~50 firms in my remit.
> This segment needs re-running with fetch access or a raised search budget.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| Creator Fund | Student investor / venture partner (junior + senior tracks) | UK universities incl. London; explicitly done **alongside** your degree | Yes — designed to be studied around | Not seen; rolling/cohort-based, unconfirmed | UNVERIFIED (page egress-blocked; details from search snippet of the recruitment page) | https://www.thecreatorfund.com/recruitment-2/ | **Best fit in the segment.** Eligibility is "studying at a UK university and continuing your studies alongside Creator Fund" — Bristol final-year qualifies. Team is a mix of PhD/master's/undergrad; ~10 investments a year; deeptech (AI, quantum, biotech) sourced from labs. Omer's multi-agent AI screening work maps directly onto deal sourcing/screening. Pay not stated — assume unpaid or token; confirm. |
| Seedcamp | VC Internship (6-month) | London, Soho (72–74 Dean St) | Unknown — historically full-time 6-month | Snippet says intake **begins in August** → likely wrong cycle for an Oct/Nov start | UNVERIFIED | https://seedcamp.com/views/careers-at-seedcamp/ · board: https://talent.seedcamp.com/jobs | Historical listing (johngannonblog mirror). The only role I could actually see live-ish on Seedcamp today is **Office Manager**, which is not relevant. Treat Seedcamp as speculative for now, see below. |

**That is the honest total: 1 genuinely promising Track A lead, 1 weak one.** I have not
padded this with the 45 firms I never got to check.

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | Nothing found. Seed/pre-seed funds of this size (2–20 people) essentially never run structured Sept-start graduate schemes; Track B yield from this segment was always expected to be near zero. The realistic Track B analogue here is converting a student-scout role (Creator Fund) into a full-time analyst seat — their own material claims 100% of last year's student team went into full-time VC or startup roles. |

## Speculative targets (no open role, worth emailing)

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| Creator Fund | Only fund in the segment with a *standing, publicised* student-investor programme; recruits undergrads mid-degree by design. Alumni placed at MMC Ventures, Force Over Mass, Speedinvest, Octopus, Apax, Seventure. Runs 40–50 student scouts across 24 universities in 8 countries — Bristol is very likely already in or adjacent to that footprint. | https://www.thecreatorfund.com/recruitment-2/ | Route: apply via the recruitment page. Founder/managing partner is **Jamie Macfarlane** (named in Fund Momentum's coverage of their $56M close). No email address obtained — I could not open the site. If Bristol already has a Creator Fund scout, the warm intro through them beats the form. |
| Seedcamp | Europe's best-known seed fund, London Soho, and has demonstrably run VC internships before (6-month programme). Inbound speculative emails are the normal route into funds this size. | https://seedcamp.com/views/careers-at-seedcamp/ | No named contact obtained (site egress-blocked). Their portfolio talent board https://talent.seedcamp.com/jobs is a second, separate route — it lists roles at ~600 portfolio startups, several of which will take part-time AI/data interns even when the fund itself will not. Worth mining as its own target list. |

## Dead ends

- **DTCP** — surfaced in search as a London deal-sourcing/financial-modelling intern, but dated **Q1 2026**, i.e. long closed by 6 Sept 2026. Also growth/infra rather than seed. Dead for Track A.
- **Aegis Ventures** — a part-time "Venture Fellow" role was posted Aug 2026, but Aegis is a New York firm; no London pattern found. Out of segment.
- **London VC Network "Fellowship"** — **not a job. It is a paid course: £3,950 including VAT** (financial aid mentioned for exceptional applicants). Flagging it explicitly so nobody mistakes it for a VC internship. Recommend avoiding. https://www.londonvcnetwork.com/fellowship

## Intel

**Firms in my remit that I did NOT get to check** (search budget died before I reached them —
these are genuinely unexamined, not rejected): Playfair Capital, Ada Ventures, Fuel Ventures,
Concept Ventures, Episode 1, Forward Partners/Newable, Passion Capital, Firstminute Capital,
Kindred Capital, Connect Ventures, Crane Venture Partners, Amadeus APEX, AlbionVC, Ascension,
SFC Capital, Haatch, JamJar, Active Partners, Venrex, Sweet Capital, Hoxton Ventures,
Air Street Capital, Amino Collective, Basis Capital, Form Ventures, Frontline Ventures,
Outward VC, Anthemis, Augmentum Fintech, Illuminate Financial, Motive Partners, Portage London,
FINTOP, QED London, Element Ventures, Fin Capital London, Lightbulb, Deeptech Labs,
Amadeus Deeptech, Sure Valley, Blossom Capital, Latitude (LocalGlobe), Plural, Project A London,
Cocoa, Moonfire, Entrepreneur First. The AI-specialist subset the orchestrator flagged as key —
**Air Street Capital, Concept Ventures, Moonfire, Plural** — is entirely unchecked and is where
I would restart.

**Aggregator job boards worth scraping when fetch access is restored** (all surfaced in search,
none opened): 
- https://www.startupandvc.com/venture-capital-jobs — VC-specific board, the standard one for this niche
- https://www.vcstack.com/job
- https://jobsinvc.getro.com/companies/seedcamp — Getro network board, covers many UK funds
- https://superscout.co/fellowships — claims to be a complete 2026 list of VC fellowship programmes; directly on-target for "Venture Fellow"/"VC Scout" titles
- https://contrary.com/blog/venture-partner-apps-2026 — Contrary's venture-partner applications for 2026 (US-led but has UK university coverage)
- https://www.openvc.app/investor-lists/venture-capital-firms-investors-london — full London investor list, useful for building the speculative-email target set
- https://uk.indeed.com/q-venture-capital-internship-jobs.html — will need search-snippet handling, Indeed blocks fetching

**Pattern notes.** Seed funds in London do not post student roles on ATS boards; they hire off
inbound email and off university society networks. The two structural routes for this candidate
are (a) named student-scout programmes — Creator Fund is the confirmed one, and Contrary/
Superscout should surface more — and (b) cold email to partners, where his Maxis AI screening
system (50,000+ companies) is an unusually strong opener because deal sourcing is precisely the
job a seed fund would hand a part-time student.

**Re-run requirements.** To finish this segment properly: allowlist `thecreatorfund.com`,
`seedcamp.com`, `boards.greenhouse.io` / `job-boards.greenhouse.io`, `jobs.lever.co`,
`jobs.ashbyhq.com`, `apply.workable.com`, plus the six aggregator domains above; and raise
`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`. Budget ~2 searches per firm × 45 firms ≈ 90 searches
for this segment alone.
