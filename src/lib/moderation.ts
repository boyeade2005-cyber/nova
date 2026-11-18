import { supabase, isSupabaseConfigured } from "./supabase";

export type ReportTarget = "post" | "comment" | "user" | "pulse" | "product" | "message";
export type ReportStatus = "open" | "reviewing" | "dismissed" | "actioned";

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string | null;
  details: string | null;
  status: ReportStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  reporter?: { display_name: string | null; username: string | null } | null;
}

/** File a report against content or a user. */
export async function submitReport(targetType: ReportTarget, targetId: string, reason?: string, details?: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  if (session.user.id === targetId && targetType === "user") return { ok: false, error: "cannot_report_self" };
  const { error } = await supabase.from("reports").insert({
    reporter_id: session.user.id,
    target_type: targetType,
    target_id: targetId,
    reason: reason ?? null,
    details: details ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Reports queue — admin only (RLS restricts select to admins). */
export async function fetchReports(status: ReportStatus | "all" = "open"): Promise<ContentReport[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_id_fkey(display_name, username)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as ContentReport[];
}

export async function resolveReport(id: string, status: ReportStatus): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      reviewed_by: session?.user.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function isAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
  return Boolean(data?.is_admin);
}

export async function fetchBlockedIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured) return new Set();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Set();
  const { data } = await supabase.from("blocked_users").select("blocked_id").eq("user_id", session.user.id);
  return new Set((data ?? []).map((r: any) => r.blocked_id as string));
}

/** Drop items whose author the current user has blocked. Generic over shapes with author.id or creator.id or user.id. */
export async function filterBlocked<T>(items: T[], getAuthorId: (item: T) => string | null | undefined): Promise<T[]> {
  const blocked = await fetchBlockedIds();
  if (!blocked.size) return items;
  return items.filter((item) => {
    const id = getAuthorId(item);
    return !id || !blocked.has(id);
  });
}
