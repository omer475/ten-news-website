-- ==========================================
-- TEST IMAGE URL MAPPING ISSUE
-- Run this in Supabase SQL Editor
-- ==========================================

-- STEP 1: Check what column name is actually used for images
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name LIKE '%image%';

-- STEP 2: Check actual data in the most recent 10 articles
SELECT 
    id,
    title,
    source,
    -- Try different possible column names
    image_url,
    -- urltoimage,  -- uncomment if this column exists
    -- url_to_image, -- uncomment if this column exists
    published_at
FROM articles
WHERE published = true
ORDER BY published_at DESC
LIMIT 10;

-- STEP 3: Show ALL column names in articles table
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'articles'
ORDER BY ordinal_position;

-- STEP 4: Count articles with and without image URLs
SELECT 
    'Total published articles' AS metric,
    COUNT(*) AS count
FROM articles
WHERE published = true

UNION ALL

SELECT 
    'Articles with image_url (not null)' AS metric,
    COUNT(*) AS count
FROM articles
WHERE published = true
AND image_url IS NOT NULL

UNION ALL

SELECT 
    'Articles with image_url (not empty)' AS metric,
    COUNT(*) AS count
FROM articles
WHERE published = true
AND image_url IS NOT NULL
AND image_url != '';

-- STEP 5: Show 5 articles that SHOULD have images
-- (to test if we can see the actual image URLs)
SELECT 
    title,
    source,
    image_url AS "Image URL in Database",
    LENGTH(image_url) AS "URL Length",
    published_at
FROM articles
WHERE published = true
AND image_url IS NOT NULL
AND image_url != ''
ORDER BY published_at DESC
LIMIT 5;

