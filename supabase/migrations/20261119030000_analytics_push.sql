-- Analytics events + web-push subscriptions.
-- Tables used by src/lib/analytics.ts (track) and src/components/PushManager.tsx.

-- ---------- analytics events ----------

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event text not null check (char_length(event) between 1 and 120),
  props jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index analytics_events_user_event_idx
  on public.analytics_events (user_id, event, created_at);

alter table public.analytics_events enable row level security;

-- users may only insert their own events; analytics are write-only from the
-- client (no select policy).
create policy "insert own analytics events" on public.analytics_events
  for insert with check (auth.uid() = user_id);

-- ---------- push subscriptions ----------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- users manage only their own subscriptions.
create policy "manage own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
