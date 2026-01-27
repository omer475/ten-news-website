-- ============================================
-- FIX: Prevent duplicate emails being sent
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Update all users who received email today to have last_email_sent_at set
-- This fixes the duplicate detection

UPDATE profiles p
SET last_email_sent_at = el.latest_sent
FROM (
    SELECT 
        user_id,
        MAX(created_at) as latest_sent
    FROM email_logs
    WHERE email_type = 'daily_digest'
    AND status = 'sent'
    AND created_at > NOW() - INTERVAL '24 hours'
    GROUP BY user_id
) el
WHERE p.id = el.user_id;

-- Step 2: Create a simple view that shows who should get email RIGHT NOW
-- This will be used for debugging

DROP VIEW IF EXISTS users_eligible_for_email_now;

CREATE VIEW users_eligible_for_email_now AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    COALESCE(p.email_timezone, 'UTC') as timezone,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER as local_hour_now,
    p.last_email_sent_at,
    (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE as today_in_user_tz,
    CASE WHEN p.last_email_sent_at IS NOT NULL 
         THEN (p.last_email_sent_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
         ELSE NULL 
    END as last_sent_date_in_user_tz
FROM profiles p
WHERE 
    p.newsletter_subscribed = true
    AND p.email IS NOT NULL
    -- It's 10 AM in their timezone
    AND EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER = 10
    -- Haven't been sent today
    AND (
        p.last_email_sent_at IS NULL
        OR (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
           > (p.last_email_sent_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE
    );

-- Step 3: Create the main function that returns eligible users
-- This replaces the JavaScript timezone logic

DROP FUNCTION IF EXISTS get_email_recipients_now();

CREATE OR REPLACE FUNCTION get_email_recipients_now()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    timezone TEXT,
    local_hour INTEGER,
    preferred_categories TEXT[],
    email_personalization_enabled BOOLEAN
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT 
        p.id as user_id,
        p.email,
        p.full_name,
        COALESCE(p.email_timezone, 'UTC') as timezone,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER as local_hour,
        p.preferred_categories,
        COALESCE(p.email_personalization_enabled, true) as email_personalization_enabled
    FROM profiles p
    WHERE 
        p.newsletter_subscribed = true
        AND p.email IS NOT NULL
        -- CRITICAL: Only if it's exactly 10 AM in their timezone
        AND EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER = 10
        -- CRITICAL: Haven't received email today (in their timezone)
        AND (
            p.last_email_sent_at IS NULL
            OR (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
               > (p.last_email_sent_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE
        )
    ORDER BY p.created_at
    LIMIT 50;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_email_recipients_now() TO authenticated;
GRANT EXECUTE ON FUNCTION get_email_recipients_now() TO service_role;
GRANT SELECT ON users_eligible_for_email_now TO authenticated;
GRANT SELECT ON users_eligible_for_email_now TO service_role;

-- Step 5: Test it - this should show ONLY users at 10 AM local time who haven't been sent today
SELECT * FROM get_email_recipients_now();

-- Step 6: Show current time in all timezones to verify logic
SELECT 
    tz as timezone,
    NOW() AT TIME ZONE tz as local_time,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE tz)::INTEGER as local_hour,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE tz)::INTEGER = 10 
         THEN '✅ 10 AM - SEND NOW' 
         ELSE '⏳ Wait' 
    END as action
FROM unnest(ARRAY['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney']) as tz
ORDER BY local_hour;
