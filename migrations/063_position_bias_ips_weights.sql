-- Phase 8.1: position-bias correction on ranker training labels.
--
-- Empirical engage rate by slot_index (last 30 days, 1 534 impressions):
--   slot 0 → 16.6 %,  slot 1 → 9.8 %,  slot 2 → 8.5 %,
--   slot 5 → 4.7 %,   slot 9 → 4.1 %
-- Power-law fit bias(k) = (1/(k+1))^η gives η ≈ 0.70, which matches the
-- Wang et al. 2018 "Position Bias Estimation for Unbiased LTR" range for
-- news-style feeds.
--
-- Without IPS correction, "user engaged at slot 0" and "user engaged at
-- slot 9" train the ranker as equally positive labels — but the slot-9
-- engagement is ~4× stronger evidence of true relevance (user had to
-- scroll past 9 other cards to reach it). Every future ranker trained on
-- ranker_training_labels has been learning position, not quality.
--
-- This migration adds two derived columns to the view:
--   position_bias : exposure propensity (0, 1]. bias(0) = 1.
--   ips_weight    : 1 / position_bias. Multiply training labels by this
--                   to get unbiased click/engage targets.
--
-- η is hard-coded at 0.70 but the value lives in one spot — to refresh
-- from new data, re-run the engage-rate-by-slot query and fit.

CREATE OR REPLACE VIEW public.ranker_training_labels AS
SELECT fi.id AS impression_id,
    fi.user_id,
    fi.article_id,
    fi.bucket,
    fi.slot_index,
    fi.pool_size,
    fi.propensity_score,
    fi.slots_pattern,
    fi.request_id,
    fi.created_at AS shown_at,
    pa.category,
    pa.super_cluster_id,
    pa.leaf_cluster_id,
    pa.expected_read_seconds,
    pa.ai_final_score AS article_quality,
    ev_max.max_dwell_seconds,
    CASE
        WHEN ev_max.max_dwell_seconds IS NULL OR pa.expected_read_seconds IS NULL OR pa.expected_read_seconds = 0 THEN NULL::double precision
        ELSE LEAST(3.0::double precision, ev_max.max_dwell_seconds::double precision / pa.expected_read_seconds::double precision)
    END AS read_fraction,
    COALESCE(ev_flags.engaged, false) AS label_engaged,
    COALESCE(ev_flags.skipped, false) AS label_skipped,
    COALESCE(ev_flags.saved, false) AS label_saved,
    COALESCE(ev_flags.shared, false) AS label_shared,
    COALESCE(ev_flags.liked, false) AS label_liked,
    COALESCE(ev_flags.revisit, false) AS label_revisit,
    -- Phase 8.1: position-bias correction.
    CASE
        WHEN fi.slot_index IS NULL THEN NULL::double precision
        ELSE power((1.0 / (fi.slot_index + 1))::double precision, 0.70::double precision)
    END AS position_bias,
    CASE
        WHEN fi.slot_index IS NULL THEN NULL::double precision
        ELSE power((fi.slot_index + 1)::double precision, 0.70::double precision)
    END AS ips_weight
FROM user_feed_impressions fi
    JOIN published_articles pa ON pa.id = fi.article_id
    LEFT JOIN LATERAL (
        SELECT max(ev.view_seconds) FILTER (
            WHERE ev.view_seconds IS NOT NULL AND ev.view_seconds < 600
        ) AS max_dwell_seconds
        FROM user_article_events ev
        WHERE ev.user_id = fi.user_id
            AND ev.article_id = fi.article_id
            AND ev.created_at >= fi.created_at
            AND ev.created_at < (fi.created_at + '00:30:00'::interval)
    ) ev_max ON true
    LEFT JOIN LATERAL (
        SELECT bool_or(ev.event_type = 'article_engaged'::text) AS engaged,
            bool_or(ev.event_type = 'article_skipped'::text) AS skipped,
            bool_or(ev.event_type = 'article_saved'::text) AS saved,
            bool_or(ev.event_type = 'article_shared'::text) AS shared,
            bool_or(ev.event_type = 'article_liked'::text) AS liked,
            bool_or(ev.event_type = 'article_revisit'::text) AS revisit
        FROM user_article_events ev
        WHERE ev.user_id = fi.user_id
            AND ev.article_id = fi.article_id
            AND ev.created_at >= fi.created_at
            AND ev.created_at < (fi.created_at + '00:30:00'::interval)
    ) ev_flags ON true
WHERE fi.created_at > (now() - '90 days'::interval);

COMMENT ON VIEW public.ranker_training_labels IS
    'Per-impression labels for offline ranker training. position_bias is the exposure propensity (1.0 at slot 0, decreasing); ips_weight = 1/position_bias — multiply binary labels by this when training so slot-9 engagements contribute ~4x more than slot-0 engagements. η=0.70 fit to the last 30 days of live data (2026-04-23).';
