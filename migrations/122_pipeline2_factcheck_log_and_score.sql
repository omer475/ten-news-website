-- Migration 122: Pipeline 2 advisory fact-check log + raw-score column
-- =====================================================================
-- fact_check_log: the curated fact-verifier is now ADVISORY (logged, not
-- blocking) — store its verdict + discrepancies per published curated post
-- for later analysis. ai_final_score_raw: curated posts get a score FLOOR of
-- 650 (news-importance scorer rates evergreen ~350); keep the raw score too.

CREATE TABLE IF NOT EXISTS fact_check_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curated_brief_id     UUID,
  published_article_id BIGINT,
  verified             BOOLEAN,
  discrepancies        JSONB,
  summary              TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fact_check_log ENABLE ROW LEVEL SECURITY;  -- internal; service role bypasses

-- Raw (un-floored) score, so we can analyze the floor's effect later.
ALTER TABLE published_articles ADD COLUMN IF NOT EXISTS ai_final_score_raw INTEGER;
