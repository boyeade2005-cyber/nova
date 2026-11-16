-- Nova core schema v1 — global-first social platform
-- Tables: profiles, posts, post_media, reactions, comments, follows,
-- communities, community_members, conversations, conversation_members,
-- messages, notifications, saved_items, moments, feed_preferences,
-- products, wallets.

create extension if not exists "uuid-ossp";

-- ---------- helpers ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, avatar_emoji, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_emoji', '🦊'),
    coalesce(new.raw_user_meta_data->>'avatar_color', '#FF6B00')
  )
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  avatar_emoji text default '🦊',
  avatar_color text default '#FF6B00',
  location text,
  country text,
  website text,
  interests text[] default '{}',
  is_verified boolean default false,
  gravity_score int default 0,
  followers_count int default 0,
  following_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- posts ----------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  topics text[] default '{}',
  location text,
  city text,
  country text,
  visibility text not null default 'public' check (visibility in ('public','followers','close_friends')),
  heat int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);
create index posts_topics_idx on public.posts using gin (topics);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  kind text not null check (kind in ('photo','video','audio')),
  url text,
  gradient text,
  emoji text,
  label text,
  duration int,
  position int default 0,
  alt_text text,
  created_at timestamptz default now()
);

create index post_media_post_idx on public.post_media (post_id, position);

-- ---------- reactions ----------

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','love','laugh','wow','support')),
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create index reactions_post_idx on public.reactions (post_id);

-- ---------- comments ----------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  text text not null,
  voice_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------- follows ----------

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

-- ---------- communities ----------

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  emoji text default '🌐',
  gradient text,
  description text,
  category text,
  banner_url text,
  rules text[] default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  members_count int default 0,
  is_private boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger communities_updated_at before update on public.communities
  for each row execute function public.set_updated_at();

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  primary key (community_id, user_id)
);

create index community_members_user_idx on public.community_members (user_id);

-- ---------- conversations & messages ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm','group','community','channel','secret','saved')),
  name text,
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  muted boolean default false,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','image-once','video-once','voice','gift','system')),
  text text,
  media_url text,
  emoji text,
  reaction text,
  is_viewed_once boolean default false,
  viewed_at timestamptz,
  created_at timestamptz default now(),
  edited_at timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.touch_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

create trigger messages_touch_conv after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- ---------- notifications ----------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

create index notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- ---------- saved items ----------

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  collection text default 'all',
  created_at timestamptz default now(),
  unique (user_id, post_id)
);

-- ---------- moments (24h stories) ----------

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text,
  gradient text,
  emoji text,
  caption text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index moments_expires_idx on public.moments (expires_at);
create index moments_user_idx on public.moments (user_id);

-- ---------- feed preferences ----------

create table public.feed_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  topic_sliders jsonb default '{}',
  feed_style text default 'global',
  updated_at timestamptz default now()
);

create trigger feed_prefs_updated_at before update on public.feed_preferences
  for each row execute function public.set_updated_at();

-- ---------- wallets (universal credits) ----------

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(14,2) default 0,
  currency text default 'NOVA',
  updated_at timestamptz default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null,
  kind text not null check (kind in ('topup','tip_sent','tip_received','earning','purchase','payout')),
  counterparty_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

create index wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

-- ---------- marketplace ----------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  price numeric(14,2) not null,
  original_price numeric(14,2),
  currency text default 'USD',
  category text,
  condition text check (condition in ('New','Like new','Good','Fair')),
  location text,
  emoji text,
  gradient text,
  images jsonb default '[]',
  status text not null default 'active' check (status in ('active','sold','reserved','draft')),
  watchers int default 0,
  escrow boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index products_status_idx on public.products (status, created_at desc);
create index products_category_idx on public.products (category);

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.is_conversation_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_items enable row level security;
alter table public.moments enable row level security;
alter table public.feed_preferences enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.products enable row level security;

-- profiles: everyone can read; owner can update; insert via trigger only
create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- posts: public read; author writes
create policy "posts are readable" on public.posts for select using (true);
create policy "users create posts" on public.posts for insert with check (auth.uid() = author_id);
create policy "authors update posts" on public.posts for update using (auth.uid() = author_id);
create policy "authors delete posts" on public.posts for delete using (auth.uid() = author_id);

-- post_media: readable via public posts; write via post author
create policy "media readable" on public.post_media for select using (true);
create policy "authors manage media" on public.post_media for insert with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);
create policy "authors update media" on public.post_media for update using (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);
create policy "authors delete media" on public.post_media for delete using (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);

-- reactions: public read; own write
create policy "reactions readable" on public.reactions for select using (true);
create policy "users add reactions" on public.reactions for insert with check (auth.uid() = user_id);
create policy "users change reactions" on public.reactions for update using (auth.uid() = user_id);
create policy "users remove reactions" on public.reactions for delete using (auth.uid() = user_id);

-- comments: public read; own write
create policy "comments readable" on public.comments for select using (true);
create policy "users comment" on public.comments for insert with check (auth.uid() = author_id);
create policy "authors edit comments" on public.comments for update using (auth.uid() = author_id);
create policy "authors delete comments" on public.comments for delete using (auth.uid() = author_id);

-- follows: public read; own write
create policy "follows readable" on public.follows for select using (true);
create policy "users follow" on public.follows for insert with check (auth.uid() = follower_id);
create policy "users unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- communities: public read; members read member list; creator manages
create policy "communities readable" on public.communities for select using (true);
create policy "users create communities" on public.communities for insert with check (auth.uid() = created_by);
create policy "creators update communities" on public.communities for update using (auth.uid() = created_by);
create policy "creators delete communities" on public.communities for delete using (auth.uid() = created_by);

create policy "member list readable" on public.community_members for select using (true);
create policy "users join communities" on public.community_members for insert with check (auth.uid() = user_id);
create policy "users leave communities" on public.community_members for delete using (auth.uid() = user_id);

-- conversations: members only
create policy "members read conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = auth.uid())
  or kind = 'channel'
);
create policy "users create conversations" on public.conversations for insert with check (auth.uid() = created_by);

create policy "members read conv members" on public.conversation_members for select using (
  public.is_conversation_member(conversation_id)
);
create policy "users join conversations" on public.conversation_members for insert with check (auth.uid() = user_id);
create policy "users update own membership" on public.conversation_members for update using (auth.uid() = user_id);
create policy "users leave conversations" on public.conversation_members for delete using (auth.uid() = user_id);

-- messages: members only (channels readable by all authenticated)
create policy "members read messages" on public.messages for select using (
  public.is_conversation_member(conversation_id)
  or exists (select 1 from public.conversations c where c.id = conversation_id and c.kind = 'channel')
);
create policy "members send messages" on public.messages for insert with check (
  auth.uid() = sender_id and public.is_conversation_member(conversation_id)
);
create policy "senders update messages" on public.messages for update using (auth.uid() = sender_id);
create policy "senders delete messages" on public.messages for delete using (auth.uid() = sender_id);

-- notifications: own only
create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "users mark notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "actors create notifications" on public.notifications for insert with check (auth.uid() = actor_id);

-- saved items: own only
create policy "users manage saved" on public.saved_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- moments: public read while active; owner writes
create policy "active moments readable" on public.moments for select using (expires_at > now());
create policy "users post moments" on public.moments for insert with check (auth.uid() = user_id);
create policy "owners delete moments" on public.moments for delete using (auth.uid() = user_id);

-- feed preferences: own only
create policy "users manage feed prefs" on public.feed_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wallets: own only
create policy "users read own wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "system manages wallets" on public.wallets for insert with check (auth.uid() = user_id);
create policy "users read own transactions" on public.wallet_transactions for select using (auth.uid() = user_id);
create policy "system logs transactions" on public.wallet_transactions for insert with check (auth.uid() = user_id);

-- products: public read active; sellers write own
create policy "active products readable" on public.products for select using (status = 'active' or seller_id = auth.uid());
create policy "sellers create products" on public.products for insert with check (seller_id = auth.uid());
create policy "sellers update products" on public.products for update using (seller_id = auth.uid());
create policy "sellers delete products" on public.products for delete using (seller_id = auth.uid());

-- signup trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
