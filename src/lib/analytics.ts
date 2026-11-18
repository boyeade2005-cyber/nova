import { supabase, isSupabaseConfigured } from "./supabase";
import { rateLimited } from "./rateLimit";

const MIN_INTERVAL_MS = 1000;

/** Fire-and-forget analytics insert. Never throws, never blocks the caller. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!isSupabaseConfigured) return;
  if (!rateLimited(`analytics:${event}`, MIN_INTERVAL_MS)) return;
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("analytics_events").insert({
        user_id: session.user.id,
        event,
        props,
      });
    } catch {
      // analytics must never break the app
    }
  })();
}
