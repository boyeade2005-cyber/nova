-- Story engagement (views + replies) and order shipping details.

-- ---------- moment views (who saw which story) ----------

create table public.moment_views (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (moment_id, user_id)
);

create index moment_views_moment_idx on public.moment_views (moment_id);

-- ---------- moment replies ----------

create table public.moment_replies (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz default now()
);

create index moment_replies_moment_idx on public.moment_replies (moment_id, created_at);

alter table public.moment_views enable row level security;
alter table public.moment_replies enable row level security;

-- moment views: anyone can record their own view; counts readable while the
-- moment is still active (powers the "seen by N" badge for the owner too).
create policy "users record own moment views" on public.moment_views
  for insert with check (auth.uid() = user_id);
create policy "read views on active moments" on public.moment_views for select using (
  exists (
    select 1 from public.moments m
    where m.id = moment_id and m.expires_at > now()
  )
);

-- moment replies: anyone can reply to an active moment; replies readable
-- while the moment is active.
create policy "reply to active moments" on public.moment_replies
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and m.expires_at > now()
    )
  );
create policy "read replies on active moments" on public.moment_replies for select using (
  exists (
    select 1 from public.moments m
    where m.id = moment_id and m.expires_at > now()
  )
);

-- ---------- order shipping ----------

alter table public.orders
  add column shipping_address jsonb,
  add column buyer_note text;

-- Buyers may fill in shipping after checkout. Column-level grant keeps
-- amount/status/seller_id immutable outside the escrow RPCs (which run as
-- security definer and are unaffected).
revoke update on public.orders from authenticated;
grant update (shipping_address, buyer_note) on public.orders to authenticated;

create policy "buyers update own order shipping" on public.orders for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);
