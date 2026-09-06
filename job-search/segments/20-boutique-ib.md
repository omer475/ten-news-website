# Elite boutique & mid-market investment banks, London (20-boutique-ib)

> **RESEARCH BLOCKED — READ THIS FIRST. Zero listings could be checked.**
>
> This segment produced **no verified findings at all**. Two independent, hard blockers:
>
> 1. **The session-wide WebSearch budget was already exhausted (200/200) before my first call.**
>    Both of my opening searches returned `Web search was not performed: this session has used
>    its web search budget`. I completed **0 searches**. Unlike sibling segments (11/12/13/15),
>    which got a handful of searches away before the cap, I saw **not one search snippet**.
> 2. **All outbound HTTPS is denied by the organization egress proxy.** Every host I tried
>    returned `EGRESS_BLOCKED`:
>    `www.evercore.com`, `jobs.rothschildandco.com` (also DNS `ENOTFOUND`),
>    `hl.wd1.myworkdayjobs.com`, `boards.greenhouse.io`, `job-boards.greenhouse.io`,
>    `www.linkedin.com`, `duckduckgo.com`, and as a control `en.wikipedia.org`.
>    Per `/root/.ccr/README.md` a 403/407 from the proxy is an **organization policy denial**
>    that must be reported, not retried or routed around. So no careers page, no ATS board and
>    no job listing was opened.
>
> Consequence, per BRIEF rules 2 and 4: **nothing here can be marked VERIFIED or UNVERIFIED** —
> UNVERIFIED is defined as "search snippet only" and I have no snippets. I am therefore **not**
> populating apply URLs, deadlines, careers-page links or recruiter contacts. Boutique careers
> URLs and `careers@`/`recruitment@` addresses are highly guessable, and guessing them would put
> fabricated links and fabricated deadlines in front of the candidate — exactly what rule 2
> forbids. The assigned firms are recorded below as **UNCHECKED**, not as dead ends.
>
> **To unblock, this segment needs both:**
> - `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raised (or this segment re-run in a fresh session), **and**
> - the egress policy to allowlist company careers domains plus the ATS hosts the BRIEF itself
>   prefers: `greenhouse.io`, `job-boards.greenhouse.io`, `lever.co`, `ashbyhq.com`,
>   `workable.com`, `teamtailor.com`, `*.myworkdayjobs.com`, `smartrecruiters.com`.
>
> This segment is worth re-running with priority: the BRIEF flags boutiques as the **most likely
> bank type to take an off-cycle intern startable Oct/Nov 2026**, so the coverage gap here is
> the most costly of any segment.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| — | *No role found. No listing could be opened and no search returned — see blocker note. Nothing can be reported for Track A.* | — | — | — | — | — | — |

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| — | *No programme found. Not researched — see blocker note.* | — | — | — | — | — |

## Speculative targets (no open role, worth emailing)

I could not confirm a single careers page or contact address, so this table is deliberately
empty rather than filled with guessed URLs and guessed inboxes.

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| — | *Not researched. Every assigned firm is a candidate speculative target (see UNCHECKED list below), but none has a verified careers URL or contact, so none is listed here.* | — | — |

### UNCHECKED — full assigned list, coverage gap (0 of 41 checked)

None of these were reached. They are **not** dead ends; they are unresearched and all of them
remain live speculative candidates on re-run.

**Elite boutiques / global advisory:** Evercore · Lazard · Rothschild & Co · Centerview Partners ·
PJT Partners · Moelis & Company · Perella Weinberg Partners · Houlihan Lokey ·
Greenhill (Mizuho) · Ardea Partners London

**UK independent / partner-led advisory:** Robey Warshaw · Gleacher Shacklock · Lexicon Partners ·
Ondra Partners · Fenchurch Advisory · Rippledown · Marlborough Partners · Natrium · Fairmount ·
Momentum (name unconfirmed — flagged as uncertain in the assignment itself) ·
Dyal (flagged as uncertain in the assignment itself)

**European / mid-market M&A:** Alantra · DC Advisory · Lincoln International

**US mid-market with London offices:** William Blair London · Baird London ·
Harris Williams London · Raymond James London · Stifel London

**UK brokers / small & mid-cap:** Canaccord Genuity · Panmure Liberum · Peel Hunt ·
Deutsche Numis · Cavendish · Zeus Capital · Singer Capital Markets · Shore Capital ·
Investec London

**Private capital advisory / placement / secondaries:** Rede Partners · Campbell Lutyens ·
PJT Park Hill · Eastdil Secured London

Two names on the assignment carried question marks from the orchestrator (`Dyal?`, `Momentum?`)
and I could not resolve either — Dyal Capital is an asset manager/GP-stakes firm rather than an
advisory boutique, so it may have been misfiled into this segment. Worth the orchestrator
confirming before the re-run.

## Dead ends

**None recorded — and that is a finding, not an omission.** A dead end means "checked, nothing
relevant". I checked nothing, so classifying any of the 41 firms as a dead end would be a false
negative that removes a real target from the candidate's list. All 41 stay in the UNCHECKED list
above.

## Intel

Everything in this section is a **tooling/process observation from this run**. I am recording no
deadline dates, no recruiter names and no application quirks, because I could not open a single
source and the BRIEF forbids inventing them.

- **The blocker is environmental and segment-independent.** Sibling segments `11-discretionary-hf`,
  `12-megacap-pe`, `13-midmarket-pe` and `15-vc-tier1` hit the identical `EGRESS_BLOCKED` +
  exhausted-search-budget pair. This is not a property of boutique banks being hard to research;
  re-running this segment unchanged in the same environment will produce the same empty result.
- **Search budget is a shared, session-wide pool consumed in parallel.** By the time this segment
  started, earlier segments had spent all 200 calls. If the orchestrator re-runs a multi-segment
  fan-out, the budget needs either raising or explicit per-segment rationing, otherwise later
  segments in the fan-out deterministically get zero coverage — as happened here.
- **Prioritise this segment in the re-run.** Per the BRIEF's own reasoning, boutiques hire
  off-cycle interns ad hoc and often unadvertised, which makes them the highest-yield segment for
  Track A (start Oct/Nov 2026) — and the one where a speculative email is most likely to land.
  A zero-coverage result here costs more than a zero-coverage result in any other segment.
- **On the re-run, the highest-value output for this segment is contacts, not listings.** Because
  boutique off-cycle hiring is largely unadvertised, the ATS-board sweep the BRIEF recommends will
  under-report it. The re-run should explicitly target each firm's generic
  careers/recruitment inbox and any named early-careers/talent contact, and treat an empty job
  board as a speculative target rather than a dead end.
