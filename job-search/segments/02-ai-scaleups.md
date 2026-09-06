# London AI/LLM scaleups (Series A–C) (02-ai-scaleups)

> **TOOLING FAILURE — READ FIRST.** This segment is materially incomplete and it is not a coverage
> judgement, it is an environment failure. Two things broke:
>
> 1. **All outbound fetching is blocked by this session's egress proxy.** `WebFetch` and `curl` both
>    return `EGRESS_BLOCKED` / `403 CONNECT` for *every* host tried, including
>    `api.ashbyhq.com`, `jobs.ashbyhq.com`, `boards-api.greenhouse.io`, `job-boards.greenhouse.io`,
>    `www.synthesia.io`, `elevenlabs.io`, `careers.legora.com`, and even `en.wikipedia.org` and
>    `www.google.com`. The BRIEF's assumption that "these boards are fetchable" does not hold here.
>    I could not open a single live listing, so **nothing below can be marked VERIFIED** — every row
>    is `UNVERIFIED` by definition, sourced from search snippets only.
> 2. **The session-wide WebSearch budget ran out** (200/200 used, shared with sibling segment agents)
>    after 10 searches on this segment. Roughly 25 of the ~32 named companies were never searched.
>
> Companies I never got to check: Genie AI, Cradle, Nabla, Tortus, Anterior, Orbital Witness,
> Humanloop, Weights & Biases London, Lindy, Dust, Cursor/Anysphere, V7 Labs, Encord, Zeki Data,
> Peak AI, Signal AI, Unitary, Aveni, Trudo, Fathom, Granola, Cognition, Sana, Corti, Doctolib,
> and Harvey's London office. **This segment should be re-run** once egress or search budget is restored.

## Track A — open now, part-time / start Oct-Nov 2026

| Company | Role | Location / Pattern | PT? | Deadline | Status | Apply URL | Fit note |
|---|---|---|---|---|---|---|---|
| Junior AI | Software Engineering Intern — Fall 2026 | London **and** New York; ~28-person bootstrapped/profitable startup | Not stated — presume **full-time** | Not stated | UNVERIFIED (snippet only; could not open Ashby) | https://jobs.ashbyhq.com/junior/23ee686b-d305-4ac9-860d-16c99ddb4891 | **Best timing match in the segment.** "Fall 2026" = the Oct/Nov window we want. Snippet says intern is "embedded directly in the engineering team and owns a meaningful project end-to-end". Small team = the kind of place that will flex to 2–3 days/week if asked. Engineering-leaning, so Omer should lead with the 17-agent trading system and Today+ build, not the PE work. **Must confirm London-vs-NY and whether PT is possible.** |
| Undisclosed early-stage visual AI startup (via Jack & Jill) | AI Workflows Intern | London | Not stated | Not stated | UNVERIFIED (snippet only) | https://talents.studysmarter.co.uk/companies/jack-jill-external-ats/london/ai-workflows-intern-at-early-stage-visual-ai-startup-29031080/ | Snippet says **paid**, with "potential for a senior full-time role". "AI workflows" is close to what Omer already builds (multi-agent pipelines, LLM content systems). Early-stage + an agency-style ATS front-end usually means rolling, non-cycle hiring — good for an Oct start. Company name not disclosed in the snippet. |
| PolyAI | Research Internship | London (snippet says remote possible) | Not stated | Not stated | UNVERIFIED — **date unknown, may be closed** | https://startup.jobs/research-internship-poly_ai-4219753 · board: https://poly.ai/careers | Snippet: "build and test the latest generative models... alongside research or applied teams on real, cutting-edge AI problems." London-HQ'd conversational-AI scaleup. `startup.jobs` mirrors go stale, so treat as a lead to re-check on poly.ai/careers rather than a confirmed opening. |
| PolyAI | Summer Internship / Software Engineer (UK) | London, on-site | No | Not stated | UNVERIFIED — **almost certainly the summer cycle, wrong timing** | https://startup.jobs/summer-internship-software-engineer-uk-poly_ai-3822526 | Listed only to show PolyAI runs a real intern programme. Summer-cycle, so not startable Oct/Nov 2026 — but it means an off-cycle ask has somewhere to land. |
| Legora | Growth Intern UK | Central London, "primarily on-site" | Not stated; **paid** | Not stated | UNVERIFIED — **likely stale/closed** | https://careers.legora.com/jobs/5786689-growth-intern-uk | Strong on-paper fit: "work alongside highly motivated individuals from BCG and other leading firms", open to those "pursuing a university degree in your 3–5 year". **But two staleness signals:** the posting describes Legora as backed by "$37M" (a valuation vintage well behind its current raises), and `careers.legora.com` now fails DNS resolution entirely — the board appears to have moved. Re-check https://legora.com/careers. Worth a speculative email regardless (see below). |

**Honest read on Track A:** one genuinely well-timed lead (Junior AI, "Fall 2026"), one plausible
rolling lead (the Jack & Jill visual-AI role), and three that are either wrong-cycle or probably
expired. That is a thin result for a segment this large, and the thinness is the tooling, not the market.

## Track B — Sept 2027 graduate roles open now

| Company | Programme | Location | Deadline | Status | Apply URL | Notes |
|---|---|---|---|---|---|---|
| Legora | Legal Engineer Associate 2026 | London | Not stated | UNVERIFIED (snippet only) | https://www.brightnetwork.co.uk/graduate-jobs/legora/legal-engineer-associate-london-2026 | **Probably not usable.** The title says **2026** start, not Sept 2027 — wrong year for a summer-2027 graduate, and it is a legal-engineering track rather than finance/AI-product. Recorded only so the orchestrator knows it was seen and dismissed. |

**No Sept 2027 graduate programmes found in this segment.** That is partly the tool failure, but it is
also structurally true: Series A–C AI scaleups very rarely run dated graduate schemes with 12-month
lead times — they hire when a seat opens. Track B effort is better spent on the banking/consulting/quant
segments; this segment's value to Omer is Track A and speculative outreach.

## Speculative targets (no open role, worth emailing)

| Company | Why a fit | Careers page | Contact / route |
|---|---|---|---|
| **Farsight AI** | **Highest-conviction speculative target in the segment.** Described as "the agentic AI platform for financial services, currently helping **investment banks and private equity firms** fully automate entire, highly nuanced workflows." That is a near-exact restatement of Omer's differentiator — he built an AI screening system over 50,000+ companies *as a PE intern at Maxis*, i.e. he has already done by hand what Farsight sells. Their only surfaced listing was SWE Intern **Summer 2026** (now past), so there is no open role — but a cold email with the Maxis screening system and the 17-agent trading stack as attachments is exactly the inbound this company would open. | https://jobs.ashbyhq.com/farsight/096cdc49-06ae-4724-8f46-c58184e98334 (the expired summer listing; main board is `jobs.ashbyhq.com/farsight`) | Ashby board — could not open it to find a careers email. Route: apply into the expired/any listing with a note asking about an autumn part-time arrangement, plus founder outreach on LinkedIn. |
| **Robin AI** | London-HQ'd legal-AI scaleup (10 Devonshire Square, London). Crucially it runs an **explicit open talent pool** — "if there are no currently open vacancies that align with your career goals, submit your details and CV and they will contact you when they open a role" — which is a sanctioned speculative channel rather than a cold email into a void. ~5–7 UK roles live. | https://talents.studysmarter.co.uk/companies/robin-ai/join-robin-ais-talent-pool-london-new-york-singapore-13704893/ | **Submit to the talent pool (London/New York/Singapore)** — lowest-friction speculative action in this whole segment. Do it regardless of anything else. |
| **Cleo** | London fintech/AI assistant (7M+ users). The important detail: Cleo's London pattern is **hybrid at 1+ day per week in office**, and they hire people "based within one hour either side of London time". That is structurally compatible with a Bristol-based final-year student doing 1–2 London days — the working pattern Omer needs already exists as company policy. Consumer fintech + AI is squarely in his lane. | https://web.meetcleo.com/careers (UK) · https://www.cleo.com/careers-US | No intern listing surfaced. Route: speculative application citing the existing hybrid policy and proposing 2 days/week. |
| **Synthesia** | London-HQ'd, one of the UK's largest AI scaleups, ~38 UK roles live per aggregators, "state of the art offices in London and NYC" with hybrid/remote-from-Europe options on many roles. No intern or part-time role surfaced in search. | https://www.synthesia.io/careers | Speculative only. Large enough to have a talent team worth emailing; I could not retrieve a named contact. |
| **ElevenLabs** | London is one of its four main offices (with NY, SF, Warsaw) and it "supports working remotely". **Important intel: as of July 2026 ElevenLabs does not run a formal internship programme** — so there is nothing to apply to, and speculative/founder-route outreach is the *only* way in. Given no programme exists, a strong cold pitch has unusually little competition. | https://elevenlabs.io/careers | Speculative / cold outreach only. Note the a16z portfolio board also mirrors their roles: https://portfoliojobs.a16z.com/jobs/elevenlabs |
| **Legora** | Even though the Growth Intern posting looks stale, the *shape* of it is the tell: they hire growth interns from a BCG-adjacent talent pool and explicitly accept "3–5 year" undergraduates. A scaleup that has hired that profile once will do it again off-cycle. | https://legora.com/careers | Speculative — reference the previous Growth Intern UK role by name when emailing; it signals he knows the role exists. |

## Dead ends

- **Bloxd** — surfaced on the Ashby London-intern search (SWE Intern, King's Cross, London: https://jobs.ashbyhq.com/bloxd/7ade559a-d07d-4ffe-b6ec-c79e41632474). Excluded: it is a browser-games company, not an AI scaleup, and the role is a 3-month **summer** internship or a 6-month year-in-industry placement — both wrong timing, and the year-long placement is explicitly out of scope per the brief.
- **Cohere** — "Software Engineer Intern (Spring/Summer 2026)" appeared in the Ashby search, but the cycle is past and Cohere is Toronto/SF-HQ'd, not a London scaleup.
- **Legora "Legal Engineer Associate 2026"** — wrong start year (2026, not Sept 2027) and wrong discipline. See Track B.

## Intel

- **Blocked-domain list for whoever re-runs this** (all returned `EGRESS_BLOCKED`/403 in this session):
  `api.ashbyhq.com`, `jobs.ashbyhq.com`, `boards-api.greenhouse.io`, `job-boards.greenhouse.io`,
  `www.synthesia.io`, `elevenlabs.io`, `careers.legora.com`, `en.wikipedia.org`, `www.google.com`.
  The blanket nature (Wikipedia and Google included) says this is a session-wide egress policy, **not**
  anti-bot defences on the ATS providers. A re-run in a session with normal egress should get full
  ATS coverage cheaply, because the Ashby/Greenhouse/Lever **JSON APIs** are the efficient route:
  - Ashby: `https://api.ashbyhq.com/posting-api/job-board/<org>?includeCompensation=true`
  - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/<org>/jobs`
  - Lever: `https://api.lever.co/v0/postings/<org>?mode=json`
  These return every posting with location and title in one call — far cheaper than one search per company.
- **`careers.legora.com` no longer resolves (DNS NXDOMAIN).** Legora rebranded from **Leya**, and its
  board has moved. Note the mirror found under the old name: `careers.wayfinder.com/companies/**leya-2**/jobs/48549327-growth-intern-uk`.
  When searching Legora historically, also search **"Leya"** — a chunk of its intern history is filed under the old name.
- **ElevenLabs has no formal internship programme as of July 2026.** Do not burn time looking for one;
  go straight to speculative/founder outreach.
- **Cleo's stated London pattern is 1+ day/week in office**, and they hire within ±1 hour of London time.
  This is a written-down policy Omer can quote back at them to justify a Bristol-based part-time arrangement —
  useful precedent to cite at *other* scaleups too.
- **Series A–C AI scaleups do not run dated graduate schemes.** Expect near-zero Track B yield from this
  segment structurally; its value is Track A and speculative inbound. The BRIEF's rule 5 point is
  especially true here — Robin AI's open talent pool is the clearest example.
- **Two aggregators worth a single pass on re-run** rather than per-company searching:
  Simplify's curated list https://simplify.jobs/l/Top-AI-Startup-Internships ("Top AI Startup
  Internships 2026-2027"), and the a16z portfolio board https://portfoliojobs.a16z.com — the latter
  covers ElevenLabs and many peer London AI companies in one place.
- **Search-syntax note:** the `site:jobs.ashbyhq.com London intern` style query the brief recommends
  works, but returns heavily US-weighted and stale results through this search tool (it surfaced
  Cohere/Farsight summer-2026 cycles alongside live London ones). Pair it with an explicit
  `Fall 2026` / `Autumn 2026` term to bias toward the Oct/Nov window — that is how Junior AI surfaced.
