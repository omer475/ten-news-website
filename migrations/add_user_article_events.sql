-- Ten News: user-level analytics events
-- Stores per-user article interactions for personalization (Supabase Auth users)

create table if not exists public.user_article_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,
  session_id text null,
  event_type text not null,
  article_id bigint null,
  cluster_id bigint null,
  category text null,
  source text null,
  referrer text null,
  page text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists user_article_events_user_id_created_at_idx
  on public.user_article_events (user_id, created_at desc);

create index if not exists user_article_events_article_id_created_at_idx
  on public.user_article_events (article_id, created_at desc);

create index if not exists user_article_events_event_type_created_at_idx
  on public.user_article_events (event_type, created_at desc);

-- (Optional) If you want RLS instead of service-role inserts via API route:
-- alter table public.user_article_events enable row level security;
-- create policy "users can insert their own events"
--   on public.user_article_events for insert
--   to authenticated
--   with check (auth.uid() = user_id);
--
-- create policy "users can read their own events"
--   on public.user_article_events for select
--   to authenticated
--   using (auth.uid() = user_id);

