import { supabase, isSupabaseConfigured } from "./supabase";

// ---------- moment engagement ----------

/** Record that the current user viewed a moment. Idempotent per (moment, user). */
export async function recordMomentView(momentId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("moment_views")
    .upsert(
      { moment_id: momentId, user_id: session.user.id },
      { onConflict: "moment_id,user_id", ignoreDuplicates: true },
    );
}

/** View counts for a list of moments → Map<momentId, count>. */
export async function fetchMomentViewCounts(momentIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!isSupabaseConfigured || !momentIds.length) return counts;
  const { data } = await supabase
    .from("moment_views")
    .select("moment_id")
    .in("moment_id", momentIds);
  for (const r of data ?? []) {
    counts.set(r.moment_id, (counts.get(r.moment_id) ?? 0) + 1);
  }
  return counts;
}

/** Moment ids the current user has already viewed → Set<momentId>. */
export async function fetchMyMomentViews(momentIds: string[]): Promise<Set<string>> {
  const viewed = new Set<string>();
  if (!isSupabaseConfigured || !momentIds.length) return viewed;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return viewed;
  const { data } = await supabase
    .from("moment_views")
    .select("moment_id")
    .eq("user_id", session.user.id)
    .in("moment_id", momentIds);
  for (const r of data ?? []) viewed.add(r.moment_id);
  return viewed;
}

export async function addMomentReply(momentId: string, text: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !text.trim()) return;
  await supabase.from("moment_replies").insert({
    moment_id: momentId,
    author_id: session.user.id,
    text: text.trim().slice(0, 280),
  });
}

export interface MomentReply {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string; handle: string; avatarColor: string; avatarEmoji: string };
}

export async function fetchMomentReplies(momentId: string, limit = 20): Promise<MomentReply[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("moment_replies")
    .select("id, text, created_at, author:profiles(id, username, display_name, avatar_emoji, avatar_color)")
    .eq("moment_id", momentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse().map((r: any) => ({
    id: r.id,
    text: r.text,
    createdAt: r.created_at,
    author: {
      id: r.author?.id ?? "unknown",
      name: r.author?.display_name ?? r.author?.username ?? "Unknown",
      handle: r.author?.username ?? "unknown",
      avatarColor: r.author?.avatar_color ?? "#FF6B00",
      avatarEmoji: r.author?.avatar_emoji ?? "🦊",
    },
  }));
}

// ---------- message search ----------

export interface MessageSearchResult {
  id: string;
  text: string;
  createdAt: string;
  conversationId: string;
  conversationName: string;
  sender: { id: string; name: string; handle: string; avatarColor: string; avatarEmoji: string };
}

/** Full-text-ish search over messages in conversations the current user belongs to. */
export async function searchMessages(query: string, limit = 20): Promise<MessageSearchResult[]> {
  if (!isSupabaseConfigured) return [];
  const q = query.trim();
  if (!q) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data: mems } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", session.user.id);
  const convoIds = (mems ?? []).map((m: any) => m.conversation_id as string);
  if (!convoIds.length) return [];
  const { data } = await supabase
    .from("messages")
    .select("id, text, created_at, conversation_id, sender:profiles(id, username, display_name, avatar_emoji, avatar_color), conversation:conversations(name, kind)")
    .in("conversation_id", convoIds)
    .ilike("text", `%${q.replace(/[%_]/g, "")}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((m: any) => m.text)
    .map((m: any) => ({
      id: m.id,
      text: m.text,
      createdAt: m.created_at,
      conversationId: m.conversation_id,
      conversationName:
        m.conversation?.name ??
        (m.conversation?.kind === "dm" ? "Direct message" : "Conversation"),
      sender: {
        id: m.sender?.id ?? "unknown",
        name: m.sender?.display_name ?? m.sender?.username ?? "Unknown",
        handle: m.sender?.username ?? "unknown",
        avatarColor: m.sender?.avatar_color ?? "#FF6B00",
        avatarEmoji: m.sender?.avatar_emoji ?? "🦊",
      },
    }));
}

// ---------- order shipping ----------

export interface ShippingAddress {
  name?: string;
  line1?: string;
  city?: string;
  country?: string;
}

/** Find the most recent order the current user placed for a product (place_order RPC returns uuid but placeOrder() discards it). */
export async function latestOrderIdFor(productId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", session.user.id)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Attach shipping details to an order (buyer only, enforced by RLS + column grant). */
export async function setOrderShipping(
  orderId: string,
  address: ShippingAddress,
  note?: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const clean: ShippingAddress = {};
  for (const k of ["name", "line1", "city", "country"] as const) {
    const v = address[k]?.trim();
    if (v) clean[k] = v;
  }
  await supabase
    .from("orders")
    .update({
      shipping_address: Object.keys(clean).length ? clean : null,
      buyer_note: note?.trim() || null,
    })
    .eq("id", orderId);
}
