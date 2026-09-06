# Mid-market PE & growth equity, London (13-midmarket-pe)

> **RESEARCH BLOCKED — READ THIS FIRST.**
> This segment could not be researched. Two independent blockers:
> 1. **WebFetch / all outbound HTTPS is denied by the organization egress proxy.** Every host
>    tried returned `EGRESS_BLOCKED` / `CONNECT tunnel failed, response 403` — including
>    `www.inflexion.com`, `www.livingbridge.com`, `www.bgf.co.uk`, `www.ldc.co.uk`,
>    `boards.greenhouse.io`, `job-boards.greenhouse.io`, and even `en.wikipedia.org`.
>    This is a policy denial, not a transient error, so no careers page or ATS board could be
>    opened. Per BRIEF rule 4, **nothing below can be marked VERIFIED.**
> 2. **The session-wide WebSearch budget was exhausted (200/200 calls) while this segment ran.**
>    Only 4 searches completed before the cap; the remaining ~35 firms were never searched.
>
> Consequence: I will not populate careers-page URLs or contacts for firms I could not check.
> BRIEF rule 2 forbids inventing a URL, and firm careers URLs are guessable — guessing them
> would put unverified links in front of the candidate. Everything recorded below is something
> I actually saw in a returned search result.
>
> **To unblock:** raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` and allowlist company
> careers domains + ATS hosts (greenhouse.io, lever.co, ashbyhq.com, workable.com,
> teamtailor.com, myworkdayjobs.com, smartrecruiters.com) in the egress policy, then re-run
> this segment.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| — | *No role found. See blocker note above — no listing could be opened, so no Track A role can be reported for this segment.* | — | — | — | — | — | — |

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| — | *No programme found. Not researched — see blocker note above.* | — | — | — | — | — |

## Speculative targets (no open role, worth emailing)

Only the two firms I actually got search results for are listed with detail. The rest of the
assigned list is recorded below as **not yet researched** so the orchestrator knows the coverage
gap precisely — they are not dead ends, they are unchecked.

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| LDC | UK mid-market PE, regional office network, high deal volume — the kind of team that runs origination/screening at scale, which is exactly the Maxis AI screening angle. | `https://www.ldc.co.uk/careers/` — title "Private Equity Careers \| Careers at LDC" appeared as a live search result. **UNVERIFIED — page could not be opened.** | A search summary surfaced `careers@ldc.co.uk`, but that summary also conflated LDC (UK PE, ldc.co.uk) with Louis Dreyfus Company (ldc.com). **Treat the address as unconfirmed and re-verify before emailing.** |
| Livingbridge | £2m–£70m cheques into fast-growing tech/services/healthcare/consumer companies; heavy proprietary origination, so an AI screening tool over 50,000+ companies is a direct pitch. | Not opened (egress blocked). Bright Network employer profile exists: `https://www.brightnetwork.co.uk/graduate-employer-company/livingbridge/` — **UNVERIFIED.** | A Livingbridge LinkedIn post tagged `#internship` exists (`https://www.linkedin.com/posts/livingbridge_privateequity-internship-activity-7085544955238043648-P3M4`) but its activity ID dates to **2023** — evidence they have run internships historically, **not** evidence of anything open now. |
| Inflexion | European mid-market, £10m–£400m equity per deal, offices London/Manchester/Amsterdam/Stockholm. | Not opened (egress blocked). | A Glassdoor result claimed "5 inflexion jobs in London" but **no role titles were returned** — I cannot say whether any is an intern role. Company LinkedIn: `https://uk.linkedin.com/company/inflexion-private-equity`. |
| ECI Partners, Graphite Capital, Exponent, Epiris, Charterhouse, Duke Street, Equistone, Palatine, NorthEdge, Foresight Group, Elysian Capital, Horizon Capital, Sovereign Capital, August Equity, Growth Capital Partners, YFM, BGF, Beech Tree, Tenzing, FPE Capital, Perwyn, Pollen Street, Cairngorm, Bowmark, Apiary, Vitruvian Partners, Summit Partners London, TA Associates London, Bregal Milestone, Five Arrows (Rothschild), Keensight London, PSG Europe, Highland Europe, Eurazeo London | **NOT RESEARCHED.** Assigned but never reached — search budget hit its cap and every careers domain was egress-blocked. All remain plausible speculative targets on the segment thesis (mid-market funds take off-cycle/part-time interns far more readily than mega-funds, and AI-driven deal sourcing is a live need at every one of them). | — | — |

## Dead ends

None established. **No firm in this segment was ruled out** — the empty tables above reflect a
tooling failure, not an absence of opportunities. Do not read this file as evidence that
mid-market PE has nothing open.

## Intel

- **Tooling, for the orchestrator:** `WebFetch` is unusable in this session — the egress proxy
  returns 403 on CONNECT for every host, including Wikipedia and Greenhouse. Any segment agent
  reporting "VERIFIED" rows in this session should be spot-checked, because opening a live
  listing was not possible for me. The WebSearch cap (200) is also session-wide and shared
  across all segments, so late-numbered segments get starved. Consider allocating a per-segment
  search budget or running segments in separate sessions.
- **Segment thesis still holds and is worth re-running.** Mid-market and growth funds are the
  right target for this candidate: small teams, no rigid campus-recruiting calendar, and
  origination/screening workloads that a 17-agent-system builder can visibly reduce. The Maxis
  AI screening system over 50,000+ companies is the lead line in any speculative email — most
  of these funds are actively trying to build exactly that in-house.
- **One genuinely observed adjacent data point (out of segment, flagged for whoever owns
  mega-funds):** a "2026 Blackstone Private Equity H2 Off Cycle Internship (London)" appeared in
  search results at
  `https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Campus_Careers/job/XMLNAME-2026-Blackstone-Private-Equity-H2-Off-Cycle-Internship--London-_40745`.
  **UNVERIFIED** — the page could not be opened, so its status and dates are unknown, and H2
  2026 timing may already be past for an Oct/Nov start. It is also **full-time**, not part-time.
  Passing it along rather than dropping it.
- **Method note for the re-run:** LinkedIn post activity IDs encode a timestamp. The Livingbridge
  "#internship" post above resolves to 2023, which is why I did not record it as current. Worth
  applying the same check elsewhere — several search summaries present old LinkedIn hiring posts
  as though they were live.
