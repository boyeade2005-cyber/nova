-- Community events, event RSVPs & community resources
--
-- Visibility mirrors community posts: rows of public communities are
-- readable by any authenticated user; private communities require membership
-- (see 20261116000000_groups_region_live.sql "posts are readable").
-- Event/resource management requires community owner or admin.

create or replace function public.is_community_admin(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where community_id = cid
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ---------- events ----------

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text default '',
  emoji text default '📅',
  created_at timestamptz default now()
);

create index if not exists community_events_community_idx on public.community_events (community_id, starts_at);

alter table public.community_events enable row level security;

create policy "events readable" on public.community_events for select using (
  exists (
    select 1 from public.communities c
    where c.id = community_events.community_id and c.is_private = false
  )
  or public.is_community_member(community_events.community_id)
);

create policy "admins create events" on public.community_events for insert with check (
  auth.uid() = created_by and public.is_community_admin(community_id)
);

create policy "admins update events" on public.community_events for update using (
  public.is_community_admin(community_id)
);

create policy "admins delete events" on public.community_events for delete using (
  public.is_community_admin(community_id)
);

-- ---------- event RSVPs ----------

create table if not exists public.community_event_rsvps (
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going' check (status in ('going','maybe','cant_go')),
  created_at timestamptz default now(),
  primary key (event_id, user_id)
);

create index if not exists community_event_rsvps_event_idx on public.community_event_rsvps (event_id);

alter table public.community_event_rsvps enable row level security;

create policy "rsvps readable" on public.community_event_rsvps for select using (
  exists (
    select 1 from public.community_events e
    join public.communities c on c.id = e.community_id
    where e.id = community_event_rsvps.event_id
      and (c.is_private = false or public.is_community_member(c.id))
  )
);

create policy "users manage own rsvps" on public.community_event_rsvps for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.community_events e
    join public.communities c on c.id = e.community_id
    where e.id = event_id
      and (c.is_private = false or public.is_community_member(c.id))
  )
);

create policy "users update own rsvps" on public.community_event_rsvps for update using (
  auth.uid() = user_id
);

create policy "users delete own rsvps" on public.community_event_rsvps for delete using (
  auth.uid() = user_id
);

-- ---------- resources ----------

create table if not exists public.community_resources (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text default '',
  url text,
  file_url text,
  kind text not null default 'link' check (kind in ('link','file')),
  created_at timestamptz default now()
);

create index if not exists community_resources_community_idx on public.community_resources (community_id, created_at desc);

alter table public.community_resources enable row level security;

create policy "resources readable" on public.community_resources for select using (
  exists (
    select 1 from public.communities c
    where c.id = community_resources.community_id and c.is_private = false
  )
  or public.is_community_member(community_resources.community_id)
);

create policy "members share resources" on public.community_resources for insert with check (
  auth.uid() = uploaded_by
  and public.is_community_member(community_id)
);

create policy "uploaders update resources" on public.community_resources for update using (
  auth.uid() = uploaded_by or public.is_community_admin(community_id)
);

create policy "uploaders delete resources" on public.community_resources for delete using (
  auth.uid() = uploaded_by or public.is_community_admin(community_id)
);

-- ---------- realtime ----------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_event_rsvps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_event_rsvps;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_resources') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_resources;
  END IF;
END $$;
