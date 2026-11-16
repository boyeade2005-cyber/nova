import { supabase, isSupabaseConfigured } from "./supabase";
import { fetchConversations, fetchWallet, fetchUserPosts } from "./api";

// ============================================================
// Profile extras — badges, highlights, DM ensure, export, delete
// ============================================================

async function currentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// ---------- badges ----------

export interface BadgeState {
  communityGrower: boolean;
  topCreator: boolean;
  globetrotter: boolean;
  weekWarrior: boolean;
  voiceStar: boolean;
  earlyAdopter: boolean;
}

const NO_BADGES: BadgeState = {
  communityGrower: false,
  topCreator: false,
  globetrotter: false,
  weekWarrior: false,
  voiceStar: false,
  earlyAdopter: false,
};

export async function fetchBadgeState(communityCount: number, gravity: number): Promise<BadgeState> {
  if (!isSupabaseConfigured) return NO_BADGES;
  const id = await currentUserId();
  if (!id) return NO_BADGES;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [profileRes, weekRes, voiceCommentRes, voiceMessageRes] = await Promise.all([
    supabase.from("profiles").select("country, created_at").eq("id", id).maybeSingle(),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", id).gte("created_at", weekAgo),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", id).not("voice_url", "is", null),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", id).eq("kind", "voice"),
  ]);

  const country = profileRes.data?.country;
  const createdAt = profileRes.data?.created_at;

  return {
    communityGrower: communityCount > 0,
    topCreator: gravity > 1000,
    globetrotter: !!country && country !== "Global",
    weekWarrior: (weekRes.count ?? 0) > 0,
    voiceStar: (voiceCommentRes.count ?? 0) > 0 || (voiceMessageRes.count ?? 0) > 0,
    earlyAdopter: !!createdAt && new Date(createdAt) < new Date(thirtyDaysAgo),
  };
}

// ---------- profile highlights ----------

export interface ProfileHighlight {
  id: string;
  title: string;
  emoji: string;
  gradient: string;
  position: number;
  created_at: string;
}

const HIGHLIGHT_GRADIENTS = [
  "linear-gradient(135deg,#FF6B00,#FF2A5F)",
  "linear-gradient(135deg,#2F6BFF,#00C2D1)",
  "linear-gradient(135deg,#00C2D1,#8B5CF6)",
  "linear-gradient(135deg,#8B5CF6,#EC4899)",
  "linear-gradient(135deg,#FF7A6B,#F59E0B)",
  "linear-gradient(135deg,#10B981,#0EA5E9)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#EC4899,#2F6BFF)",
];

export async function fetchHighlights(): Promise<ProfileHighlight[]> {
  if (!isSupabaseConfigured) return [];
  const id = await currentUserId();
  if (!id) return [];
  const { data } = await supabase
    .from("profile_highlights")
    .select("id, title, emoji, gradient, position, created_at")
    .eq("user_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as ProfileHighlight[];
}

export async function addHighlight(emoji: string, title: string): Promise<ProfileHighlight | null> {
  if (!isSupabaseConfigured) return null;
  const id = await currentUserId();
  if (!id) return null;
  const { count } = await supabase
    .from("profile_highlights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);
  const gradient = HIGHLIGHT_GRADIENTS[(count ?? 0) % HIGHLIGHT_GRADIENTS.length];
  const { data, error } = await supabase
    .from("profile_highlights")
    .insert({ user_id: id, emoji, title: title.trim() || "Highlight", gradient, position: count ?? 0 })
    .select("id, title, emoji, gradient, position, created_at")
    .single();
  if (error || !data) return null;
  return data as ProfileHighlight;
}

export async function deleteHighlight(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from("profile_highlights").delete().eq("id", id);
}

// ---------- direct messages ----------

/**
 * Find an existing DM between me and otherUserId, or create one.
 * Returns the conversation id. Handles self-DMs (member inserted once).
 */
export async function ensureDM(otherUserId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const me = session.user.id;

  // my conversations that are DMs
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", me);
  const convoIds = (memberships ?? []).map((m: any) => m.conversation_id as string);
  if (convoIds.length) {
    const { data: convos } = await supabase
      .from("conversations")
      .select("id, members:conversation_members(user_id)")
      .in("id", convoIds)
      .eq("kind", "dm");
    for (const c of convos ?? []) {
      const members = ((c as any).members ?? []).map((m: any) => m.user_id as string);
      const hasMe = members.includes(me);
      const hasOther = members.includes(otherUserId);
      const isSelf = me === otherUserId;
      if (hasMe && hasOther && (isSelf ? members.length === 1 : members.length === 2)) {
        return c.id as string;
      }
    }
  }

  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ kind: "dm", created_by: me })
    .select("id")
    .single();
  if (error || !convo) return null;

  const rows = me === otherUserId
    ? [{ conversation_id: convo.id, user_id: me }]
    : [
        { conversation_id: convo.id, user_id: me },
        { conversation_id: convo.id, user_id: otherUserId },
      ];
  const { error: memberError } = await supabase.from("conversation_members").insert(rows);
  if (memberError) {
    await supabase.from("conversations").delete().eq("id", convo.id);
    return null;
  }
  return convo.id as string;
}

// ---------- user settings ----------

export type NovaSettings = Record<string, unknown>;

export async function fetchSettings(): Promise<NovaSettings> {
  if (!isSupabaseConfigured) return {};
  const id = await currentUserId();
  if (!id) return {};
  const { data } = await supabase.from("user_settings").select("settings").eq("user_id", id).maybeSingle();
  return (data?.settings as NovaSettings) ?? {};
}

export async function saveSettings(partial: NovaSettings): Promise<void> {
  if (!isSupabaseConfigured) return;
  const id = await currentUserId();
  if (!id) return;
  const current = await fetchSettings();
  await supabase.from("user_settings").upsert({
    user_id: id,
    settings: { ...current, ...partial },
  });
}

// ---------- blocked accounts ----------

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_emoji: string | null;
  avatar_color: string | null;
  created_at: string;
}

export async function fetchBlocked(): Promise<BlockedUser[]> {
  if (!isSupabaseConfigured) return [];
  const id = await currentUserId();
  if (!id) return [];
  const { data } = await supabase
    .from("blocked_users")
    .select("created_at, blocked:profiles!blocked_users_blocked_id_fkey(id, username, display_name, avatar_emoji, avatar_color)")
    .eq("user_id", id)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((r: any) => {
      const p = r.blocked;
      if (!p) return null;
      return {
        id: p.id as string,
        username: p.username as string,
        display_name: p.display_name as string | null,
        avatar_emoji: p.avatar_emoji as string | null,
        avatar_color: p.avatar_color as string | null,
        created_at: r.created_at as string,
      };
    })
    .filter(Boolean) as BlockedUser[];
}

export async function blockUser(blockedId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const id = await currentUserId();
  if (!id || id === blockedId) return;
  await supabase.from("blocked_users").upsert({ user_id: id, blocked_id: blockedId });
}

export async function unblockUser(blockedId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const id = await currentUserId();
  if (!id) return;
  await supabase.from("blocked_users").delete().eq("user_id", id).eq("blocked_id", blockedId);
}

// ---------- profile metadata (columns not in api.ts PROFILE_COLS) ----------

export async function fetchProfileMeta(): Promise<{ created_at: string | null; country: string | null; region: string | null }> {
  const empty = { created_at: null, country: null, region: null };
  if (!isSupabaseConfigured) return empty;
  const id = await currentUserId();
  if (!id) return empty;
  const { data } = await supabase.from("profiles").select("created_at, country, region").eq("id", id).maybeSingle();
  return {
    created_at: data?.created_at ?? null,
    country: data?.country ?? null,
    region: data?.region ?? null,
  };
}

// ---------- data export ----------

export async function exportUserData(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured) return null;
  const id = await currentUserId();
  if (!id) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const [posts, conversations, settings, wallet, blocked] = await Promise.all([
    fetchUserPosts(id),
    fetchConversations(),
    fetchSettings(),
    fetchWallet(),
    fetchBlocked(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    profile,
    settings,
    wallet,
    posts,
    conversations: conversations.map((c) => ({
      id: c.id, kind: c.kind, name: c.name, otherUser: c.otherUser?.username ?? null,
      lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt,
    })),
    blockedUsers: blocked,
  };
}

// ---------- account deletion ----------

export async function deleteOwnAccount(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Supabase is not configured." };
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Fire-and-forget helpers used by Profile/Inbox for the DM handoff. */
export const DM_EVENT = "nova:open-dm";
export const DM_STORAGE_KEY = "nova-open-dm";
