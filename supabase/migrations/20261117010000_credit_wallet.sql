-- Atomic wallet credit used by the Stripe webhook (service-role only).

create or replace function public.credit_wallet(
  p_user uuid,
  p_amount numeric,
  p_kind text default 'topup',
  p_note text default 'stripe_topup',
  p_ref text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.wallets (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update
    set balance = public.wallets.balance + p_amount, updated_at = now();

  insert into public.wallet_transactions (user_id, amount, kind, note)
    values (p_user, p_amount, p_kind, p_note || coalesce(' · ' || p_ref, ''));
end $$;
