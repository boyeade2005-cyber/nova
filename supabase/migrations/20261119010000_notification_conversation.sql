-- Deep-linkable notifications: store the conversation id on message notifications
-- so tapping one opens the exact chat.

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

create or replace function public.notify_user(
  p_user uuid,
  p_actor uuid,
  p_type text,
  p_message text,
  p_post uuid default null,
  p_community uuid default null,
  p_conversation uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, message, post_id, community_id, conversation_id)
    values (p_user, p_actor, p_type, p_message, p_post, p_community, p_conversation);
end $$;

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
      left(coalesce(new.text, 'Sent a ' || new.kind), 120),
      null, null, new.conversation_id
    );
  end loop;
  return new;
end $$;
