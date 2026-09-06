# London job search — runbook for the next session

**Read this first, then `BRIEF.md`.** This directory holds a search that was started on
6 Sep 2026 and blocked by the environment. Everything needed to finish it is here.

---

## 1. Verify the environment BEFORE launching any agents

The previous run wasted ~1.1M tokens across 20 agents that could not reach the internet.
Do not repeat that. Run these two checks first:

```bash
# (a) Can we reach a company careers site?  Must print HTTP 200, not 000.
curl -sS --max-time 12 -o /dev/null -w "%{http_code}\n" https://careers.jpmorgan.com/

# (b) Is there web-search budget?  Run one WebSearch. If it reports
#     "used its web search budget (200 of 200)", stop and tell the user.
```

If (a) prints `000` / `CONNECT tunnel failed, response 403`, the egress policy is still
closed — **stop and report it.** Per `/root/.ccr/README.md` a proxy 403 is an
organization policy denial: report it, never route around it.

## 2. What went wrong last time

| Blocker | Detail | Fix |
|---|---|---|
| Egress policy | All outbound HTTPS 403 at the proxy — company sites, Greenhouse/Lever/Ashby, Google, even Wikipedia. Only `api.github.com`, `api.anthropic.com` and package registries were allowed. | Environment network policy must permit outbound HTTPS. Set at container creation, so it needs a NEW session. |
| Web-search budget | 200 calls, **shared session-wide across all agents at once**. 20 parallel agents drained it in their first few queries each. | Raise `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`. Budget ~60–90 searches per segment. |
| Agent concurrency | Cap is 20; segments 21–27 never launched. Raise with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, or run in waves. | Run waves of ~10 so the search budget isn't split too thin. |

## 3. Efficiency win — use the ATS JSON APIs, not one search per company

With egress open, most startups' whole job list comes back in a single request. Vastly
cheaper than a WebSearch per company:

```
https://boards-api.greenhouse.io/v1/boards/<token>/jobs
https://api.lever.co/v0/postings/<token>?mode=json
https://api.ashbyhq.com/posting-api/job-board/<token>
https://apply.workable.com/api/v1/widget/accounts/<token>
```

For big employers (J.P. Morgan, Goldman, Blackstone, Man Group) the portals are
Workday/Oracle and JS-driven — **use the pre-installed Chromium via Playwright**
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; do NOT run `playwright install`).

## 4. Segment status

Completed (partial, snippet-only, all UNVERIFIED) — in `segments/`:
`02` AI scaleups · `03` seed AI · `04` AI-in-finance · `05` consumer fintech ·
`06` B2B fintech · `07` crypto · `08` insur/wealthtech · `09` quant & prop ·
`10` systematic HF · `11` discretionary HF · `12` mega-cap PE · `13` mid-market PE ·
`14` credit & infra · `15` VC tier 1 · `16` VC seed · `17` fellowships ·
`18` family offices · `19` bulge bracket · `20` boutique IB

**Never launched — zero coverage. Start here:**

| ID | Segment | Priority |
|---|---|---|
| `21` | Strategy consulting (MBB, OW, Kearney, LEK, Roland Berger, OC&C, A&M, AlixPartners…) | 2027 deadlines cluster Sept–Oct, urgent |
| `22` | Big 4 + economic consulting (Frontier, Oxera, NERA, CRA, Compass Lexecon…) | Rolling, fills early |
| `23` | Big tech London (Google, Amazon, Microsoft, Bloomberg, Palantir, Stripe…) | Bloomberg analytics = strong fit |
| `24` | Data & enterprise software (Quantexa, Faculty, Kubrick, dunnhumby, Dataiku…) | Analytics grad schemes |
| `25` | Asset managers (BlackRock, Schroders, Fidelity, Baillie Gifford, M&G, LGIM…) | Autumn deadlines |
| `26` | Brokers, exchanges, market data (LSEG, MSCI, S&P, Moody's, IG, Hargreaves…) | Good analytics fit |
| `27` | Startup board sweep (Otta, Wellfound, Ashby/Greenhouse/Lever dorks, workinstartups) | **Highest Track A yield** |
| `28` | Mainstream boards (eFinancialCareers especially, Reed, Adzuna, Totaljobs) | eFC = off-cycle City roles |
| `29` | Student platforms (Bright Network, SEO London, TargetJobs, RateMyPlacement, Milkround) | SEO London = access + referrals |
| `30` | London consumer/media scaleups (FT, Economist, BBC, Sky, Deliveroo, Depop…) | Today+ narrative fit |

**Also re-run `19` and `20` first** — bulge-bracket banks got zero searches, and boutique
banks are the likeliest source of an unadvertised off-cycle internship startable in
October. Both are high value and both came back empty.

## 5. Then verify the 146 existing leads

`leads.json` holds every lead with a URL. With egress open, fetch each and mark it
genuinely open / closed / 404. Rewrite `board.html` with real statuses and republish to
the SAME artifact URL (pass it as `url` to the Artifact tool):

```
https://claude.ai/code/artifact/83dd4b0a-c842-4374-a598-f784a74a3531
```

The board declares the `db` capability, so any application ticks the user has made are
stored server-side in the `applications` collection and can be read back with `read_db`.
**Preserve them** — don't clobber the user's progress when republishing.

## 6. Open question for the user

The CV reads *University of Bristol 2023–2026* but he says he is in his final year. This
runbook assumes **graduation July 2027**, which makes Track B = Sept 2027 graduate
schemes. If he actually graduated in 2026, Track B becomes immediate full-time roles and
the whole second half of the search changes. Confirm before doing Track B work.
