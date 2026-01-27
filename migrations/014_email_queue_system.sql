-- Email Queue System for Timezone-Aware Newsletter Sending
-- This moves the heavy lifting to Supabase to avoid Vercel timeout limits

-- ============================================
-- 1. Create email_send_queue table
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_send_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    scheduled_date DATE NOT NULL,  -- The date this email is for (in user's timezone)
    timezone TEXT DEFAULT 'UTC',
    status TEXT DEFAULT 'pending', -- pending, processing, sent, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(user_id, scheduled_date)  -- One email per user per day
);

-- Index for fast queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
ON public.email_send_queue(status, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_queue_user_date 
ON public.email_send_queue(user_id, scheduled_date);

-- ============================================
-- 2. Function to get users eligible for email NOW
-- This runs the timezone logic in PostgreSQL (fast!)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_users_for_email_now(
    target_hour INTEGER DEFAULT 10,
    batch_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    timezone TEXT,
    local_hour INTEGER,
    preferred_categories TEXT[],
    email_personalization_enabled BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tz_record RECORD;
BEGIN
    -- Return users where it's currently the target hour in their timezone
    -- and they haven't received an email today (in their timezone)
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.email,
        p.full_name,
        COALESCE(p.email_timezone, 'UTC') as timezone,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER as local_hour,
        p.preferred_categories,
        COALESCE(p.email_personalization_enabled, true) as email_personalization_enabled
    FROM public.profiles p
    WHERE 
        -- Must be subscribed
        p.newsletter_subscribed = true
        AND p.email IS NOT NULL
        -- Check if it's the target hour in user's timezone
        AND EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::INTEGER = target_hour
        -- Check they haven't received email today (in their timezone)
        AND (
            p.last_email_sent_at IS NULL
            OR (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
               > (p.last_email_sent_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE
        )
        -- Also check email_logs table for extra safety
        AND NOT EXISTS (
            SELECT 1 FROM public.email_logs el
            WHERE el.user_id = p.id
            AND el.email_type = 'daily_digest'
            AND el.status = 'sent'
            AND (el.created_at AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE 
                = (NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC'))::DATE
        )
    ORDER BY p.created_at
    LIMIT batch_limit;
END;
$$;

-- ============================================
-- 3. Function to queue emails for all eligible users
-- Call this every hour to populate the queue
-- ============================================

CREATE OR REPLACE FUNCTION public.queue_daily_emails(
    target_hour INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queued_count INTEGER := 0;
    user_record RECORD;
BEGIN
    -- Insert eligible users into the queue
    FOR user_record IN 
        SELECT * FROM public.get_users_for_email_now(target_hour, 1000)
    LOOP
        BEGIN
            INSERT INTO public.email_send_queue (user_id, email, scheduled_date, timezone, status)
            VALUES (
                user_record.user_id,
                user_record.email,
                (NOW() AT TIME ZONE user_record.timezone)::DATE,
                user_record.timezone,
                'pending'
            )
            ON CONFLICT (user_id, scheduled_date) DO NOTHING;
            
            queued_count := queued_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Skip errors, continue with next user
            CONTINUE;
        END;
    END LOOP;
    
    RETURN queued_count;
END;
$$;

-- ============================================
-- 4. Function to get pending emails from queue
-- Call this to get batch of emails to send
-- ============================================

CREATE OR REPLACE FUNCTION public.get_pending_emails(
    batch_size INTEGER DEFAULT 20
)
RETURNS TABLE (
    queue_id BIGINT,
    user_id UUID,
    email TEXT,
    full_name TEXT,
    timezone TEXT,
    preferred_categories TEXT[],
    email_personalization_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark batch as processing and return them
    RETURN QUERY
    WITH batch AS (
        SELECT q.id
        FROM public.email_send_queue q
        WHERE q.status = 'pending'
        ORDER BY q.created_at
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.email_send_queue q
        SET status = 'processing'
        FROM batch b
        WHERE q.id = b.id
        RETURNING q.*
    )
    SELECT 
        u.id as queue_id,
        u.user_id,
        u.email,
        p.full_name,
        u.timezone,
        p.preferred_categories,
        COALESCE(p.email_personalization_enabled, true)
    FROM updated u
    JOIN public.profiles p ON p.id = u.user_id;
END;
$$;

-- ============================================
-- 5. Function to mark email as sent
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_email_sent(
    queue_id_param BIGINT,
    user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update queue
    UPDATE public.email_send_queue
    SET status = 'sent', processed_at = NOW()
    WHERE id = queue_id_param;
    
    -- Update profile
    UPDATE public.profiles
    SET last_email_sent_at = NOW()
    WHERE id = user_id_param;
END;
$$;

-- ============================================
-- 6. Function to mark email as failed
-- ============================================

CREATE OR REPLACE FUNCTION public.mark_email_failed(
    queue_id_param BIGINT,
    error_msg TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.email_send_queue
    SET status = 'failed', processed_at = NOW(), error_message = error_msg
    WHERE id = queue_id_param;
END;
$$;

-- ============================================
-- 7. View for monitoring
-- ============================================

CREATE OR REPLACE VIEW public.email_queue_stats AS
SELECT 
    scheduled_date,
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(processed_at) as latest_processed
FROM public.email_send_queue
GROUP BY scheduled_date, status
ORDER BY scheduled_date DESC, status;

-- ============================================
-- 8. Cleanup old queue entries (run periodically)
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_email_queue(
    days_to_keep INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.email_send_queue
    WHERE scheduled_date < CURRENT_DATE - days_to_keep
    AND status IN ('sent', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================
-- Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_users_for_email_now TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_for_email_now TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_daily_emails TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_emails TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_sent TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_failed TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_email_queue TO service_role;

GRANT ALL ON public.email_send_queue TO service_role;
GRANT SELECT ON public.email_queue_stats TO authenticated;
GRANT SELECT ON public.email_queue_stats TO service_role;
