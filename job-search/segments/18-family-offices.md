# Family offices, sovereign wealth funds & endowments, London (18-family-offices)

> **RESEARCH NOT COMPLETED — NO NETWORK ACCESS.** See "Intel" at the bottom for the
> full explanation. Zero pages were fetched and zero search results were seen, so
> per BRIEF.md rule 2 ("never invent a role, URL, or deadline") every table below is
> deliberately empty. Nothing here has been checked. This segment needs a re-run in a
> session with working web access.

## Track A — open now, part-time / start Oct-Nov 2026
| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| — | none found — research blocked, see Intel | — | — | — | — | — | — |

## Track B — Sept 2027 graduate roles open now
| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| — | none found — research blocked, see Intel | — | — | — | — | — |

## Speculative targets (no open role, worth emailing)
| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| — | none recorded — I could not open a single careers page, and writing URLs or contact names from memory would breach BRIEF.md rule 2 | — | — |

## Dead ends
None — no company in this segment was actually checked, so nothing can honestly be
ruled out. The segment is **unresearched**, not empty.

## Intel

### Why this segment produced nothing

Two independent hard blockers, both environmental:

1. **WebSearch budget exhausted before this agent ran.** The first `WebSearch` call
   returned: *"Web search was not performed: this session has used its web search
   budget (200 of 200 WebSearch calls)."* The cap is session-wide and was consumed by
   sibling segment agents. Raising `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` is the
   documented fix.
2. **Outbound HTTPS to job/careers domains is blocked by the egress proxy.** Every
   `WebFetch` returned `EGRESS_BLOCKED`. Confirmed with a direct probe: the proxy
   answers `CONNECT tunnel failed, response 403` for careers and ATS hosts. Per
   `/root/.ccr/README.md`, a 403/407 is an organization egress-policy denial that must
   be **reported, not routed around**.

   Probe results (HTTP status, `000` = tunnel refused):

   | Host | Result |
   |---|---|
   | `api.github.com` | 200 (allowlisted) |
   | `job-boards.greenhouse.io` | 000 / 403 |
   | `boards.greenhouse.io` | 000 / 403 |
   | `www.linkedin.com` | 000 / 403 |
   | `efinancialcareers.co.uk` | 000 / 403 |
   | `www.google.com`, `duckduckgo.com` | 000 / 403 |
   | `wellcome.org`, `www.uss.co.uk`, `www.cppinvestments.com`, `www.gic.com.sg`, `www.nbim.no`, `www.railpen.com`, `www.stonehagefleming.com` | blocked |

   Egress is an **allowlist** (GitHub passes, nothing job-related does), so no
   alternative search engine, ATS mirror, or aggregator is reachable either. There was
   no cached ATS data in `scratchpad/jobsearch/ats/` to fall back on.

### What a re-run must cover (assigned scope, none of it checked)

**Sovereign wealth funds, London offices:** Mubadala Capital, PIF, ADIA, QIA, Kuwait
Investment Office, GIC, Temasek, Wafra.

**Global pension plans, London offices:** CPP Investments, CDPQ, OTPP, PSP, OMERS,
Alberta Investment Management (AIMCo), NBIM, Future Fund.

**UK pensions, endowments & foundations:** Wellcome Trust, USS Investment Management,
Railpen, Nest, BP Pension, Shell Asset Management, Church Commissioners for England,
Oxford University Endowment Management (OUEM), Cambridge Investment Office, Guy's &
St Thomas' Foundation.

**Family offices & multi-family offices:** Fleming Family, Sandaire/Alvarium (now AlTi),
Stonehage Fleming, Bedford Park, Cascade UK, Ilwaddi, Reuben Brothers, Lansdowne,
Pictet London, Lombard Odier London, JAB London, Exor London, Groupe Bruxelles Lambert
London, Agnelli/Lingotto, Sienna, Tetrad, Talis Capital, Hambro Perks, Dorilton, Sagitta.

### Standing hypotheses to test on re-run (NOT findings — unverified)

These are the priors that shaped the intended search plan. They are stated as
questions, not as facts, and must each be confirmed against a live page:

- **Structured programmes** are most likely at the large institutions with real HR
  functions — Wellcome, USS, CPP Investments, GIC, NBIM, Railpen, Nest. Check whether
  any run a formal internship or graduate scheme, whether the autumn 2026 window is
  open, and critically whether they accept **final-year** students (Track B) rather
  than penultimate-years only.
- **Family offices** are small and rarely post publicly, so the speculative table is
  where the value sits. The re-run should hunt for named individuals (CIO, Head of
  Investments, Head of Talent) and a direct email route, not a generic careers form.
- **Fit angle for the candidate:** Omer's 17-agent autonomous research system and the
  50,000-company AI screening build at Maxis map directly onto what a lean family
  office needs — a small team that must cover many managers and direct deals with
  little headcount. That is the pitch for cold outreach into this segment.
- **Track A pattern to look for:** 1–2 days/week research support, and note that Omer
  has Indefinite Leave to Remain, so none of these employers face a sponsorship
  obstacle.

### Recommended action for the orchestrator

Re-run `18-family-offices` once web access is restored — either raise the WebSearch
cap or get the careers/ATS domains added to the egress allowlist. Do not treat this
file's empty tables as evidence that the segment is barren.
