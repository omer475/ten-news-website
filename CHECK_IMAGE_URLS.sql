-- ==========================================
-- CHECK IMAGE URLs IN SUPABASE
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Check how many articles have image URLs
SELECT 
    COUNT(*) AS total_articles,
    COUNT(image_url) AS has_image_url,
    COUNT(*) - COUNT(image_url) AS missing_image_url,
    COUNT(CASE WHEN image_url = '' THEN 1 END) AS empty_image_url,
    COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) AS valid_image_url
FROM articles
WHERE published = true;

-- 2. Sample of recent articles with their image URLs
SELECT 
    id,
    title,
    source,
    CASE 
        WHEN image_url IS NULL THEN '❌ NULL'
        WHEN image_url = '' THEN '❌ EMPTY STRING'
        WHEN LENGTH(image_url) < 10 THEN '❌ TOO SHORT'
        ELSE '✅ HAS URL'
    END AS image_status,
    LEFT(image_url, 100) AS image_url_preview,
    LENGTH(image_url) AS url_length,
    published_at
FROM articles
WHERE published = true
ORDER BY published_at DESC
LIMIT 20;

-- 3. Check for common image URL patterns
SELECT 
    CASE 
        WHEN image_url LIKE 'https://%' THEN 'HTTPS URLs'
        WHEN image_url LIKE 'http://%' THEN 'HTTP URLs'
        WHEN image_url LIKE '//%' THEN 'Protocol-relative URLs'
        WHEN image_url = '' THEN 'Empty strings'
        WHEN image_url IS NULL THEN 'NULL values'
        ELSE 'Other'
    END AS url_type,
    COUNT(*) AS count
FROM articles
WHERE published = true
GROUP BY url_type
ORDER BY count DESC;

-- 4. Find articles without valid images (for debugging)
SELECT 
    id,
    title,
    source,
    image_url,
    published_at
FROM articles
WHERE published = true
AND (image_url IS NULL OR image_url = '' OR LENGTH(image_url) < 10)
ORDER BY published_at DESC
LIMIT 10;

-- 5. Check if image_url column exists and its type
SELECT 
    column_name, 
    data_type,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name = 'image_url';

