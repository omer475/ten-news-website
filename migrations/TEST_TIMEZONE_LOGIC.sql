-- ============================================
-- TEST: Verify Timezone Logic is Working
-- Run this in Supabase SQL Editor to check
-- ============================================

-- 1. Show current UTC time
SELECT 
    NOW() as utc_now,
    EXTRACT(HOUR FROM NOW()) as utc_hour;

-- 2. Show what time it is in different timezones RIGHT NOW
SELECT 
    'UTC' as timezone,
    NOW() AT TIME ZONE 'UTC' as local_time,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::INTEGER as local_hour,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END as status
UNION ALL
SELECT 
    'America/New_York',
    NOW() AT TIME ZONE 'America/New_York',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/New_York')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/New_York')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
UNION ALL
SELECT 
    'America/Los_Angeles',
    NOW() AT TIME ZONE 'America/Los_Angeles',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Los_Angeles')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
UNION ALL
SELECT 
    'Europe/London',
    NOW() AT TIME ZONE 'Europe/London',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
UNION ALL
SELECT 
    'Europe/Paris',
    NOW() AT TIME ZONE 'Europe/Paris',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Paris')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/Paris')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
UNION ALL
SELECT 
    'Asia/Tokyo',
    NOW() AT TIME ZONE 'Asia/Tokyo',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Tokyo')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Tokyo')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
UNION ALL
SELECT 
    'Australia/Sydney',
    NOW() AT TIME ZONE 'Australia/Sydney',
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Australia/Sydney')::INTEGER,
    CASE WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Australia/Sydney')::INTEGER = 10 
         THEN '✅ WOULD SEND' ELSE '⏳ Not 10 AM' END
ORDER BY local_hour;

-- 3. Show your actual users and their timezone status
SELECT 
    p.email,
    COALESCE(p.email_timezone, 'UTC') as timezone,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER as current_local_hour,
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER = 10 
        THEN '✅ 10 AM NOW - Would Send'
        ELSE '⏳ Not 10 AM (' || EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER || ':00)'
    END as status,
    p.last_email_sent_at,
    CASE 
        WHEN p.last_email_sent_at IS NULL THEN 'Never sent'
        WHEN (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
             > (p.last_email_sent_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
        THEN '✅ Can send (different day)'
        ELSE '❌ Already sent today'
    END as duplicate_check
FROM profiles p
WHERE p.newsletter_subscribed = true
AND p.email IS NOT NULL
ORDER BY current_local_hour, p.email;

-- 4. Test the actual function (after running the migration)
-- Uncomment this after running 014_email_queue_system.sql:
-- SELECT * FROM get_users_for_email_now(10, 100);

-- 5. Show timezone distribution of your users
SELECT 
    COALESCE(email_timezone, 'UTC') as timezone,
    COUNT(*) as user_count,
    EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(email_timezone, 'UTC'))::INTEGER as current_hour_there
FROM profiles
WHERE newsletter_subscribed = true AND email IS NOT NULL
GROUP BY COALESCE(email_timezone, 'UTC')
ORDER BY current_hour_there;
