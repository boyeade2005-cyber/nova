// Deletes the caller's account completely: all content via delete_own_account()
// (runs as the user so auth.uid() resolves), then the auth.users row via admin API.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    // wipe all user content (security-definer RPC resolves auth.uid() from the JWT)
    const { error: rpcError } = await userClient.rpc("delete_own_account");
    if (rpcError) {
      console.error("delete_own_account failed", rpcError);
      return json({ error: "content_delete_failed" }, 500);
    }

    // remove the auth user itself (service role only)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: adminError } = await admin.auth.admin.deleteUser(user.id);
    if (adminError) {
      console.error("admin deleteUser failed", adminError);
      return json({ error: "auth_delete_failed" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "internal_error" }, 500);
  }
});
