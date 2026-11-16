// Stripe webhook — credits the user's NOVA wallet when a checkout completes.
// Configure in Stripe Dashboard → Developers → Webhooks:
//   endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook
//   event: checkout.session.completed
// Then set the signing secret: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  if (!stripeKey || !webhookSecret || !signature) {
    return new Response("not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (e) {
    console.error("signature verification failed", e);
    return new Response("bad signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return new Response("ok", { status: 200 });

  const userId = session.metadata?.user_id;
  const coins = Number(session.metadata?.coins ?? 0);
  if (!userId || !coins || coins <= 0) return new Response("ok", { status: 200 });

  // idempotency: don't credit the same Stripe session twice
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: existing } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("note", `stripe_topup · ${session.id}`)
    .maybeSingle();
  if (existing) return new Response("ok", { status: 200 });

  const { error } = await supabase.rpc("credit_wallet", {
    p_user: userId,
    p_amount: coins,
    p_kind: "topup",
    p_note: "stripe_topup",
    p_ref: session.id,
  });
  if (error) {
    console.error("credit_wallet failed", error);
    return new Response("credit failed", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
