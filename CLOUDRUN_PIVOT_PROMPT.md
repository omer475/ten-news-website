# Cloud Run handoff — pivot Today+ to website + newsletter only

Paste this into the other Claude Code terminal (the one that owns Cloud Run / the Python pipeline).

---

## Context

We're pivoting Today+ back to a focused **news platform**. Going forward only **two surfaces** run:

1. The **website** (Next.js on Vercel)
2. The **email newsletter** (Resend daily digest)

The **iOS app is being shut down.** Both the website and the newsletter read the **same** content from Supabase `published_articles`, produced by the article-generation pipeline on Cloud Run (GCP project `tennews-workflow`, job `tennews-workflow`, cron every ~20 min). **That pipeline must keep running — it is the content supply for both surfaces. Do NOT break it.**

The platform is going back to serious/informational news only — business, tech, science, world/politics, finance, health, "anything serious." We are removing the soft lifestyle feeds that were added during the abandoned social-platform experiment (cooking, travel, fashion, gaming, etc.).

## Tasks

### 1. Prune RSS sources in `rss_sources.py`
File: `/Users/omersogancioglu/Ten News Website/rss_sources.py` (~2305 lines). Sources are dict entries with a `'category'` field. Current per-category counts:

```
news 98 | science 59 | technology 55 | sports 32 | business 27 | entertainment 25
food 24 | gaming 22 | travel 20 | fashion 17 | consumer 17 | history 12 | humor 11
automotive 11 | music 10 | crypto 9 | space 6 | health 5 | design 5 | nature 4
pets 2 | outdoor 2 | home 2 | books 2
```

- **KEEP:** `news`, `science`, `technology`, `business`, `crypto`, `health`, `space`
- **CUT:** `food`, `travel`, `fashion`, `gaming`, `entertainment`, `music`, `humor`, `automotive`, `consumer`, `pets`, `outdoor`, `home`, `books`, `design`, `nature`
- **ASK Omer before cutting:** `sports` (32), `history` (12) — borderline, he may want sports kept.

Remove whole dict entries cleanly so the file still parses — don't delete partial lines. Verify with `python -c "import rss_sources"`. Report before/after counts per category and the new total source count.

### 2. Disable app-only Cloud Run work
Now the app is gone, find pipeline work that no longer has a consumer and propose disabling it (**confirm with Omer before turning anything off**):
- Pipeline 2 curated swipe content (`pipeline2_*.py`) — app-only swipe types
- Explore-feed precompute crons, app feed-cache warm crons
- Any push-notification jobs
Keep anything that feeds the website or the newsletter. List what you find first.

### 3. Verify content still flows
After pruning, run the pipeline once (or dry-run) and confirm it still publishes to `published_articles` with healthy volume on the reduced source set.

### 4. Stay out of the website
Do **not** touch `pages/` or `components/` — another terminal owns the website UI redesign. Coordinate only on shared `published_articles` field names if needed.

> Deploy gotcha (from prior sessions): the untracked `services/` dir must be in the Cloud Run build context or the build fails.

## Deliverables
- Per-category source counts before/after + new total
- List of app-only jobs/crons found and which were disabled (after Omer confirms)
- Confirmation the core pipeline runs and publishes post-prune
