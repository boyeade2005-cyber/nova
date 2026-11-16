-- Marketplace v2 — real favorites, offers and escrow orders.
-- saved_items can't be reused for products (post_id FK -> posts),
-- so favorites get a dedicated product_favorites table.
-- products.images (jsonb) already stores product photo urls — no
-- product_images table needed.

-- ---------- favorites ----------

create table public.product_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

create index product_favorites_product_idx on public.product_favorites (product_id);

-- ---------- offers ----------

create table public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','countered')),
  created_at timestamptz default now()
);

create index product_offers_product_idx on public.product_offers (product_id, status);
create index product_offers_buyer_idx on public.product_offers (buyer_id);

-- ---------- orders (escrow) ----------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'held' check (status in ('held','completed','cancelled','refunded')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- 'refund' kind for escrow cancellations
alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check
  check (kind in ('topup','tip_sent','tip_received','earning','purchase','payout','refund'));

-- ============================================================
-- Escrow RPCs (security definer — wallet writes stay server-side)
-- ============================================================

-- Internal: debit buyer, create held order, log purchase tx.
-- Returns the new order id. Shared by place_order and respond_to_offer.
create or replace function public._place_order(p_buyer uuid, p_product uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_product public.products%rowtype;
  v_order uuid;
begin
  if p_buyer is null or p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_product from public.products where id = p_product for update;
  if not found or v_product.status <> 'active' then
    raise exception 'product_unavailable';
  end if;
  if v_product.seller_id is not null and v_product.seller_id = p_buyer then
    raise exception 'own_product';
  end if;

  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_buyer and balance >= p_amount;
  if not found then raise exception 'insufficient_funds'; end if;

  insert into public.orders (product_id, buyer_id, seller_id, amount, status)
    values (p_product, p_buyer, v_product.seller_id, p_amount, 'held')
    returning id into v_order;

  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (p_buyer, -p_amount, 'purchase', v_product.seller_id, 'order · ' || v_order);

  perform public.notify_user(v_product.seller_id, p_buyer, 'order', 'placed an order for your item');

  return v_order;
end $$;

-- Buy now at a given amount (UI passes the listing price).
create or replace function public.place_order(p_product uuid, p_amount numeric)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return public._place_order(auth.uid(), p_product, p_amount);
end $$;

-- Buyer confirms receipt (or seller marks done): held -> completed,
-- seller is credited 90% of the order amount (platform keeps 10%).
create or replace function public.complete_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_seller_amount numeric;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if auth.uid() is null or (auth.uid() <> v_order.buyer_id and auth.uid() <> v_order.seller_id) then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'held' then raise exception 'invalid_status'; end if;

  v_seller_amount := round(v_order.amount * 0.9, 2);

  update public.orders set status = 'completed' where id = v_order.id;

  insert into public.wallets (user_id, balance) values (v_order.seller_id, v_seller_amount)
    on conflict (user_id) do update
    set balance = public.wallets.balance + v_seller_amount, updated_at = now();
  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (v_order.seller_id, v_seller_amount, 'earning', v_order.buyer_id, 'order · ' || v_order.id);

  if auth.uid() = v_order.buyer_id then
    perform public.notify_user(v_order.seller_id, v_order.buyer_id, 'order', 'confirmed receipt — order completed');
  else
    perform public.notify_user(v_order.buyer_id, v_order.seller_id, 'order', 'marked your order complete');
  end if;
end $$;

-- Cancel a held order: buyer (or seller) cancels, buyer is refunded in full.
create or replace function public.cancel_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if auth.uid() is null or (auth.uid() <> v_order.buyer_id and auth.uid() <> v_order.seller_id) then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'held' then raise exception 'invalid_status'; end if;

  update public.orders set status = 'cancelled' where id = v_order.id;

  insert into public.wallets (user_id, balance) values (v_order.buyer_id, v_order.amount)
    on conflict (user_id) do update
    set balance = public.wallets.balance + v_order.amount, updated_at = now();
  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (v_order.buyer_id, v_order.amount, 'refund', v_order.seller_id, 'order · ' || v_order.id);
end $$;

-- Seller responds to an offer. Accept -> offer accepted, siblings declined,
-- escrow order auto-placed at the offer amount for the original buyer.
create or replace function public.respond_to_offer(p_offer uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer public.product_offers%rowtype;
  v_seller uuid;
  v_order uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_offer from public.product_offers where id = p_offer for update;
  if not found then raise exception 'offer_not_found'; end if;
  if v_offer.status <> 'pending' then raise exception 'invalid_status'; end if;

  select seller_id into v_seller from public.products where id = v_offer.product_id;
  if v_seller is null or v_seller <> auth.uid() then raise exception 'forbidden'; end if;

  if not p_accept then
    update public.product_offers set status = 'declined' where id = v_offer.id;
    return null;
  end if;

  update public.product_offers set status = 'accepted' where id = v_offer.id;
  update public.product_offers set status = 'declined'
    where product_id = v_offer.product_id and id <> v_offer.id and status = 'pending';

  v_order := public._place_order(v_offer.buyer_id, v_offer.product_id, v_offer.amount);
  return v_order;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.product_favorites enable row level security;
alter table public.product_offers enable row level security;
alter table public.orders enable row level security;

-- favorites: own rows only
create policy "users read own favorites" on public.product_favorites for select using (auth.uid() = user_id);
create policy "users add favorites" on public.product_favorites for insert with check (auth.uid() = user_id);
create policy "users remove favorites" on public.product_favorites for delete using (auth.uid() = user_id);

-- offers: buyer and product seller can read; buyers create; all writes via RPC
create policy "offer parties read offers" on public.product_offers for select using (
  auth.uid() = buyer_id
  or exists (
    select 1 from public.products p
    where p.id = product_id and p.seller_id = auth.uid()
  )
);
create policy "buyers create offers" on public.product_offers for insert with check (
  auth.uid() = buyer_id
  and exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active' and p.seller_id <> auth.uid()
  )
);

-- orders: buyer and seller can read; all writes via escrow RPCs
create policy "order parties read orders" on public.orders for select using (
  auth.uid() = buyer_id or auth.uid() = seller_id
);

-- RPCs: authenticated only (wallet mutations stay server-side)
revoke execute on function public._place_order(uuid, uuid, numeric) from public, anon;
grant execute on function public._place_order(uuid, uuid, numeric) to authenticated;
revoke execute on function public.place_order(uuid, numeric) from public, anon;
grant execute on function public.place_order(uuid, numeric) to authenticated;
revoke execute on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to authenticated;
revoke execute on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;
revoke execute on function public.respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;
