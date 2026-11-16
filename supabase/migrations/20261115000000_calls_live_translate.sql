-- Nova v2: real-time calls, live streaming chat/video mesh, voice transcripts,
-- pulse likes, wallet gifts, realtime publication for postgres_changes.

-- ---------- calls (1:1 voice/video over WebRTC) ----------

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('voice','video')),
  status text not null default 'ringing' check (status in ('ringing','active','ended','declined','missed')),
  created_at timestamptz default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create index if not exists calls_callee_idx on public.calls (callee_id, status, created_at desc);
create index if not exists calls_caller_idx on public.calls (caller_id, status, created_at desc);

create table if not exists public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice','end')),
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists call_signals_call_idx on public.call_signals (call_id, created_at);

create or replace function public.is_call_participant(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.calls c
    where c.id = cid and (c.caller_id = auth.uid() or c.callee_id = auth.uid())
  );
$$;

alter table public.calls enable row level security;
alter table public.call_signals enable row level security;

create policy "participants read calls" on public.calls for select
  using (caller_id = auth.uid() or callee_id = auth.uid());
create policy "caller creates call" on public.calls for insert
  with check (caller_id = auth.uid());
create policy "participants update calls" on public.calls for update
  using (caller_id = auth.uid() or callee_id = auth.uid());
create policy "participants delete calls" on public.calls for delete
  using (caller_id = auth.uid() or callee_id = auth.uid());

create policy "participants read signals" on public.call_signals for select
  using (public.is_call_participant(call_id));
create policy "participants send signals" on public.call_signals for insert
  with check (auth.uid() = from_id and public.is_call_participant(call_id));
create policy "senders delete signals" on public.call_signals for delete
  using (auth.uid() = from_id);

-- ---------- voice transcripts & translations ----------

alter table public.messages add column if not exists transcript text;
alter table public.messages add column if not exists transcript_lang text;
alter table public.messages add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.comments add column if not exists transcript text;
alter table public.comments add column if not exists transcript_lang text;

-- ---------- live streams: chat + viewer mesh ----------

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists live_messages_stream_idx on public.live_messages (stream_id, created_at);

create table if not exists public.live_signals (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('join','offer','answer','ice','peer-left')),
  payload jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists live_signals_stream_idx on public.live_signals (stream_id, created_at);
create index if not exists live_signals_to_idx on public.live_signals (to_id, stream_id);

alter table public.live_messages enable row level security;
alter table public.live_signals enable row level security;

create policy "live chat readable" on public.live_messages for select using (true);
create policy "users send live chat" on public.live_messages for insert
  with check (auth.uid() = user_id);
create policy "senders delete live chat" on public.live_messages for delete
  using (auth.uid() = user_id);

create or replace function public.is_live_host(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.live_streams s
    where s.id = sid and s.host_id = auth.uid()
  );
$$;

create policy "signals readable by participants" on public.live_signals for select using (
  to_id = auth.uid()
  or from_id = auth.uid()
  or public.is_live_host(stream_id)
);
create policy "participants send live signals" on public.live_signals for insert
  with check (
    auth.uid() = from_id
    and exists (select 1 from public.live_streams s where s.id = stream_id and s.is_live)
    and (to_id is null or to_id <> auth.uid())
  );
create policy "senders delete live signals" on public.live_signals for delete
  using (auth.uid() = from_id);

-- viewer count join/leave (atomic)
create or replace function public.live_join(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_streams
    set viewer_count = viewer_count + 1
    where id = sid and is_live;
end $$;

create or replace function public.live_leave(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.live_streams
    set viewer_count = greatest(viewer_count - 1, 0)
    where id = sid;
end $$;

-- ---------- pulse likes ----------

create table if not exists public.pulse_likes (
  pulse_id uuid not null references public.pulse_videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (pulse_id, user_id)
);

alter table public.pulse_likes enable row level security;

create policy "pulse likes readable" on public.pulse_likes for select using (true);
create policy "users like pulse" on public.pulse_likes for insert
  with check (auth.uid() = user_id);
create policy "users unlike pulse" on public.pulse_likes for delete
  using (auth.uid() = user_id);

create or replace function public.sync_pulse_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.pulse_videos set likes = likes + 1 where id = new.pulse_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.pulse_videos set likes = greatest(likes - 1, 0) where id = old.pulse_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists pulse_likes_sync on public.pulse_likes;
create trigger pulse_likes_sync after insert or delete on public.pulse_likes
  for each row execute function public.sync_pulse_likes();

-- ---------- wallet gifts (atomic spend) ----------

create or replace function public.send_gift(p_amount numeric, p_counterparty uuid default null, p_note text default 'gift')
returns void language plpgsql security definer set search_path = public as $$
declare new_balance numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = auth.uid() and balance >= p_amount
    returning balance into new_balance;
  if new_balance is null then raise exception 'insufficient_funds'; end if;
  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (auth.uid(), -p_amount, 'tip_sent', p_counterparty, p_note);
end $$;

-- ---------- realtime publication (required for postgres_changes) ----------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','posts','post_media','reactions','comments','follows',
    'communities','community_members','conversations','conversation_members',
    'messages','notifications','saved_items','moments','feed_preferences',
    'wallets','wallet_transactions','products','live_streams','pulse_videos',
    'calls','call_signals','live_messages','live_signals','pulse_likes'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
