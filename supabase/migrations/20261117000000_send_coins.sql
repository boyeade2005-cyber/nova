-- P2P coin transfers between users (wallet send)

create or replace function public.send_coins(p_to uuid, p_amount numeric, p_note text default 'transfer')
returns void language plpgsql security definer set search_path = public as $$
declare new_balance numeric;
begin
  if p_to is null or p_to = auth.uid() then raise exception 'invalid_recipient'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = auth.uid() and balance >= p_amount
    returning balance into new_balance;
  if new_balance is null then raise exception 'insufficient_funds'; end if;

  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (auth.uid(), -p_amount, 'tip_sent', p_to, p_note);

  insert into public.wallets (user_id, balance) values (p_to, p_amount)
    on conflict (user_id) do update set balance = public.wallets.balance + p_amount, updated_at = now();
  insert into public.wallet_transactions (user_id, amount, kind, counterparty_id, note)
    values (p_to, p_amount, 'tip_received', auth.uid(), p_note);
  perform public.notify_user(p_to, auth.uid(), 'coins', 'sent you ' || p_amount || ' coins');
end $$;
