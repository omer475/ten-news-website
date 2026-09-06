# CANDIDATE BRIEF — London job/internship search

**Today's date: 6 September 2026.** Treat anything with a deadline before this date as closed.

## Candidate
- **Name:** Omer Sogancioglu
- **Email:** soganciogluomer@gmail.com · **Phone:** +44 7778 392213
- **Right to work:** Indefinite Leave to Remain (UK). NO sponsorship needed, NO hour restrictions. Fully eligible for every UK employer including banks, quant funds and defence-adjacent employers that refuse sponsorship.
- **Education:** BSc Business Analytics, University of Bristol, final year, expected graduation summer 2027. Prior: Université de Genève (Particle Physics short course), Brown University (Quantum Mechanics short course).
- **Based:** Bristol during term; London ties (family address). Can be physically in London 1–2 fixed days/week, more in vacations.
- **Experience:** Private Equity Intern at Maxis (Aug–Sep 2025) — built an AI screening system analysing 50,000+ companies; Private Equity Intern at Ünlü & Co (Aug–Sep 2024); Investment Services Intern at Ünlü & Co (Jun–Jul 2023); Analyst, Bristol Investment Fund (Sep 2024–present); Equity Analyst, Bristol Trading Society (Sep 2023–present).
- **Projects:** *Today+* — founder, text-based social platform with ranking algorithms + autonomous LLM content systems. *Autonomous Trading Personas* — 17-agent AI system (technical/fundamental/macro/risk/sentiment agents) producing BUY/WATCH/PASS calls with a "Head Coach" aggregator and 3-stage filter. Co-founder, Bristol AI Society.
- **Differentiator:** the overlap of **applied AI / multi-agent systems** with **investment analysis**. Pitch him into AI-native finance, VC, fintech, quant and AI product roles.

## What we are looking for — TWO TRACKS

### Track A — IMMEDIATE (the priority)
A **part-time internship in London he can start next month (October/November 2026)** and work alongside final-year study.
- Part-time (≈1–3 days/week), OR flexible hours, OR remote/hybrid with 1–2 London days.
- Titles to look for: Intern, Part-time Intern, Working Student, Venture Fellow, VC Scout, Analyst Intern, Research Intern, AI/ML Intern, Data Intern, Investment Intern, Off-cycle Intern, Placement (non-year-long), Campus Ambassador (paid), Freelance/Contract Analyst.
- Off-cycle internships (3–6 month, full-time) count ONLY if they can start Oct/Nov 2026 — flag them clearly as full-time so we can decide.
- Paid strongly preferred; note pay if stated.

### Track B — GRADUATE, Sept 2027 start
Graduate schemes / full-time analyst programmes open for application NOW (autumn 2026) for a **September 2027 start**, for a candidate graduating summer 2027.
- IB analyst programmes, consulting associate/analyst, grad schemes, quant researcher/trader grad roles, AI/ML grad roles, rotational programmes.
- NOTE: Summer 2027 internships are for penultimate-year students and are usually NOT open to him — only include one if the employer explicitly allows final-years/graduates, and say so.

## RULES — READ CAREFULLY
1. **Load web tools first:** call `ToolSearch` with query `select:WebSearch,WebFetch` before anything else.
2. **Never invent a role, URL, or deadline.** Every listed role must come from a page you actually fetched or a search result you actually saw. If you could not open the page, say so.
3. Prefer **company career pages and ATS boards** (greenhouse.io, lever.co, ashbyhq.com, workable.com, teamtailor, workday `myworkdayjobs.com`, smartrecruiters) — these are fetchable. LinkedIn/Indeed/Glassdoor often block fetching; if blocked, use WebSearch results and mark the row `UNVERIFIED`.
4. Mark every row **VERIFIED** (you opened the live listing and it is open) or **UNVERIFIED** (search snippet only).
5. If a company has **nothing open**, still record its careers-page URL and whether it historically takes part-time/off-cycle interns, plus any public contact (careers email, talent lead) for a **speculative application**. Speculative targets are valuable — VCs and startups hire interns off inbound emails constantly.
6. Be honest about volume. A short list of real, open, applicable roles beats a long list of maybes. Do NOT pad.

## OUTPUT
Write your findings to `/tmp/claude-0/-home-user-ten-news-website/8e615759-04aa-557b-a29a-9fe90c4979dc/scratchpad/jobsearch/<YOUR_SEGMENT_ID>.md` using EXACTLY this structure:

```
# <Segment name> (<segment id>)

## Track A — open now, part-time / start Oct-Nov 2026
| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|

## Track B — Sept 2027 graduate roles open now
| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|

## Speculative targets (no open role, worth emailing)
| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|

## Dead ends
Companies checked with nothing relevant and no speculative value — one line each.

## Intel
Anything useful: deadline patterns, "applications open in October", recruiter names, referral routes, application quirks.
```

Then return a SHORT summary to the orchestrator: number of Track A roles found, number of Track B, and the 3 single best opportunities with URLs. Do not repeat the whole table in your reply.
