-- Add ai_final_score column to published_articles table
-- This is needed for sorting articles by importance

ALTER TABLE published_articles 
ADD COLUMN IF NOT EXISTS ai_final_score INTEGER DEFAULT 500;

-- Add comment explaining the column
COMMENT ON COLUMN published_articles.ai_final_score IS 'Article importance score (0-1000) calculated from source scores + multi-source bonus. Used for sorting articles on website.';

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_published_articles_score 
ON published_articles(ai_final_score DESC);

-- Update existing articles with a default score based on their data
-- Give them a score of 500 (average) so they show up
UPDATE published_articles 
SET ai_final_score = 500 
WHERE ai_final_score IS NULL;

