-- Live streams + Pulse videos (real tables for the Live & Pulse tabs)
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references public.profiles(id) on delete set null,
  title text not null,
  category text,
  viewer_count int default 0,
  is_live boolean default true,
  gradient text,
  emoji text,
  started_at timestamptz default now()
);

create table if not exists public.pulse_videos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  caption text,
  video_url text,
  gradient text,
  emoji text,
  likes int default 0,
  comments_count int default 0,
  shares int default 0,
  created_at timestamptz default now()
);

alter table public.live_streams enable row level security;
alter table public.pulse_videos enable row level security;

create policy "streams readable" on public.live_streams for select using (true);
create policy "hosts create streams" on public.live_streams for insert with check (auth.uid() = host_id);
create policy "hosts update streams" on public.live_streams for update using (auth.uid() = host_id);
create policy "hosts delete streams" on public.live_streams for delete using (auth.uid() = host_id);

create policy "pulse readable" on public.pulse_videos for select using (true);
create policy "creators post pulse" on public.pulse_videos for insert with check (auth.uid() = creator_id);
create policy "creators update pulse" on public.pulse_videos for update using (auth.uid() = creator_id);
create policy "creators delete pulse" on public.pulse_videos for delete using (auth.uid() = creator_id);

-- seed a few live streams + pulse videos for the demo accounts
insert into public.live_streams (host_id, title, category, viewer_count, gradient, emoji) values
  ('22222222-2222-2222-2222-222222222222', 'Berlin rooftop techno set', 'music', 1284, 'linear-gradient(135deg,#8B5CF6,#EC4899)', '🎧'),
  ('33333333-3333-3333-3333-333333333333', 'Tokyo street food crawl 🍜', 'food', 862, 'linear-gradient(135deg,#FF7A6B,#F59E0B)', '🍢'),
  ('11111111-1111-1111-1111-111111111111', 'Ask me anything — building Nova', 'tech', 341, 'linear-gradient(135deg,#FF6B00,#FF2A5F)', '🦊')
on conflict do nothing;

insert into public.pulse_videos (creator_id, caption, gradient, emoji, likes) values
  ('22222222-2222-2222-2222-222222222222', 'POV: golden hour on the rooftop', 'linear-gradient(135deg,#FF2A5F,#FF6B00)', '🌅', 4210),
  ('33333333-3333-3333-3333-333333333333', 'This takoyaki changed my life', 'linear-gradient(135deg,#FF7A6B,#F59E0B)', '🍢', 8930),
  ('11111111-1111-1111-1111-111111111111', 'Shipping Nova 2.0 tonight 🚀', 'linear-gradient(135deg,#FF6B00,#FFD1B3)', '🚀', 2100)
on conflict do nothing;
