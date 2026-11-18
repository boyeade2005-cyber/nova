-- Platform moderation: admin flag, content reports & moderation queue

-- ---------- platform admin flag ----------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- profiles already allow owners to update every column. Keep is_admin
-- server-controlled so a user cannot promote themselves through updateProfile().
create or replace function public.protect_profile_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if TG_OP = 'INSERT' and coalesce(new.is_admin, false) and not public.is_platform_admin() then
      raise exception 'cannot_set_admin_flag';
    elsif TG_OP = 'UPDATE' and new.is_admin is distinct from old.is_admin and not public.is_platform_admin() then
      raise exception 'cannot_modify_admin_flag';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_admin_flag on public.profiles;
create trigger profiles_protect_admin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_profile_admin_flag();

-- demo admin account so the moderation queue is reachable in seeded environments
update public.profiles
set is_admin = true
where id = '11111111-1111-1111-1111-111111111111'
   or username = 'nova';

-- ---------- reports ----------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'pulse', 'product', 'message')),
  target_id uuid not null,
  reason text,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'dismissed', 'actioned')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at desc);

drop trigger if exists reports_updated_at on public.reports;
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

drop policy if exists "users create reports" on public.reports;
drop policy if exists "reporters read own reports" on public.reports;
drop policy if exists "admins read reports" on public.reports;
drop policy if exists "admins update reports" on public.reports;
drop policy if exists "admins delete reports" on public.reports;

create policy "users create reports" on public.reports for insert with check (
  auth.uid() = reporter_id
  and not (target_type = 'user' and target_id = auth.uid())
);

create policy "reporters read own reports" on public.reports for select using (
  auth.uid() = reporter_id
);

create policy "admins read reports" on public.reports for select using (
  public.is_platform_admin()
);

create policy "admins update reports" on public.reports for update using (
  public.is_platform_admin()
) with check (
  public.is_platform_admin()
);

create policy "admins delete reports" on public.reports for delete using (
  public.is_platform_admin()
);

grant select, insert, update, delete on public.reports to authenticated;
revoke all on public.reports from anon;
