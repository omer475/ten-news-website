# TODAY — the daily edition

One edition a day: ten stories, each with a commissioned illustration, set as a
full-screen poster. It is the site at `/`. The previous personalised feed is
still in the tree at `/legacy`.

## What runs

`.github/workflows/daily-edition.yml` — 05:30 UTC daily, and on demand
(`workflow_dispatch`). It runs `scripts/build_edition.py`, which does everything
in one pass:

1. **Read the wire.** Every feed in `rss_sources.py` (~480 sources), in parallel,
   keeping only items published in the last 24 hours. Undated items are kept but
   treated as ten hours old, so they cannot outrank something that just broke.
2. **Cluster.** Near-duplicate headlines across outlets collapse into one story.
   How many outlets carry it becomes a signal in its own right.
3. **Score.** `gemini-2.5-flash-lite` scores each story 0-100 for how much it
   matters and assigns a category.
4. **Rank by how instant it is.** `importance x (0.35 + 0.45·recency + 0.20·breadth)`,
   recency decaying with a six-hour half-life. A big story from an hour ago beats
   a bigger one from yesterday — that is the point of the edition.
5. **Pick ten.** At most two per category and two per source. If a thin news day
   makes that impossible the caps relax in passes rather than being abandoned.
6. **Write.** `gemini-2.5-flash` writes each story: headline, dek, three
   paragraphs, "what it changes" / "what it doesn't", plus the cover line and a
   brief for the illustrator.
7. **Commission the art.** `gemini-2.5-flash-image` draws each story at 9:16 from
   that brief, in one of ten illustration traditions (see below). The image is
   uploaded to Supabase Storage; its lower third is measured so the cover type
   knows whether to be light or dark.
8. **Publish.** Upsert into `daily_editions`, and commit the JSON under
   `public/editions/`.

## Where the edition lives

- **Supabase** — table `daily_editions` (`migrations/20260904_daily_editions.sql`),
  one row per day, the whole edition as `payload` JSONB. A new edition is live
  the moment the row lands; no deploy needed.
- **Files** — `public/editions/YYYY-MM-DD.json` and `latest.json`, committed by
  the job. This is the fallback the site reads if Supabase is unreachable.
- **Artwork** — Supabase Storage, bucket `images`, under `today/<date>/`. That
  bucket already exists and is public. Without Supabase credentials the images
  are written to `public/editions/img/<date>/` and committed instead.

`GET /api/edition` serves the current edition (Supabase first, then the file);
`?date=YYYY-MM-DD` fetches a past one.

## The illustration

`scripts/art_direction.py` holds ten complete briefs — wood engraving,
risograph, mid-century gouache, pen and wash, constructivist, cut-paper collage,
stipple portrait, technical drawing, silkscreen, editorial surrealism. The
writing model picks the tradition that suits the story and writes the *concept*
(what to draw); the brief says how it is made. Every edition uses ten different
traditions, so no two posters in a day look alike.

Tune the look by editing the briefs in that file — nothing else needs to change.
`SHARED` at the top carries the rules that apply to all ten: portrait 9:16,
full bleed, a calm lower third for the type, and no lettering anywhere in the
image.

If a story's illustration fails, that poster falls back to a plain typographic
cover rather than being dropped.

## The type

`lib/poster.js` owns the cover typography ratios (`TYPE`). The live page reads
them into CSS custom properties, and the 1080x1920 "Save poster" export measures
the same numbers on canvas, so the screen and the saved PNG agree. Change a
ratio there and both follow.

## Running it by hand

```bash
pip install -r requirements.txt
export GEMINI_API_KEY=...            # scoring, writing, illustration
export SUPABASE_URL=...              # optional
export SUPABASE_SERVICE_KEY=...      # optional
python scripts/build_edition.py

python scripts/build_edition.py --dry-run   # feeds, clustering and ranking only,
                                            # no AI calls, no images
```

The dry run is the fast way to check the wire and the ranking after touching the
scoring weights.
