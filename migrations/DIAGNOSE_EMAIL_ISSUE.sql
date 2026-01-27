-- ============================================
-- DIAGNOSE: Why are emails being sent every hour?
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Check recent email logs - are emails actually being sent every hour?
SELECT 
    el.created_at,
    el.email_type,
    el.status,
    p.email,
    p.email_timezone,
    EXTRACT(HOUR FROM el.created_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER as sent_at_local_hour
FROM email_logs el
JOIN profiles p ON p.id = el.user_id
WHERE el.email_type = 'daily_digest'
ORDER BY el.created_at DESC
LIMIT 50;

-- 2. Check if same users are getting multiple emails per day
SELECT 
    p.email,
    p.email_timezone,
    DATE(el.created_at) as date_sent,
    COUNT(*) as emails_that_day,
    array_agg(EXTRACT(HOUR FROM el.created_at)::INTEGER ORDER BY el.created_at) as hours_sent_utc
FROM email_logs el
JOIN profiles p ON p.id = el.user_id
WHERE el.email_type = 'daily_digest'
AND el.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.email, p.email_timezone, DATE(el.created_at)
HAVING COUNT(*) > 1
ORDER BY date_sent DESC, emails_that_day DESC;

-- 3. Check profiles - what timezones do users have?
SELECT 
    email_timezone,
    COUNT(*) as user_count,
    CASE WHEN email_timezone IS NULL THEN 'NULL - defaults to UTC' ELSE 'Set' END as status
FROM profiles 
WHERE newsletter_subscribed = true AND email IS NOT NULL
GROUP BY email_timezone
ORDER BY user_count DESC;

-- 4. Check if last_email_sent_at is being updated
SELECT 
    email,
    email_timezone,
    last_email_sent_at,
    newsletter_subscribed
FROM profiles
WHERE newsletter_subscribed = true AND email IS NOT NULL
ORDER BY last_email_sent_at DESC NULLS LAST
LIMIT 20;
