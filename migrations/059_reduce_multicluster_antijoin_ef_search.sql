-- Same ef_search reduction as migration 058, applied to the antijoin variant.
-- Profiling (EXPLAIN ANALYZE): match_articles_multi_cluster_minilm_antijoin
-- took 1,862 ms per call with ef_search=800. After fix: 55 ms. 34× speedup.
-- This RPC is the personal-retrieval path for users with userId +
-- interest clusters + minilm, which is the primary production path.
-- Applied to prod via MCP on 2026-04-22.

CREATE OR REPLACE FUNCTION public.match_articles_multi_cluster_minilm_antijoin(
  p_user_id uuid,
  match_per_cluster integer DEFAULT 10,
  hours_window integer DEFAULT 168,
  min_similarity double precision DEFAULT 0.0
)
RETURNS TABLE(id bigint, similarity double precision, cluster_index integer)
LANGUAGE plpgsql
AS $function$
BEGIN
  SET LOCAL hnsw.ef_search = 200;
  RETURN QUERY
    SELECT DISTINCT ON (sub.id) sub.id, sub.similarity, sub.cluster_index
    FROM (
      SELECT pa.id,
        1 - (pa.embedding_minilm_vec <=> uc.medoid_minilm_vec) AS similarity,
        uc.cluster_index
      FROM user_interest_clusters uc
      CROSS JOIN LATERAL (
        SELECT pa2.id, pa2.embedding_minilm_vec
        FROM published_articles pa2
        WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
          AND pa2.embedding_minilm_vec IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_feed_impressions ufi
            WHERE ufi.user_id = p_user_id AND ufi.article_id = pa2.id
          )
          AND (min_similarity <= 0 OR 1 - (pa2.embedding_minilm_vec <=> uc.medoid_minilm_vec) >= min_similarity)
        ORDER BY pa2.embedding_minilm_vec <=> uc.medoid_minilm_vec
        LIMIT match_per_cluster
      ) pa
      WHERE (uc.user_id = p_user_id OR uc.personalization_id = p_user_id)
        AND uc.medoid_minilm_vec IS NOT NULL
        AND (uc.suppressed IS NULL OR uc.suppressed = false)
    ) sub
    ORDER BY sub.id, sub.similarity DESC;
END;
$function$;
