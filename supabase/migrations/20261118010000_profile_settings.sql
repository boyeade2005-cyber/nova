-- Profile highlights, user settings, blocked users & account deletion

-- ---------- profile highlights (Instagram-style story circles) ----------

create table if not exists public.profile_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null default '✨',
  title text not null,
  gradient text not null default 'linear-gradient(135deg,#FF6B00,#FF2A5F)',
  position int not null default 0,
  created_at timestamptz default now()
);

create index if not exists profile_highlights_user_idx on public.profile_highlights (user_id, position);

alter table public.profile_highlights enable row level security;

-- anyone can see highlights (they're public profile content); owner manages own
drop policy if exists "highlights readable" on public.profile_highlights;
drop policy if exists "owners manage highlights" on public.profile_highlights;
drop policy if exists "owners update highlights" on public.profile_highlights;
drop policy if exists "owners delete highlights" on public.profile_highlights;
create policy "highlights readable" on public.profile_highlights for select using (true);
create policy "owners manage highlights" on public.profile_highlights for insert with check (auth.uid() = user_id);
create policy "owners update highlights" on public.profile_highlights for update using (auth.uid() = user_id);
create policy "owners delete highlights" on public.profile_highlights for delete using (auth.uid() = user_id);

-- ---------- per-user settings blob (theme, notifications, privacy prefs) ----------

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "users manage own settings" on public.user_settings;
create policy "users manage own settings" on public.user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- blocked accounts ----------

create table if not exists public.blocked_users (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);

create index if not exists blocked_users_blocked_idx on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- a user manages their own block list; the blocked user may also see that they were blocked (transparency)
drop policy if exists "users manage own blocks" on public.blocked_users;
drop policy if exists "blocked users can see block" on public.blocked_users;
create policy "users manage own blocks" on public.blocked_users for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blocked users can see block" on public.blocked_users for select
  using (auth.uid() = blocked_id);

-- ---------- delete own account ----------
-- Deletes the public profile row; everything referencing profiles(id) cascades
-- (posts, comments, reactions, follows, memberships, saved items, moments,
-- notifications received, wallet, settings, highlights, blocks, calls, pulse
-- likes, live messages/signals). Rows that would otherwise be orphaned by
-- `on delete set null` FKs are removed explicitly first. The auth.users row
-- itself requires the Supabase dashboard / admin API to remove — after this
-- RPC the account has no profile and all content is gone, and the client
-- signs out.

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- content authored by me inside other people's spaces (sender becomes NULL otherwise)
  delete from public.messages where sender_id = uid;
  delete from public.notifications where actor_id = uid;

  -- entities with `on delete set null` ownership that should disappear entirely
  delete from public.live_streams where host_id = uid;      -- cascades live_messages/live_signals
  delete from public.pulse_videos where creator_id = uid;   -- cascades pulse_likes
  delete from public.products where seller_id = uid;

  -- the profile delete cascades to everything else
  delete from public.profiles where id = uid;
end $$;

revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
