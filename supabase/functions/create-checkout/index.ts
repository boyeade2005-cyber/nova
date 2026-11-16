// Creates a Stripe Checkout session for buying NOVA coins.
// Secret key stays server-side; the client only gets a redirect URL.
// Rate: 1 USD = 10 NOVA coins.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COINS_PER_USD = 10;
const ALLOWED_AMOUNTS = [500, 1000, 2500, 5000, 10000]; // cents: $5–$100

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "payments_not_configured" }, 503);

  try {
    // verify the caller is a logged-in Nova user
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { amount } = await req.json();
    const cents = Math.round(Number(amount));
    if (!ALLOWED_AMOUNTS.includes(cents)) return json({ error: "invalid_amount" }, 400);

    const coins = cents / 100 * COINS_PER_USD;
    const origin = req.headers.get("Origin") ?? "http://localhost:5173";

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/?wallet=success`);
    params.set("cancel_url", `${origin}/?wallet=cancel`);
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][unit_amount]", String(cents));
    params.set("line_items[0][price_data][product_data][name]", `${coins} NOVA coins`);
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[user_id]", user.id);
    params.set("metadata[coins]", String(coins));
    params.set("payment_intent_data[metadata][user_id]", user.id);
    params.set("payment_intent_data[metadata][coins]", String(coins));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("stripe error", session);
      return json({ error: session.error?.message ?? "stripe_error" }, 502);
    }
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: "internal_error" }, 500);
  }
});
