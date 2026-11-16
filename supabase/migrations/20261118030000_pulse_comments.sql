-- Pulse comments: comments on pulse_videos, realtime-enabled.

create table if not exists public.pulse_comments (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references public.pulse_videos(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists pulse_comments_pulse_idx on public.pulse_comments (pulse_id, created_at);

alter table public.pulse_comments enable row level security;

-- comments: public read; own write (same pattern as post comments)
create policy "pulse comments readable" on public.pulse_comments for select using (true);
create policy "users comment on pulse" on public.pulse_comments for insert with check (auth.uid() = author_id);
create policy "authors edit pulse comments" on public.pulse_comments for update using (auth.uid() = author_id);
create policy "authors delete pulse comments" on public.pulse_comments for delete using (auth.uid() = author_id);

-- keep pulse_videos.comments_count in sync (same pattern as pulse_likes)
create or replace function public.sync_pulse_comments_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    update public.pulse_videos set comments_count = comments_count + 1 where id = new.pulse_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.pulse_videos set comments_count = greatest(comments_count - 1, 0) where id = old.pulse_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists pulse_comments_sync on public.pulse_comments;
create trigger pulse_comments_sync after insert or delete on public.pulse_comments
  for each row execute function public.sync_pulse_comments_count();

-- realtime publication (required for postgres_changes)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pulse_comments'
  ) then
    alter publication supabase_realtime add table public.pulse_comments;
  end if;
end $$;
