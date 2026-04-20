-- Joins impressions with the events that followed them so a future
-- multi-task ranker (P(complete), P(share), P(save), P(engage)) can be
-- trained from a single SELECT * with no further plumbing.
--
-- Outcome columns capture whether the impression resulted in each behavior
-- within 30 minutes — enough time for a real read, short enough to attribute
-- the outcome to *this* impression instead of a later resurface.
--
-- read_fraction is the headline signal — replaces the binary "engaged" target
-- with a continuous label that respects article length (3-sentence card vs
-- 400-word longform).

CREATE OR REPLACE VIEW public.ranker_training_labels AS
SELECT
  fi.id                  AS impression_id,
  fi.user_id,
  fi.article_id,
  fi.bucket,
  fi.slot_index,
  fi.pool_size,
  fi.propensity_score,
  fi.slots_pattern,
  fi.request_id,
  fi.created_at          AS shown_at,

  pa.category,
  pa.super_cluster_id,
  pa.leaf_cluster_id,
  pa.expected_read_seconds,
  pa.ai_final_score      AS article_quality,

  -- Outcome events (within 30 min of impression)
  ev_max.max_dwell_seconds,
  CASE
    WHEN ev_max.max_dwell_seconds IS NULL OR pa.expected_read_seconds IS NULL OR pa.expected_read_seconds = 0 THEN NULL
    ELSE LEAST(3.0, ev_max.max_dwell_seconds::float / pa.expected_read_seconds)
  END                    AS read_fraction,
  COALESCE(ev_flags.engaged, false)   AS label_engaged,
  COALESCE(ev_flags.skipped, false)   AS label_skipped,
  COALESCE(ev_flags.saved,   false)   AS label_saved,
  COALESCE(ev_flags.shared,  false)   AS label_shared,
  COALESCE(ev_flags.liked,   false)   AS label_liked,
  COALESCE(ev_flags.revisit, false)   AS label_revisit
FROM public.user_feed_impressions fi
JOIN public.published_articles pa ON pa.id = fi.article_id
LEFT JOIN LATERAL (
  SELECT MAX(view_seconds) FILTER (WHERE view_seconds IS NOT NULL AND view_seconds < 600) AS max_dwell_seconds
  FROM public.user_article_events ev
  WHERE ev.user_id = fi.user_id
    AND ev.article_id = fi.article_id
    AND ev.created_at >= fi.created_at
    AND ev.created_at <  fi.created_at + interval '30 minutes'
) ev_max ON TRUE
LEFT JOIN LATERAL (
  SELECT
    bool_or(ev.event_type = 'article_engaged') AS engaged,
    bool_or(ev.event_type = 'article_skipped') AS skipped,
    bool_or(ev.event_type = 'article_saved')   AS saved,
    bool_or(ev.event_type = 'article_shared')  AS shared,
    bool_or(ev.event_type = 'article_liked')   AS liked,
    bool_or(ev.event_type = 'article_revisit') AS revisit
  FROM public.user_article_events ev
  WHERE ev.user_id = fi.user_id
    AND ev.article_id = fi.article_id
    AND ev.created_at >= fi.created_at
    AND ev.created_at <  fi.created_at + interval '30 minutes'
) ev_flags ON TRUE
WHERE fi.created_at > NOW() - interval '90 days';

COMMENT ON VIEW public.ranker_training_labels IS
  'Impression-level training data for a future multi-task ranker. Joins user_feed_impressions with the events fired within 30 min, computing read_fraction and per-event-type binary labels. Filtered to last 90d to keep query cost bounded.';
