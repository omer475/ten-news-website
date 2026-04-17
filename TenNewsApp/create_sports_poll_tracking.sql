-- Sports Poll Tracking Table
-- Used by sports_espn_poller.py to track processed ESPN events and avoid duplicates

CREATE TABLE IF NOT EXISTS sports_poll_tracking (
    id SERIAL PRIMARY KEY,
    espn_event_id TEXT UNIQUE NOT NULL,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    event_name TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    published_article_id INT
);

CREATE INDEX IF NOT EXISTS idx_sports_poll_espn_event
    ON sports_poll_tracking(espn_event_id);

CREATE INDEX IF NOT EXISTS idx_sports_poll_sport
    ON sports_poll_tracking(sport);
