-- =============================================================================
-- GabesVideos Supabase schema (section 13).
-- Paste this whole file into the Supabase SQL editor and run it once.
-- Row level security ties every row to the signed in user. The atomic RPCs make
-- concurrent writes from two devices safe (no read-modify-write from the client).
-- =============================================================================

-- watch_state: one row per (user, video). watched_seconds = furthest position reached.
create table if not exists watch_state (
  user_id uuid not null references auth.users(id),
  video_id text not null,
  status text not null default 'seen',     -- 'seen' | 'completed'
  watched_seconds int not null default 0,  -- furthest position, for completion
  channel_key text,
  category text,
  duration_seconds int,
  first_watched_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table watch_state enable row level security;
drop policy if exists "own rows" on watch_state;
create policy "own rows" on watch_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- daily_stats: one row per (user, local day). watch_seconds = real time watched that day.
create table if not exists daily_stats (
  user_id uuid not null references auth.users(id),
  day date not null,                        -- local date string from the client
  watch_seconds int not null default 0,
  videos_completed int not null default 0,
  primary key (user_id, day)
);
alter table daily_stats enable row level security;
drop policy if exists "own rows" on daily_stats;
create policy "own rows" on daily_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic increment so concurrent device writes never clobber each other.
create or replace function increment_daily_stats(p_day date, p_seconds int, p_completed int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into daily_stats (user_id, day, watch_seconds, videos_completed)
  values (auth.uid(), p_day, p_seconds, p_completed)
  on conflict (user_id, day)
  do update set watch_seconds = daily_stats.watch_seconds + excluded.watch_seconds,
                videos_completed = daily_stats.videos_completed + excluded.videos_completed;
end;
$$;

-- Upsert watch state with the max position and no status downgrade, server side,
-- so a stale device can never overwrite newer progress.
create or replace function upsert_watch_state(
  p_video_id text,
  p_status text,
  p_watched_seconds int,
  p_channel_key text,
  p_category text,
  p_duration_seconds int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into watch_state (
    user_id, video_id, status, watched_seconds, channel_key, category, duration_seconds, last_watched_at
  )
  values (
    auth.uid(), p_video_id, p_status, coalesce(p_watched_seconds, 0),
    p_channel_key, p_category, p_duration_seconds, now()
  )
  on conflict (user_id, video_id) do update set
    watched_seconds = greatest(watch_state.watched_seconds, excluded.watched_seconds),
    status = case when watch_state.status = 'completed' then 'completed' else excluded.status end,
    channel_key = coalesce(excluded.channel_key, watch_state.channel_key),
    category = coalesce(excluded.category, watch_state.category),
    duration_seconds = coalesce(excluded.duration_seconds, watch_state.duration_seconds),
    last_watched_at = now();
end;
$$;
