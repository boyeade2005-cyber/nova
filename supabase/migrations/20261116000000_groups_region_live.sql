-- Groups (community posts + group chat), regions, live scheduling & community lives

-- ---------- posts inside communities ----------
alter table public.posts add column if not exists community_id uuid references public.communities(id) on delete cascade;
create index if not exists posts_community_idx on public.posts (community_id) where community_id is not null;

create or replace function public.is_community_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid and user_id = auth.uid()
  );
$$;

-- posts of private communities are only visible to members
drop policy if exists "posts are readable" on public.posts;
create policy "posts are readable" on public.posts for select using (
  community_id is null
  or exists (
    select 1 from public.communities c
    where c.id = posts.community_id and c.is_private = false
  )
  or public.is_community_member(posts.community_id)
);

-- only community members can post into a community
drop policy if exists "users create posts" on public.posts;
create policy "users create posts" on public.posts for insert with check (
  auth.uid() = author_id
  and (community_id is null or public.is_community_member(community_id))
);

-- ---------- group chat: link conversations to communities ----------
alter table public.conversations add column if not exists community_id uuid references public.communities(id) on delete cascade;
create unique index if not exists conversations_community_uidx on public.conversations (community_id) where community_id is not null;

-- ---------- regions ----------
alter table public.profiles add column if not exists region text;
alter table public.live_streams add column if not exists country text;

-- ---------- live scheduling + community/group lives ----------
alter table public.live_streams add column if not exists scheduled_at timestamptz;
alter table public.live_streams add column if not exists community_id uuid references public.communities(id) on delete set null;
create index if not exists live_streams_community_idx on public.live_streams (community_id) where community_id is not null;
create index if not exists live_streams_scheduled_idx on public.live_streams (scheduled_at) where scheduled_at is not null;

-- realtime for the tables the app subscribes to
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_streams') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
