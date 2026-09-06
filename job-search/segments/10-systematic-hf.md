# Multi-strategy & systematic hedge funds, London (10-systematic-hf)

> **TOOL FAILURE — READ THIS FIRST.**
> Two hard blocks stopped this segment from being completed:
> 1. **WebFetch is 100% unavailable in this environment.** Every domain tried returned
>    `EGRESS_BLOCKED` from the network egress proxy — including `www.man.com`, `www.mwam.com`,
>    `job-boards.eu.greenhouse.io`, `boards.greenhouse.io`, `mangroupplc.wd3.myworkdayjobs.com`,
>    `www.brightnetwork.co.uk`, `app.the-trackr.com`, `www.efinancialcareers.co.uk`, and even
>    `en.wikipedia.org`. A direct `curl` test also failed (`CONNECT tunnel failed, response 403`).
>    **No live listing could be opened, so per BRIEF rule 4 every row below is `UNVERIFIED`.**
> 2. **The session-wide WebSearch budget was exhausted (200/200) after 6 searches from this agent.**
>    Only Man Group and Marshall Wace were reached. The other ~30 firms in my remit were never
>    searched at all and are listed under "Not checked" — I have deliberately not written rows,
>    URLs or deadlines for them rather than invent any.
>
> This segment needs a re-run with `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` raised and, ideally,
> egress allowed to `*.greenhouse.io` / `*.myworkdayjobs.com` / `*.lever.co`.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| — | Nothing found | — | — | — | — | — | No part-time or Oct/Nov-start off-cycle internship surfaced at Man Group or Marshall Wace. Both run fixed-window summer/placement programmes only. See "Ruled out" below for the three MW placements that exist but exclude him. |

**Ruled out for Track A (checked, he is not eligible):**
- **Marshall Wace — Quant Research Internship (London).** Eligibility seen in search result: *"currently enrolled in the penultimate year of a Master's or PhD program in a STEM subject, with a graduation/defence date set in 2027."* Omer is a BSc final-year → **not eligible**. (The page also still showed last cycle's dates, 29 Jun – 4 Sep 2026, deadline 12 Jan 12pm GMT — i.e. stale content; the 2027-cycle version was not reachable.) Board: `https://job-boards.greenhouse.io/mwinternshipprogram/jobs/8145488002`
- **Marshall Wace — AI Placement 2027 (6-month, April–September 2027, London).** Reads as an excellent content fit (production code across Finance, Ops, Risk, Trading, PM), **but it is ring-fenced to Imperial College London MEng Computing / Maths & Computing placement students**. Bristol BSc Business Analytics → not eligible. Also full-time and starts April 2027, so wrong window for Track A anyway. `https://job-boards.greenhouse.io/mwinternshipprogram/jobs/8620541002`
- **Marshall Wace — Technology Intern, London, 2027.** Summer software engineering internship, penultimate-year shaped, wrong window. `https://job-boards.greenhouse.io/mwinternshipprogram/jobs/8598324002`

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| Marshall Wace | Fundamental Analyst Programme (2-year graduate programme into the Fundamental Investment teams — the "TOPS-side" analyst track) | London (also NY, HK, Singapore, Shanghai) | **No fixed deadline — rolling.** Applications opened **17 Aug 2026**; in-person tests from **21 Sept 2026**; firm states positions are **expected to be filled by December** → apply immediately | UNVERIFIED (mwam.com egress-blocked; dates from search result summary of mwam.com application-process page) | `https://www.mwam.com/join-us/fundamental-analyst/` (programme) · `https://www.mwam.com/quantitative-application-process/` (process/key dates) | **Highest-priority item in this segment.** Open right now and closing by attrition. Process: CV screen → in-person assessment at a local centre → Human Capital screening call → video interview → Assessment Day → Final Round Management Interview. Placed into one investment team for the full 2 years, with possible rotation into a second team. Training explicitly includes **Quantamental Research**, Risk, Trading and Technology — that is the exact seam Omer's 17-agent trading-persona system sits on. *Caveat: the "opened 17 Aug 2026 / tests 21 Sept / filled by December" dates came back in a summary that blended the Fundamental and Quantitative application-process pages; confirm which programme they attach to before relying on them.* |
| Marshall Wace | Quant Associate Programme — Research & Implementation | London | Not obtained | UNVERIFIED (page never opened) | `https://www.mwam.com/quantitative-associate-programme/` | Exists and is the graduate-level quant entry route. Eligibility bar unknown — MW's quant *internship* demands Master's/PhD STEM, so a BSc Business Analytics candidate may be screened out here too. Worth an application but treat the Fundamental programme as the realistic route. |
| Man Group (Man AHL) | AHL Quant Research Graduate Programme | London | Not obtained | UNVERIFIED (man.com + Workday + Greenhouse all egress-blocked) | `https://www.man.com/graduate-programmes` · board: `https://mangroupplc.wd3.myworkdayjobs.com/Man_Group_Careers` | Four 6-month rotations across alpha research, portfolio construction, execution research, risk management; mentor assigned. **Stated requirement: strong mathematical/statistical/computing degree — "Mathematics, Computer Science, Engineering or Physics" — plus Python.** Business Analytics is off-list; this is a stretch application unless the physics short courses (Geneva, Brown) and the multi-agent build are pushed hard. |
| Man Group (Man AHL) | AHL IDI (Investment & Data Implementation) Graduate Programme | London | Not obtained | UNVERIFIED (Workday egress-blocked) | Req seen in search results: `https://mangroupplc.wd3.myworkdayjobs.com/en-US/Man_Group_Careers/job/AHL-IDI-Graduate-Analyst_JR005494` | **The better Man Group fit than Quant Research.** 2-year, four 6-month rotations across **data science, quantitative implementation, trade operations, middle office accounting**. Degree bar is materially softer than the pure quant track and "data science + implementation" maps directly onto the AI screening system he built at Maxis. Whether this specific req is the current (2027-start) opening could not be confirmed. |
| Man Group (GLG) | GLG Graduate Analyst | London | Not obtained | UNVERIFIED (Workday egress-blocked) | Req seen in search results: `https://mangroupplc.wd3.myworkdayjobs.com/en-US/Man_Group_Careers/details/GLG-Graduate-Analyst_JR004530` | Man GLG is the discretionary long/short arm — a fundamental-analyst-shaped grad seat rather than a systematic one. Req number is low (JR004530 vs the IDI JR005494), so this may be an older/closed posting. Verify before applying. |

**Man Group application mechanics (from search results, unverified):** graduate schemes are 18–24 month rotational programmes across investment management, research, technology and operations; candidates apply via the online careers portal and must attach the specific supporting documents named on each job advert — Man Group is explicit that these document instructions are followed strictly. Man Group runs **three** boards that all surfaced live: `man.com/careers`, the Workday portal, and `job-boards.eu.greenhouse.io/mangroup`. Check all three — grad reqs appeared on Workday, not Greenhouse.

## Speculative targets (no open role, worth emailing)

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| Man Group | Runs an **AHL Summer Intern Quant Talent Programme** (the 2026 edition was live and indexed on Bright Network and builtin.com, as was a 2025 edition) — a recurring annual pipeline. The 2027 edition was not reachable but is very likely to open this autumn/winter. Also the only firm in this segment confirmed to run *two* differently-pitched grad tracks, so a speculative note can ask to be considered for IDI as well as Quant Research. | `https://www.man.com/students-and-graduates` · `https://www.man.com/graduate-programmes` | No named recruiter or careers email obtained (pages unreachable). Route: apply to AHL IDI on Workday and add a covering note asking for consideration across AHL tracks. |
| Marshall Wace | Rolling, attrition-based grad hiring plus a **separate `mwinternshipprogram` Greenhouse board** that carries bespoke, non-standard placements (a 6-month AI Placement, a Technology Placement Year). A firm that will spin up a named 6-month AI placement for one university is a firm that will read a speculative note from an AI-native candidate. | `https://www.mwam.com/join-us/` · boards: `https://job-boards.greenhouse.io/mwinternshipprogram` (EMEA) and `https://job-boards.greenhouse.io/mwnaintern` (North America) | No careers email obtained. Route: apply to the Fundamental Analyst Programme now; separately watch the `mwinternshipprogram` board for a non-Imperial AI/data placement. |

## Dead ends

None established. **Nothing in this segment was checked and cleared** — the absence of rows is a tool failure, not a finding.

## Not checked (search budget exhausted before reaching them)

The following firms from my remit were **never searched**. No conclusion of any kind should be drawn about them, and I have not guessed careers URLs for any of them:

Millennium London · Balyasny London · Point72 & Cubist London · Schonfeld London · ExodusPoint London · Verition London · Walleye London · Eisler Capital · Brevan Howard · Capula · Winton · Aspect Capital · Cantab/GAM Systematic · Systematica · Florin Court · Gresham Investment · Rokos Capital · Caxton London · Tudor London · AQR London · Two Sigma London · D.E. Shaw London · Bridgewater UK · PDT London · Voleon London · Quantitative Brokers · Arrowstreet London · Acadian London · Campbell · Graham Capital London.

Several of these are known to run named grad/academy programmes that are worth prioritising on a re-run — in particular **Point72 Academy / Point72 Quant Academy / Cubist**, **Balyasny**, **Millennium**, **AQR**, **Two Sigma** and **D.E. Shaw**. That is prior knowledge, not a search result, and must be verified before it reaches the candidate.

## Intel

- **Egress reality for future runs.** `WebFetch` returns `EGRESS_BLOCKED` for every domain in this environment, including generic ones. Any segment agent relying on "prefer fetchable ATS boards" will fail the same way — the ATS boards are blocked too. `WebSearch` result *summaries* are the only channel that actually reaches page content, so the search budget is the binding constraint, not the choice of domain.
- **Search budget is session-wide, not per-agent.** This agent got 6 searches before hitting 200/200. If segments are fanned out in parallel, the budget needs raising in proportion to the number of segments, or early segments will starve the later ones.
- **Marshall Wace timing is the actionable intel.** Applications opened **17 Aug 2026** and the firm expects seats **filled by December**, with in-person tests already running from **21 Sept 2026**. It is 6 September — this is a live, closing-by-attrition window. It is the single most time-critical thing found in this segment.
- **Marshall Wace runs at least two separate Greenhouse boards** — `mwinternshipprogram` (EMEA/London) and `mwnaintern` (North America). Searching only the main mwam.com site misses live reqs; the Greenhouse boards carry the bespoke placements.
- **Marshall Wace quant roles gate on Master's/PhD.** The quant *internship* explicitly requires penultimate-year Master's or PhD in a STEM subject. Assume the Quant Associate Programme carries a similar bar. The **Fundamental** Analyst Programme is the open door for a BSc candidate, and it explicitly trains analysts in Quantamental Research — so it is the route that still lands him next to systematic work.
- **Man AHL quant gates on degree discipline** ("Mathematics, Computer Science, Engineering or Physics"). **AHL IDI is the softer, data-science-flavoured sibling programme** and is the stronger application for this candidate. Applying to IDI rather than Quant Research is a meaningful strategy call.
- **Man Group document discipline.** Search results twice emphasised that applicants must supply the specific supporting documents named on the individual job advert. Expect a transcript requirement; read each advert literally.
- **Some indexed Marshall Wace / Man Group pages still show prior-cycle content** (e.g. the MW quant internship page showing a 29 Jun – 4 Sep **2026** internship and a 12 Jan deadline). Do not transcribe dates off cached or search-summarised pages into the candidate's tracker without opening the live req.
