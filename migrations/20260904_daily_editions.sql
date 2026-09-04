-- TODAY — one row per published daily edition.
--
-- The whole edition (ten stories + their poster specs) is one JSON payload, so
-- the site reads a single row and the shape can evolve without a migration.

CREATE TABLE IF NOT EXISTS daily_editions (
    id            BIGSERIAL PRIMARY KEY,
    edition_date  DATE NOT NULL UNIQUE,
    issue         INTEGER,
    payload       JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_editions_date_desc
    ON daily_editions (edition_date DESC);

ALTER TABLE daily_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read editions" ON daily_editions;
CREATE POLICY "Anyone can read editions"
    ON daily_editions FOR SELECT
    USING (true);

-- Writes come from the daily job with the service role key, which bypasses RLS.

CREATE OR REPLACE FUNCTION set_daily_editions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_editions_updated_at ON daily_editions;
CREATE TRIGGER daily_editions_updated_at
    BEFORE UPDATE ON daily_editions
    FOR EACH ROW EXECUTE FUNCTION set_daily_editions_updated_at();
