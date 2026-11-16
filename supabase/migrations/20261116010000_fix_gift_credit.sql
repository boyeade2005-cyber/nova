-- Fix: send_gift deducted the sender but never credited the recipient.
-- Now credits the counterparty wallet (90/10 platform split like the UI promises).

create or replace function public.send_gift(p_amount numeric, p_counterparty uuid default null, p_note text default 'gift')
returns void language plpgsql security definer set search_path = public as $$
declare new_balance numeric; creator_share numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;
  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = auth.uid() and balance >= p_amount
    returning balance into new_balance;
  if new_balance is null then raise exception 'insufficient_funds'; end if;
  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (auth.uid(), -p_amount, 'tip_sent', p_counterparty, p_note);

  -- credit the creator/host: 90% of the gift, platform keeps 10%
  if p_counterparty is not null and p_counterparty <> auth.uid() then
    creator_share := round(p_amount * 0.9, 2);
    insert into public.wallets (user_id, balance) values (p_counterparty, creator_share)
      on conflict (user_id) do update set balance = public.wallets.balance + creator_share, updated_at = now();
    insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
      values (p_counterparty, creator_share, 'tip_received', auth.uid(), p_note);
    perform public.notify_user(p_counterparty, auth.uid(), 'gift', 'sent you a gift');
  end if;
end $$;
