-- Ten News: Email Preferences & Engagement Tracking Migration
-- Run this in Supabase SQL Editor
-- NOTE: Run this AFTER the profiles table has been created

-- ============================================
-- 0. First, ensure profiles table exists with basic columns
-- ============================================

-- Check if profiles table exists, if not create it
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 1. Add newsletter_subscribed column FIRST (before other columns reference it)
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS newsletter_subscribed BOOLEAN DEFAULT true;

-- ============================================
-- 2. Add email preference columns to profiles
-- ============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_frequency TEXT DEFAULT 'daily';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_timezone TEXT DEFAULT 'UTC';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_email_hour INTEGER DEFAULT 7;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_open_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_click_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_app_activity_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS articles_read_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS consecutive_days_inactive INTEGER DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reengagement_email_sent_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_categories TEXT[] DEFAULT '{}';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_personalization_enabled BOOLEAN DEFAULT true;

-- ============================================
-- 3. Add constraints (ignore errors if they already exist)
-- ============================================

DO $$ 
BEGIN
    -- Add check constraint for email_frequency
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_frequency_check'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_email_frequency_check 
        CHECK (email_frequency IN ('daily', 'weekly', 'breaking_only', 'never'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if constraint already exists
    NULL;
END $$;

DO $$ 
BEGIN
    -- Add check constraint for preferred_email_hour
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_hour_check'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_preferred_hour_check 
        CHECK (preferred_email_hour >= 0 AND preferred_email_hour <= 23);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================
-- 4. Create email_logs table for tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    subject TEXT,
    articles_included INTEGER DEFAULT 0,
    status TEXT DEFAULT 'sent',
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    resend_id TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Add constraints for email_logs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_type_check'
    ) THEN
        ALTER TABLE public.email_logs 
        ADD CONSTRAINT email_logs_type_check 
        CHECK (email_type IN ('daily_digest', 'weekly_digest', 'breaking_news', 'reengagement', 'welcome'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_status_check'
    ) THEN
        ALTER TABLE public.email_logs 
        ADD CONSTRAINT email_logs_status_check 
        CHECK (status IN ('sent', 'opened', 'clicked', 'bounced', 'failed'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Indexes for email_logs
CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON public.email_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_type_idx ON public.email_logs(email_type, created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON public.email_logs(status, created_at DESC);

-- ============================================
-- 5. Create email_queue table for scheduled sends
-- ============================================

CREATE TABLE IF NOT EXISTS public.email_queue (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_for TIMESTAMPTZ NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    payload JSONB DEFAULT '{}'
);

-- Add constraints for email_queue
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_queue_priority_check'
    ) THEN
        ALTER TABLE public.email_queue 
        ADD CONSTRAINT email_queue_priority_check 
        CHECK (priority >= 1 AND priority <= 10);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_queue_status_check'
    ) THEN
        ALTER TABLE public.email_queue 
        ADD CONSTRAINT email_queue_status_check 
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS email_queue_scheduled_idx ON public.email_queue(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS email_queue_user_idx ON public.email_queue(user_id, scheduled_for DESC);

-- ============================================
-- 6. Function to update last activity
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        last_app_activity_at = NOW(),
        consecutive_days_inactive = 0
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Function to increment articles read
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_articles_read()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'article_view' THEN
        UPDATE public.profiles 
        SET articles_read_count = COALESCE(articles_read_count, 0) + 1
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Function to calculate inactive users (run daily)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_inactive_users()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles
    SET consecutive_days_inactive = 
        EXTRACT(DAY FROM NOW() - COALESCE(last_app_activity_at, created_at))::INTEGER
    WHERE newsletter_subscribed = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. Create triggers (only if user_article_events table exists)
-- ============================================

DO $$
BEGIN
    -- Check if user_article_events table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_article_events') THEN
        -- Drop existing triggers first
        DROP TRIGGER IF EXISTS on_user_article_event ON public.user_article_events;
        DROP TRIGGER IF EXISTS on_article_read ON public.user_article_events;
        
        -- Create triggers
        CREATE TRIGGER on_user_article_event
            AFTER INSERT ON public.user_article_events
            FOR EACH ROW EXECUTE FUNCTION public.update_user_activity();
            
        CREATE TRIGGER on_article_read
            AFTER INSERT ON public.user_article_events
            FOR EACH ROW EXECUTE FUNCTION public.increment_articles_read();
            
        RAISE NOTICE 'Triggers created on user_article_events table';
    ELSE
        RAISE NOTICE 'user_article_events table does not exist - skipping triggers';
    END IF;
END $$;

-- ============================================
-- 10. Drop existing views before recreating
-- ============================================

DROP VIEW IF EXISTS public.users_ready_for_email;
DROP VIEW IF EXISTS public.users_need_reengagement;

-- ============================================
-- 11. View for users ready for daily email
-- ============================================

CREATE VIEW public.users_ready_for_email AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.email_timezone,
    p.preferred_email_hour,
    p.email_frequency,
    p.last_email_sent_at,
    p.articles_read_count,
    p.consecutive_days_inactive,
    p.preferred_categories,
    p.email_personalization_enabled,
    -- Calculate local hour for timezone-aware sending
    EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(p.email_timezone, 'UTC')) as current_local_hour
FROM public.profiles p
WHERE 
    p.newsletter_subscribed = true
    AND p.email_frequency != 'never'
    AND p.email IS NOT NULL
    AND (
        -- Daily: send if not sent today
        (p.email_frequency = 'daily' AND (p.last_email_sent_at IS NULL OR p.last_email_sent_at < NOW() - INTERVAL '20 hours'))
        OR
        -- Weekly: send if not sent this week
        (p.email_frequency = 'weekly' AND (p.last_email_sent_at IS NULL OR p.last_email_sent_at < NOW() - INTERVAL '6 days'))
    );

-- ============================================
-- 12. View for users needing re-engagement
-- ============================================

CREATE VIEW public.users_need_reengagement AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.consecutive_days_inactive,
    p.last_app_activity_at,
    p.articles_read_count,
    p.reengagement_email_sent_at
FROM public.profiles p
WHERE 
    p.newsletter_subscribed = true
    AND p.email IS NOT NULL
    AND p.consecutive_days_inactive >= 7
    AND (
        p.reengagement_email_sent_at IS NULL 
        OR p.reengagement_email_sent_at < NOW() - INTERVAL '14 days'
    );

-- ============================================
-- 13. Enable RLS on email tables
-- ============================================

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service role full access to email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service role full access to email_queue" ON public.email_queue;

-- Users can view their own email logs
CREATE POLICY "Users can view own email logs" ON public.email_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for API)
CREATE POLICY "Service role full access to email_logs" ON public.email_logs
    FOR ALL USING (true);

CREATE POLICY "Service role full access to email_queue" ON public.email_queue
    FOR ALL USING (true);

-- ============================================
-- 14. Grant permissions
-- ============================================

GRANT SELECT ON public.users_ready_for_email TO authenticated;
GRANT SELECT ON public.users_ready_for_email TO anon;
GRANT SELECT ON public.users_need_reengagement TO authenticated;
GRANT SELECT ON public.users_need_reengagement TO anon;
GRANT ALL ON public.email_logs TO authenticated;
GRANT ALL ON public.email_queue TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.email_logs_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.email_queue_id_seq TO authenticated;

-- ============================================
-- DONE! Your email system is ready.
-- ============================================

-- Verify the columns were added:
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('newsletter_subscribed', 'email_frequency', 'email_timezone', 'preferred_email_hour')
ORDER BY column_name;
