-- Migration 119: Pipeline 2 (curated content) — schema foundation
-- =================================================================
-- Adds the curated_briefs queue, the recently_covered_topics dedup
-- tracker, and multi-page / source-type columns on published_articles.
--
-- CORRECTIONS vs the original spec (verified against live prod schema
-- 2026-05-24):
--   1. published_articles.id is BIGINT (int8), NOT uuid
--        -> curated_briefs.published_article_id is BIGINT.
--   2. published_articles.pages (jsonb) ALREADY EXISTS (page-2
--      "deeper context" feature) -> NOT re-added here.
--   3. pgvector 0.8.0 confirmed enabled -> VECTOR(384) columns OK.
--      Using HNSW (not ivfflat) so the index needs no training pass
--      and works correctly while the tables are still empty.
--   4. All DDL is idempotent (IF NOT EXISTS) so re-running is safe.

-- ── Queue for Pipeline 2 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curated_briefs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic                TEXT NOT NULL,
  brief_type           VARCHAR(30) NOT NULL,   -- list | surprising_fact | explainer | recipe | history | comparison | how_to | myth_busting
  category             VARCHAR(30) NOT NULL,   -- food | science | history | fitness | travel | news | culture | etc.
  hook_angle           VARCHAR(30),            -- curiosity | contrarian | surprising_fact | promise | utility
  page_count           INTEGER NOT NULL,       -- 3-8
  entity_source        VARCHAR(30) NOT NULL,   -- google_places | books_api | tmdb | web_search | wikipedia | recipe_api
  reasoning            TEXT,
  topic_embedding      VECTOR(384),            -- MiniLM all-MiniLM-L6-v2 (matches Pipeline 1 embedding_minilm dim)
  status               VARCHAR(20) DEFAULT 'pending',  -- pending | in_progress | published | failed
  cycle_id             UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  processed_at         TIMESTAMPTZ,
  published_article_id BIGINT,                 -- corrected: published_articles.id is bigint
  failure_reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_briefs_status
  ON curated_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_embedding
  ON curated_briefs USING hnsw (topic_embedding vector_cosine_ops);

-- ── Dedup / cooldown tracker ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS recently_covered_topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic           TEXT NOT NULL,
  brief_type      VARCHAR(30),
  category        VARCHAR(30),
  topic_embedding VECTOR(384),
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_days   INTEGER NOT NULL,
  -- Set by the app at insert (published_at + cooldown_days). NOT a generated
  -- column: `timestamptz + interval` is STABLE (timezone-dependent), which
  -- Postgres rejects for GENERATED ALWAYS.
  eligible_after  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recent_embedding
  ON recently_covered_topics USING hnsw (topic_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_recent_eligible
  ON recently_covered_topics(eligible_after);

-- ── Multi-page / source-type support on published_articles ────────
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS format VARCHAR(2);              -- A | B | C | D
-- NOTE: `pages JSONB` intentionally omitted — it already exists (page-2 feature).
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'event_cluster';  -- event_cluster | curated_brief
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS curated_brief_id UUID REFERENCES curated_briefs(id);
