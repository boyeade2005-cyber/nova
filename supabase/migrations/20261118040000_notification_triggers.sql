-- Generate notification rows for real social events.
-- Triggers run as the acting user; functions are security definer so the
-- insert bypasses the "actors create notifications" RLS check safely
-- (actor_id is always set to the real actor, never spoofable).

create or replace function public.notify_user(
  p_user uuid,
  p_actor uuid,
  p_type text,
  p_message text,
  p_post uuid default null,
  p_community uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, message, post_id, community_id)
    values (p_user, p_actor, p_type, p_message, p_post, p_community);
end $$;

-- new follower
create or replace function public.trg_notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_user(new.followee_id, new.follower_id, 'follow', 'started following you');
  return new;
end $$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.trg_notify_follow();

-- reaction on a post
create or replace function public.trg_notify_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform public.notify_user(author, new.user_id, 'reaction', 'reacted ' || new.type || ' to your post', new.post_id);
  return new;
end $$;

drop trigger if exists reactions_notify on public.reactions;
create trigger reactions_notify after insert on public.reactions
  for each row execute function public.trg_notify_reaction();

-- comment on a post (also notifies parent-comment author on replies)
create or replace function public.trg_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; parent_author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform public.notify_user(author, new.author_id, 'comment', 'commented on your post', new.post_id);
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.notify_user(parent_author, new.author_id, 'comment', 'replied to your comment', new.post_id);
  end if;
  return new;
end $$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.trg_notify_comment();

-- pulse like
create or replace function public.trg_notify_pulse_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare creator uuid;
begin
  select creator_id into creator from public.pulse_videos where id = new.pulse_id;
  perform public.notify_user(creator, new.user_id, 'like', 'liked your Pulse');
  return new;
end $$;

drop trigger if exists pulse_likes_notify on public.pulse_likes;
create trigger pulse_likes_notify after insert on public.pulse_likes
  for each row execute function public.trg_notify_pulse_like();

-- direct message (dm conversations only — group/community chats stay quiet)
create or replace function public.trg_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare convo_kind text; member record;
begin
  select kind into convo_kind from public.conversations where id = new.conversation_id;
  if convo_kind <> 'dm' or new.sender_id is null then
    return new;
  end if;
  for member in
    select user_id from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    perform public.notify_user(
      member.user_id, new.sender_id, 'message',
      left(coalesce(new.text, 'Sent a ' || new.kind), 120)
    );
  end loop;
  return new;
end $$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.trg_notify_message();

-- community join
create or replace function public.trg_notify_community_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; owner uuid;
begin
  select name, created_by into cname, owner from public.communities where id = new.community_id;
  perform public.notify_user(owner, new.user_id, 'community', 'joined ' || coalesce(cname, 'your community'), null, new.community_id);
  return new;
end $$;

drop trigger if exists community_members_notify on public.community_members;
create trigger community_members_notify after insert on public.community_members
  for each row execute function public.trg_notify_community_join();

-- marketplace offer received (product_offers created by buyers)
create or replace function public.trg_notify_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare seller uuid; pname text;
begin
  select seller_id, title into seller, pname from public.products where id = new.product_id;
  perform public.notify_user(seller, new.buyer_id, 'offer',
    'made an offer of ' || new.amount || ' on "' || coalesce(pname, 'your item') || '"');
  return new;
end $$;

drop trigger if exists product_offers_notify on public.product_offers;
create trigger product_offers_notify after insert on public.product_offers
  for each row execute function public.trg_notify_offer();
