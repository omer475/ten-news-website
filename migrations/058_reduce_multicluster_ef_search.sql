-- Lower hnsw.ef_search 800 → 200 in match_articles_multi_cluster_minilm.
-- Profiling (EXPLAIN ANALYZE): this RPC took 5,897 ms per call with ef_search=800.
-- After the fix: 70 ms. 84× speedup.
-- ef_search=800 explores 8× more graph nodes than default (100) for marginal
-- recall gain (~99 % vs ~95 %). For a 10-slot feed that MMRs from 70 retrieved
-- results, the recall difference is immaterial.
-- Applied to prod via MCP on 2026-04-22. This file exists so the change is
-- tracked in version control for future deploys.

CREATE OR REPLACE FUNCTION public.match_articles_multi_cluster_minilm(
  p_user_id uuid,
  match_per_cluster integer DEFAULT 50,
  hours_window integer DEFAULT 72,
  exclude_ids bigint[] DEFAULT '{}'::bigint[],
  min_similarity double precision DEFAULT 0.0
)
RETURNS TABLE(id bigint, similarity double precision, cluster_index integer)
LANGUAGE plpgsql
AS $function$
BEGIN
  SET LOCAL hnsw.ef_search = 200;
  RETURN QUERY
    SELECT DISTINCT ON (sub.id)
      sub.id,
      sub.similarity,
      sub.cluster_index
    FROM (
      SELECT
        pa.id,
        1 - (pa.embedding_minilm_vec <=> uc.medoid_minilm_vec) as similarity,
        uc.cluster_index
      FROM user_interest_clusters uc
      CROSS JOIN LATERAL (
        SELECT pa2.id, pa2.embedding_minilm_vec
        FROM published_articles pa2
        WHERE pa2.created_at >= NOW() - make_interval(hours => hours_window)
          AND pa2.embedding_minilm_vec IS NOT NULL
          AND (exclude_ids IS NULL OR pa2.id != ALL(exclude_ids))
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
