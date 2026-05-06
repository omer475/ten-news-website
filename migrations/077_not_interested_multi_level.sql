-- Migration 077 — Multi-level Not Interested propagation tables.
--
-- TikTok's own help page says Not Interested propagates to "similar
-- content" across multiple levels: item, creator, audio, hashtag,
-- codebook-cluster. Our existing handler propagates to leaf cluster
-- (user_leaf_suppress), entity signals (bulk_update_entity_signals),
-- and bandit arms — but NOT to publisher (article.source) or to the
-- Trinity VQ primary, which are the granularities Trinity v5 actually
-- consumes.
--
-- Two new TTL-indexed tables. expires_at handles decay automatically:
-- a rows past its TTL is no longer returned by the read paths. Twitter
-- open-source assigns explicit-negative weight ~150× explicit-positive,
-- decaying over 7-30 days; we use a 14d window for publisher penalty
-- (matching user_leaf_suppress) and 48h for the primary cooldown
-- (matching the existing NOT_INTERESTED_COOLDOWN_HOURS constant in
-- lib/trinity.js).

-- 1. Per-user publisher penalty: 0.5× score multiplier in Trinity rerank
--    until expires_at. Lighter than leaf-cluster suppression because a
--    publisher you mostly like can still post the occasional bad article;
--    we want soft demote, not hard exclude.
CREATE TABLE IF NOT EXISTS user_publisher_penalty (
  user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  publisher    text    NOT NULL,
  penalty      real    NOT NULL DEFAULT 0.5,
  expires_at   timestamptz NOT NULL,
  source_article_id bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, publisher)
);

CREATE INDEX IF NOT EXISTS idx_user_publisher_penalty_expires
  ON user_publisher_penalty (user_id, expires_at);

-- 2. Per-user VQ-primary cooldown: 48h soft-exclude from Trinity-M and
--    Trinity-LT retrieval (already wired in lib/trinity.js as the
--    cooldownPrimaries opt). Explore can still pick — that's the
--    "we'll show fewer like that" softness vs. blocklist.
CREATE TABLE IF NOT EXISTS user_primary_cooldown (
  user_id      uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vq_primary   smallint NOT NULL,
  expires_at   timestamptz NOT NULL,
  source_article_id bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vq_primary)
);

CREATE INDEX IF NOT EXISTS idx_user_primary_cooldown_expires
  ON user_primary_cooldown (user_id, expires_at);

COMMENT ON TABLE user_publisher_penalty IS
  'Per-user publisher demote multipliers from Not Interested events. Phase 1 fix #9.';
COMMENT ON TABLE user_primary_cooldown IS
  'Per-user Trinity vq_primary cooldown from Not Interested events. Phase 1 fix #9.';

-- Enable RLS on both tables. Service-key writes (track.js) and reads
-- (trinityServe.js) bypass RLS, but enabling RLS prevents accidental
-- writes from anon/authenticated clients.
ALTER TABLE user_publisher_penalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_primary_cooldown ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_publisher_penalty_self_select ON user_publisher_penalty
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_primary_cooldown_self_select ON user_primary_cooldown
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
