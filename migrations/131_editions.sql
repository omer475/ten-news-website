-- 131_editions.sql
-- The daily "Edition": ONE shared, non-personalized edition per day.
-- Exactly 15 story items + the recurring modules (number_of_day, today_in_history,
-- countdown), stored as a single §13-shaped JSON payload keyed by date.
--
-- Produced once daily by the edition pipeline and published at 07:00 Europe/London.
-- Served verbatim by GET /api/edition.

CREATE TABLE IF NOT EXISTS editions (
  edition_date  date PRIMARY KEY,
  payload       jsonb NOT NULL,
  status        text  NOT NULL DEFAULT 'draft',   -- 'draft' | 'published'
  published_at  timestamptz,                       -- when status flipped to 'published'
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Serve path queries by (status, date); keep it cheap.
CREATE INDEX IF NOT EXISTS editions_published_idx
  ON editions (status, edition_date DESC);

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION editions_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS editions_touch ON editions;
CREATE TRIGGER editions_touch
  BEFORE UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION editions_touch_updated_at();

-- RLS: the edition is fully OPEN (no paywall). Anyone may READ a published edition.
-- Writes happen only via the service-role key (pipeline), which bypasses RLS.
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS editions_public_read ON editions;
CREATE POLICY editions_public_read
  ON editions FOR SELECT
  USING (status = 'published');
