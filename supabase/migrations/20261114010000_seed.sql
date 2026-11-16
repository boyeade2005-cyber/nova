-- Demo seed: 3 global users + content. Password for all: "password123"
create extension if not exists pgcrypto with schema extensions;

-- ---------- auth users ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'nova@demo.io', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"username":"nova","display_name":"Nova Demo","avatar_emoji":"🦊","avatar_color":"#FF6B00"}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'lena@demo.io', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"username":"lena.berlin","display_name":"Lena Vogel","avatar_emoji":"🎧","avatar_color":"#8B5CF6"}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'kenji@demo.io', extensions.crypt('password123', extensions.gen_salt('bf')), now(), now(), now(),
   '{"username":"kenji.tokyo","display_name":"Kenji Sato","avatar_emoji":"🎌","avatar_color":"#00C2D1"}')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"nova@demo.io"}', 'email', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"lena@demo.io"}', 'email', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"kenji@demo.io"}', 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- profiles (trigger may have already created rows; upsert full data)
insert into public.profiles (id, username, display_name, bio, avatar_emoji, avatar_color, location, country, interests, is_verified, gravity_score, followers_count, following_count)
values
  ('11111111-1111-1111-1111-111111111111', 'nova', 'Nova Demo', 'Your world. Your choice. 🦊', '🦊', '#FF6B00', 'Everywhere', 'Global', '{music,tech,food}', true, 842, 128, 96),
  ('22222222-2222-2222-2222-222222222222', 'lena.berlin', 'Lena Vogel', 'Techno dj · Berlin nights 🌃', '🎧', '#8B5CF6', 'Berlin', 'Germany', '{music,nightlife,tech}', true, 1204, 48.2, 210),
  ('33333333-3333-3333-3333-333333333333', 'kenji.tokyo', 'Kenji Sato', 'Street food hunter 🍜 Tokyo', '🎌', '#00C2D1', 'Tokyo', 'Japan', '{food,travel,photography}', false, 677, 12.4, 340)
on conflict (id) do update set
  username = excluded.username, display_name = excluded.display_name, bio = excluded.bio,
  avatar_emoji = excluded.avatar_emoji, avatar_color = excluded.avatar_color,
  location = excluded.location, country = excluded.country, interests = excluded.interests,
  is_verified = excluded.is_verified, gravity_score = excluded.gravity_score,
  followers_count = excluded.followers_count, following_count = excluded.following_count;

-- wallets
insert into public.wallets (user_id, balance, currency)
values
  ('11111111-1111-1111-1111-111111111111', 1250, 'NOVA'),
  ('22222222-2222-2222-2222-222222222222', 8420, 'NOVA'),
  ('33333333-3333-3333-3333-333333333333', 310, 'NOVA')
on conflict (user_id) do nothing;

-- follows: nova follows both, they follow nova
insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- communities
insert into public.communities (id, name, slug, emoji, gradient, description, category, created_by, members_count)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Builders of the World', 'builders', '🛠️', 'linear-gradient(135deg,#00C2D1,#2F6BFF)', 'Ship logs, job posts and weekly AMAs for builders everywhere.', 'tech', '22222222-2222-2222-2222-222222222222', 48200),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Street Food Atlas', 'streetfood', '🍜', 'linear-gradient(135deg,#FF7A6B,#F59E0B)', 'Document the best eats on every corner of Earth.', 'food', '33333333-3333-3333-3333-333333333333', 18900),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Night Frequencies', 'nightfreq', '🎧', 'linear-gradient(135deg,#8B5CF6,#EC4899)', 'Techno, amapiano, baile funk — the sounds of the night.', 'music', '22222222-2222-2222-2222-222222222222', 76400)
on conflict (id) do nothing;

insert into public.community_members (community_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'member')
on conflict do nothing;

-- posts (global-first mix)
insert into public.posts (id, author_id, text, topics, location, city, country, heat) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222',
   'Rooftop set in Berlin tonight 🌃 Berlin is glowing. Who else is out?', '{music,nightlife}', 'Berlin', 'Berlin', 'Germany', 912),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333',
   'Best takoyaki in Tokyo — 10 min walk from Shinjuku station. No queue at 6am 🍢', '{food,travel}', 'Shinjuku', 'Tokyo', 'Japan', 745),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111',
   'What should NOVA build next? Voting opens Friday 🗳️', '{tech,community}', 'Global', 'Everywhere', 'Global', 1203)
on conflict (id) do nothing;

insert into public.post_media (post_id, kind, gradient, emoji, position) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'photo', 'linear-gradient(135deg,#FF2A5F,#FF6B00)', '🌃', 0),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'photo', 'linear-gradient(135deg,#FF7A6B,#F59E0B)', '🍢', 0),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'photo', 'linear-gradient(135deg,#FF6B00,#FFD1B3)', '🗳️', 0)
on conflict do nothing;

-- reactions
insert into public.reactions (post_id, user_id, type) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'love'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'wow'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'support'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'like')
on conflict do nothing;

-- products (marketplace demo)
insert into public.products (id, seller_id, title, description, price, original_price, currency, category, condition, location, emoji, gradient, escrow, watchers)
values
  ('12121212-1212-1212-1212-121212121212', '22222222-2222-2222-2222-222222222222',
   'Vinyl crate — 40 techno records, Berlin pickup', 'Rare Berlin techno pressings. Serious buyers only.', 340, 420, 'USD', 'music', 'Good', 'Berlin, DE', '💿', 'linear-gradient(135deg,#8B5CF6,#EC4899)', true, 87),
  ('13131313-1313-1313-1313-131313131313', '33333333-3333-3333-3333-333333333333',
   'Street food map — Tokyo + Osaka (PDF)', 'My personal map of 120+ stalls, rated by me.', 12, 18, 'USD', 'digital', 'New', 'Tokyo, JP', '🗺️', 'linear-gradient(135deg,#FF7A6B,#F59E0B)', true, 204)
on conflict (id) do nothing;

-- moments (24h)
insert into public.moments (user_id, gradient, emoji, caption, expires_at) values
  ('22222222-2222-2222-2222-222222222222', 'linear-gradient(135deg,#FF2A5F,#FF6B00)', '🌃', 'Rooftop energy', now() + interval '20 hours'),
  ('33333333-3333-3333-3333-333333333333', 'linear-gradient(135deg,#FF7A6B,#F59E0B)', '🍢', '6am takoyaki run', now() + interval '18 hours')
on conflict do nothing;
