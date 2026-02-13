-- Add AI-generated relevance scores for personalization
-- topic_relevance: {"f1": 95, "startups": 75} — how relevant article is per topic (0-100)
-- country_relevance: {"turkiye": 90, "usa": 40} — how relevant article is per country (0-100)

ALTER TABLE published_articles
ADD COLUMN IF NOT EXISTS topic_relevance jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS country_relevance jsonb DEFAULT '{}'::jsonb;

-- Index for faster lookups (GIN index on jsonb)
CREATE INDEX IF NOT EXISTS idx_published_articles_topic_relevance
ON published_articles USING gin (topic_relevance);

CREATE INDEX IF NOT EXISTS idx_published_articles_country_relevance
ON published_articles USING gin (country_relevance);
