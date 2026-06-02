-- Migration 121: allow NULL cluster_id for curated (Pipeline 2) articles
-- ======================================================================
-- published_articles.cluster_id was NOT NULL (every Pipeline 1 article comes
-- from an event cluster). Pipeline 2 curated posts have no cluster, so the
-- insert failed with a 23502 not-null violation. Pipeline 1 still always sets
-- cluster_id; only curated rows leave it NULL. Dedup queries that filter by a
-- concrete cluster_id are unaffected (NULL never matches a real id).

ALTER TABLE published_articles ALTER COLUMN cluster_id DROP NOT NULL;
