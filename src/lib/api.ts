import { supabase, isSupabaseConfigured } from "./supabase";
import type { Post, User, MediaItem, ReactionType } from "../data/mock";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function mapAuthor(p: any): User {
  return {
    id: p.id,
    name: p.display_name ?? p.username,
    handle: p.username,
    avatarColor: p.avatar_color ?? "#FF6B00",
    avatarEmoji: p.avatar_emoji ?? "🦊",
    bio: p.bio ?? undefined,
    location: p.location ?? undefined,
    country: p.country ?? undefined,
    region: p.region ?? undefined,
    verified: p.is_verified,
    interests: p.interests ?? [],
  };
}

const emptyReactions = (): Record<ReactionType, number> => ({ like: 0, love: 0, laugh: 0, wow: 0, support: 0 });

const POST_SELECT = `
  id, text, topics, location, city, country, community_id, created_at, heat,
  author:profiles(id, username, display_name, bio, avatar_emoji, avatar_color, location, country, region, is_verified, interests),
  media:post_media(kind, gradient, emoji, label, duration, position, url)
`;

async function queryPosts(q: PromiseLike<{ data: any[] | null; error: any }>, communityName?: string): Promise<Post[]> {
  try {
    const { data, error } = await q;
    if (error || !data) return [];

    const ids = data.map((p: any) => p.id);
    const [{ data: reacts }, { data: comments }] = await Promise.all([
      supabase.from("reactions").select("post_id, type").in("post_id", ids),
      supabase.from("comments")
        .select("id, post_id, text, voice_url, transcript, transcript_lang, created_at, author:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
        .in("post_id", ids)
        .order("created_at", { ascending: true }),
    ]);

    const reactMap = new Map<string, Record<ReactionType, number>>();
    const commentMap = new Map<string, any[]>();
    for (const r of reacts ?? []) {
      const m = reactMap.get(r.post_id) ?? emptyReactions();
      m[r.type as ReactionType] += 1;
      reactMap.set(r.post_id, m);
    }
    for (const c of comments ?? []) {
      const arr = commentMap.get(c.post_id) ?? [];
      arr.push({
        id: c.id,
        author: mapAuthor(c.author ?? {}),
        text: c.text,
        time: timeAgo(c.created_at),
        voiceUrl: c.voice_url ?? undefined,
        transcript: c.transcript ?? undefined,
        transcriptLang: c.transcript_lang ?? undefined,
      });
      commentMap.set(c.post_id, arr);
    }

    return (data as any[]).map((p) => {
      const media: MediaItem[] = (p.media ?? [])
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((m: any) => ({
          kind: m.kind as MediaItem["kind"],
          url: m.url ?? undefined,
          gradient: m.gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
          emoji: m.emoji ?? "✨",
          label: m.label ?? undefined,
          duration: m.duration ? `${m.duration}s` : undefined,
        }));
      return {
        id: p.id,
        author: mapAuthor(p.author),
        time: timeAgo(p.created_at),
        text: p.text,
        topics: p.topics ?? [],
        location: [p.city, p.country].filter(Boolean).join(", ") || p.location || undefined,
        country: p.country ?? undefined,
        communityId: p.community_id ?? undefined,
        community: communityName,
        media: media.length ? media : undefined,
        reactions: reactMap.get(p.id) ?? emptyReactions(),
        comments: commentMap.get(p.id) ?? [],
        shares: 0,
        saves: 0,
        whySeeing: communityName ? `Posted in ${communityName}` : "Global · because it's heating up right now",
      };
    });
  } catch {
    return [];
  }
}

export function fetchFeedPosts(): Promise<Post[]> {
  if (!isSupabaseConfigured) return Promise.resolve([]);
  return queryPosts(
    supabase.from("posts").select(POST_SELECT).is("community_id", null).order("created_at", { ascending: false }).limit(30),
  );
}

/** Posts inside a community/group — members only for private groups (enforced by RLS). */
export function fetchCommunityPosts(communityId: string, communityName?: string): Promise<Post[]> {
  if (!isSupabaseConfigured) return Promise.resolve([]);
  return queryPosts(
    supabase.from("posts").select(POST_SELECT).eq("community_id", communityId).order("created_at", { ascending: false }).limit(50),
    communityName,
  );
}

export async function uploadMedia(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file);
  if (error) return null;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function createRemotePost(
  text: string,
  topics: string[] = [],
  media?: { kind: "photo" | "video" | "audio"; url: string }[],
  communityId?: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  // tag the post with the author's region so "Local" feeds work
  const { data: prof } = await supabase.from("profiles").select("country, location").eq("id", session.user.id).maybeSingle();
  const country = prof?.country && prof.country !== "Global" ? prof.country : "Global";
  const city = prof?.location?.split(",")[0]?.trim() || "Global";
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: session.user.id, text, topics,
      city, country,
      community_id: communityId ?? null,
    })
    .select("id")
    .single();
  if (error || !post) return null;
  const rows = (media?.length
    ? media.map((m, i) => ({ post_id: post.id, kind: m.kind, url: m.url, position: i }))
    : [{ post_id: post.id, kind: "photo", gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)", emoji: "✨", position: 0 }]) as Record<string, unknown>[];
  await supabase.from("post_media").insert(rows);
  return post.id as string;
}

export function subscribeToPosts(onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel("posts-feed")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ============================================================
// Reactions, comments, follows
// ============================================================

export async function setReaction(postId: string, type: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (type) {
    await supabase.from("reactions").upsert({ post_id: postId, user_id: session.user.id, type });
  } else {
    await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", session.user.id);
  }
}

export async function addComment(
  postId: string,
  text: string,
  parentId?: string,
  voiceUrl?: string,
  transcript?: string,
  transcriptLang?: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("comments").insert({
    post_id: postId, author_id: session.user.id, text, parent_id: parentId ?? null,
    voice_url: voiceUrl ?? null, transcript: transcript ?? null, transcript_lang: transcriptLang ?? null,
  });
}

export async function toggleSave(postId: string, save: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (save) await supabase.from("saved_items").insert({ user_id: session.user.id, post_id: postId });
  else await supabase.from("saved_items").delete().eq("user_id", session.user.id).eq("post_id", postId);
}

export async function followUser(followeeId: string, follow: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (follow) await supabase.from("follows").insert({ follower_id: session.user.id, followee_id: followeeId });
  else await supabase.from("follows").delete().eq("follower_id", session.user.id).eq("followee_id", followeeId);
}

export async function isFollowing(followeeId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", session.user.id).eq("followee_id", followeeId).maybeSingle();
  return !!data;
}

// ============================================================
// Profiles
// ============================================================

const PROFILE_COLS = "id, username, display_name, bio, avatar_url, avatar_emoji, avatar_color, location, country, region, website, interests, is_verified, gravity_score, followers_count, following_count";

export async function searchProfiles(query: string, limit = 10): Promise<any[]> {
  if (!isSupabaseConfigured || !query.trim()) return [];
  const q = query.trim().replace(/[%_]/g, "");
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(limit);
  return data ?? [];
}

export async function getProfile(id: string): Promise<any | null> {
  const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getSuggestedProfiles(limit = 6): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession();
  let q = supabase.from("profiles").select(PROFILE_COLS).order("gravity_score", { ascending: false }).limit(limit + 1);
  if (session) q = q.neq("id", session.user.id);
  const { data } = await q;
  return (data ?? []).slice(0, limit);
}

export async function updateProfile(fields: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("profiles").update(fields).eq("id", session.user.id);
}

// ============================================================
// Communities
// ============================================================

export async function fetchCommunities(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("communities")
    .select("*, community_members(count)")
    .order("members_count", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function fetchMyCommunities(): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from("community_members")
    .select("community:communities(*)")
    .eq("user_id", session.user.id);
  return (data ?? []).map((r: any) => r.community).filter(Boolean);
}

export async function joinCommunity(communityId: string, join: boolean): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (join) {
    await supabase.from("community_members").insert({ community_id: communityId, user_id: session.user.id, role: "member" });
    // sync group-chat membership
    const convoId = await fetchCommunityConversation(communityId);
    if (convoId) {
      await supabase.from("conversation_members").upsert({ conversation_id: convoId, user_id: session.user.id });
    }
  } else {
    await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", session.user.id);
    const convoId = await fetchCommunityConversation(communityId);
    if (convoId) {
      await supabase.from("conversation_members").delete().eq("conversation_id", convoId).eq("user_id", session.user.id);
    }
  }
}

export async function isCommunityMember(communityId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from("community_members").select("user_id").eq("community_id", communityId).eq("user_id", session.user.id).maybeSingle();
  return !!data;
}

// ============================================================
// Messaging
// ============================================================

export interface RemoteConversation {
  id: string;
  kind: string;
  name: string | null;
  otherUser: any | null;
  lastMessage: string;
  lastMessageAt: string | null;
  unread: number;
  members: number;
}

export async function fetchConversations(): Promise<RemoteConversation[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", session.user.id);
  if (!memberships?.length) return [];
  const ids = memberships.map((m) => m.conversation_id);
  const [{ data: convos }, { data: allMembers }] = await Promise.all([
    supabase
      .from("conversations")
      .select("*, members:conversation_members(count)")
      .in("id", ids)
      .order("last_message_at", { ascending: false }),
    supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", ids),
  ]);
  if (!convos) return [];

  // other participant per DM/secret conversation
  const otherIdByConvo = new Map<string, string>();
  for (const m of allMembers ?? []) {
    if (m.user_id === session.user.id) continue;
    if (!otherIdByConvo.has(m.conversation_id)) otherIdByConvo.set(m.conversation_id, m.user_id);
  }
  const otherIds = [...new Set(otherIdByConvo.values())];
  const profiles = new Map<string, any>();
  if (otherIds.length) {
    const { data: profs } = await supabase.from("profiles").select(PROFILE_COLS).in("id", otherIds);
    for (const p of profs ?? []) profiles.set(p.id, p);
  }
  // last message per conversation
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, text, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  const lastByConvo = new Map<string, any>();
  for (const m of msgs ?? []) if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);

  return convos.map((c: any) => {
    const otherId = otherIdByConvo.get(c.id);
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      otherUser: otherId ? profiles.get(otherId) ?? null : null,
      lastMessage: lastByConvo.get(c.id)?.text ?? "",
      lastMessageAt: c.last_message_at ?? lastByConvo.get(c.id)?.created_at ?? null,
      unread: 0,
      members: c.members?.[0]?.count ?? 0,
    };
  });
}

export async function createDM(otherUserId: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ kind: "dm", created_by: session.user.id })
    .select("id")
    .single();
  if (error || !convo) return null;
  await supabase.from("conversation_members").insert([
    { conversation_id: convo.id, user_id: session.user.id },
    { conversation_id: convo.id, user_id: otherUserId },
  ]);
  return convo.id;
}

export async function createChannelConversation(name: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ kind: "channel", name, created_by: session.user.id })
    .select("id")
    .single();
  if (error || !convo) return null;
  await supabase.from("conversation_members").insert({ conversation_id: convo.id, user_id: session.user.id });
  return convo.id;
}

export async function createSavedMessages(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ kind: "saved", name: "Saved Messages", created_by: session.user.id })
    .select("id")
    .single();
  if (error || !convo) return null;
  await supabase.from("conversation_members").insert({ conversation_id: convo.id, user_id: session.user.id });
  return convo.id;
}

export async function fetchMessages(conversationId: string): Promise<any[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, kind, text, emoji, media_url, reaction, transcript, transcript_lang, translations, created_at, is_viewed_once, viewed_at, sender:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  text: string,
  kind = "text",
  mediaUrl?: string,
  emoji?: string,
  transcript?: string,
  transcriptLang?: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: session.user.id, kind, text,
    media_url: mediaUrl ?? null, emoji: emoji ?? null,
    transcript: transcript ?? null, transcript_lang: transcriptLang ?? null,
  });
}

export async function sendVoiceMessage(
  conversationId: string,
  blob: Blob | undefined,
  durationSec: number,
  transcript?: string,
  transcriptLang?: string,
): Promise<void> {
  let url: string | null = null;
  if (blob) {
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
    url = await uploadMedia(file);
  }
  const mins = Math.floor(durationSec / 60);
  const secs = String(durationSec % 60).padStart(2, "0");
  await sendMessage(conversationId, `Voice note · ${mins}:${secs}`, "voice", url ?? undefined, undefined, transcript, transcriptLang);
}

/** Persist a translation on a message so both sides can see it later. */
export async function saveMessageTranslation(messageId: string, lang: string, text: string): Promise<void> {
  const { data: msg } = await supabase.from("messages").select("translations").eq("id", messageId).maybeSingle();
  const translations = { ...((msg?.translations as Record<string, string>) ?? {}), [lang]: text };
  await supabase.from("messages").update({ translations }).eq("id", messageId);
}

export function subscribeToMessages(conversationId: string, onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`msgs-${conversationId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

// ============================================================
// Marketplace
// ============================================================

export async function fetchProducts(category?: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from("products")
    .select("*, seller:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);
  if (category && category !== "all") q = q.eq("category", category);
  const { data } = await q;
  return data ?? [];
}

export async function createProduct(p: {
  title: string; description?: string; price: number; category?: string;
  condition?: string; location?: string; emoji?: string;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("products").insert({
    seller_id: session.user.id,
    title: p.title,
    description: p.description ?? "",
    price: p.price,
    category: p.category ?? "general",
    condition: p.condition ?? "Good",
    location: p.location ?? "Global",
    emoji: p.emoji ?? "📦",
    gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)",
  });
}

// ============================================================
// Moments
// ============================================================

export async function fetchMoments(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("moments")
    .select("*, user:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function createMoment(emoji: string, caption?: string, gradient?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("moments").insert({
    user_id: session.user.id,
    emoji,
    caption: caption ?? "",
    gradient: gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
}

// ============================================================
// Notifications & wallet
// ============================================================

export async function fetchNotifications(): Promise<any[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*, actor:profiles(id, username, display_name, avatar_emoji, avatar_color)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function markNotificationsRead(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", session.user.id).eq("read", false);
}

export async function fetchWallet(): Promise<{ balance: number; currency: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from("wallets").select("balance, currency").eq("user_id", session.user.id).maybeSingle();
  return data ?? null;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  counterparty: { name: string; handle: string } | null;
  createdAt: string;
}

export async function fetchWalletTransactions(): Promise<WalletTransaction[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from("wallet_transactions")
    .select("id, amount, kind, note, created_at, counterparty:profiles!wallet_transactions_counterparty_id_fkey(display_name, username)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((t: any) => ({
    id: t.id,
    amount: Number(t.amount),
    kind: t.kind,
    note: t.note,
    counterparty: t.counterparty ? { name: t.counterparty.display_name ?? t.counterparty.username, handle: t.counterparty.username } : null,
    createdAt: t.created_at,
  }));
}

/** Start a Stripe Checkout for buying NOVA coins. Returns the checkout URL. */
export async function buyCoins(amountCents: number): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("create-checkout", { body: { amount: amountCents } });
  if (error || !data?.url) return null;
  return data.url as string;
}

/** Send NOVA coins to another user (P2P transfer). */
export async function sendCoins(toUserId: string, amount: number, note = "transfer"): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("send_coins", { p_to: toUserId, p_amount: amount, p_note: note });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============================================================
// Live streams & Pulse videos
// ============================================================

export async function fetchLiveStreams(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("live_streams")
    .select("*, host:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified), community:communities(id, name, emoji)")
    .or("is_live.eq.true,scheduled_at.not.is.null")
    .order("viewer_count", { ascending: false })
    .limit(30);
  return data ?? [];
}

export interface StartLiveOptions {
  scheduledAt?: string;   // ISO — creates a scheduled (not yet live) stream
  communityId?: string;   // group/community live
  country?: string;       // region tag for discovery
}

export async function startLiveStream(
  title: string,
  category = "just-chatting",
  opts: StartLiveOptions = {},
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from("live_streams").insert({
    host_id: session.user.id, title, category,
    viewer_count: opts.scheduledAt ? 0 : 1,
    is_live: !opts.scheduledAt,
    scheduled_at: opts.scheduledAt ?? null,
    community_id: opts.communityId ?? null,
    country: opts.country ?? null,
    gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)", emoji: "🔴",
  }).select("id").single();
  return error ? null : data.id;
}

/** Flip a scheduled stream to live (host presses "Start now"). */
export async function goLiveNow(streamId: string): Promise<void> {
  await supabase.from("live_streams").update({ is_live: true, scheduled_at: null, viewer_count: 1 }).eq("id", streamId);
}

export async function endLiveStream(id: string): Promise<void> {
  await supabase.from("live_streams").update({ is_live: false }).eq("id", id);
}

export async function fetchPulseVideos(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("pulse_videos")
    .select("*, creator:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function createPulseVideo(caption: string, videoUrl?: string, emoji = "🎬"): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("pulse_videos").insert({
    creator_id: session.user.id, caption, video_url: videoUrl ?? null,
    gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)", emoji,
  });
}

// ============================================================
// User-scoped fetches
// ============================================================

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id, text, topics, location, city, country, created_at, heat,
      author:profiles(id, username, display_name, bio, avatar_emoji, avatar_color, location, is_verified, interests),
      media:post_media(kind, gradient, emoji, label, duration, position, url)
    `)
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  const ids = data.map((p: any) => p.id);
  const [{ data: reacts }, { data: comments }] = await Promise.all([
    supabase.from("reactions").select("post_id, type").in("post_id", ids),
    supabase.from("comments").select("id, post_id, text, voice_url, transcript, transcript_lang, created_at, author:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)").in("post_id", ids).order("created_at"),
  ]);
  const reactMap = new Map<string, Record<ReactionType, number>>();
  const commentMap = new Map<string, any[]>();
  for (const r of reacts ?? []) {
    const m = reactMap.get(r.post_id) ?? ({ like: 0, love: 0, laugh: 0, wow: 0, support: 0 } as Record<ReactionType, number>);
    m[r.type as ReactionType] += 1;
    reactMap.set(r.post_id, m);
  }
  for (const c of comments ?? []) {
    const arr = commentMap.get(c.post_id) ?? [];
    arr.push({ id: c.id, author: mapAnyProfile(c.author), text: c.text, time: timeAgo(c.created_at), voiceUrl: c.voice_url ?? undefined, transcript: c.transcript ?? undefined, transcriptLang: c.transcript_lang ?? undefined });
    commentMap.set(c.post_id, arr);
  }
  return (data as any[]).map((p) => ({
    id: p.id,
    author: mapAnyProfile(p.author),
    time: timeAgo(p.created_at),
    text: p.text,
    topics: p.topics ?? [],
    location: [p.city, p.country].filter(Boolean).join(", ") || undefined,
    media: (p.media ?? []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((m: any) => ({
      kind: m.kind as MediaItem["kind"], url: m.url ?? undefined,
      gradient: m.gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
      emoji: m.emoji ?? "✨", label: m.label ?? undefined, duration: m.duration ? `${m.duration}s` : undefined,
    })),
    reactions: reactMap.get(p.id) ?? { like: 0, love: 0, laugh: 0, wow: 0, support: 0 },
    comments: commentMap.get(p.id) ?? [],
    shares: 0, saves: 0, whySeeing: "Your post",
  }));
}

function mapAnyProfile(p: any): User {
  return {
    id: p?.id ?? "unknown",
    name: p?.display_name ?? p?.username ?? "Unknown",
    handle: p?.username ?? "unknown",
    avatarColor: p?.avatar_color ?? "#FF6B00",
    avatarEmoji: p?.avatar_emoji ?? "🦊",
    bio: p?.bio ?? undefined,
    location: p?.location ?? undefined,
    country: p?.country ?? undefined,
    region: p?.region ?? undefined,
    verified: p?.is_verified,
    interests: p?.interests ?? [],
  };
}

export async function createCommunity(
  name: string,
  description: string,
  category: string,
  emoji = "🌐",
  isPrivate = false,
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: comm, error } = await supabase.from("communities").insert({
    name, description, category, emoji, is_private: isPrivate,
    gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)",
    created_by: session.user.id,
  }).select("id").single();
  if (error || !comm) return null;

  // creator becomes owner + member, and a linked group-chat conversation is created
  await supabase.from("community_members").insert({ community_id: comm.id, user_id: session.user.id, role: "owner" });
  const { data: convo } = await supabase.from("conversations").insert({
    kind: "community", name, community_id: comm.id, created_by: session.user.id,
  }).select("id").single();
  if (convo) {
    await supabase.from("conversation_members").insert({ conversation_id: convo.id, user_id: session.user.id });
  }
  return comm.id;
}

/** Find the group-chat conversation linked to a community. */
export async function fetchCommunityConversation(communityId: string): Promise<string | null> {
  const { data } = await supabase.from("conversations").select("id").eq("community_id", communityId).maybeSingle();
  return data?.id ?? null;
}

export async function fetchCommunityMembers(communityId: string): Promise<any[]> {
  const { data } = await supabase
    .from("community_members")
    .select("role, joined_at, user:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .eq("community_id", communityId)
    .limit(20);
  return (data ?? []).map((m: any) => ({ ...m.user, role: m.role }));
}

// ============================================================
// Pulse likes
// ============================================================

export async function togglePulseLike(pulseId: string, like: boolean): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  if (like) {
    await supabase.from("pulse_likes").upsert({ pulse_id: pulseId, user_id: session.user.id });
  } else {
    await supabase.from("pulse_likes").delete().eq("pulse_id", pulseId).eq("user_id", session.user.id);
  }
}

export async function fetchMyPulseLikes(): Promise<Set<string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return new Set();
  const { data } = await supabase.from("pulse_likes").select("pulse_id").eq("user_id", session.user.id);
  return new Set((data ?? []).map((r: any) => r.pulse_id as string));
}

// ============================================================
// Live stream chat, viewer presence, gifts
// ============================================================

export async function fetchLiveMessages(streamId: string): Promise<any[]> {
  const { data } = await supabase
    .from("live_messages")
    .select("id, user_id, text, created_at, user:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(100);
  return data ?? [];
}

export async function sendLiveMessage(streamId: string, text: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("live_messages").insert({ stream_id: streamId, user_id: session.user.id, text });
}

export function subscribeToLiveMessages(streamId: string, onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`live-msgs-${streamId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_messages", filter: `stream_id=eq.${streamId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export function subscribeToLiveStream(streamId: string, onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`live-stream-${streamId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${streamId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export async function joinLiveStream(streamId: string): Promise<void> {
  await supabase.rpc("live_join", { sid: streamId });
}

export async function leaveLiveStream(streamId: string): Promise<void> {
  await supabase.rpc("live_leave", { sid: streamId });
}

/** Spend NOVA credits as a gift/tip. Throws on insufficient funds. */
export async function sendGift(amount: number, counterpartyId?: string, note = "gift"): Promise<void> {
  const { error } = await supabase.rpc("send_gift", {
    p_amount: amount,
    p_counterparty: counterpartyId ?? null,
    p_note: note,
  });
  if (error) throw error;
}

/** Mark a conversation as read up to now. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", session.user.id);
}

// ============================================================
// Creator analytics
// ============================================================

export interface CreatorStats {
  posts: number;
  followers: number;
  following: number;
  reactionsReceived: number;
  commentsReceived: number;
  balance: number;
  earned: number;
}

export async function fetchCreatorStats(): Promise<CreatorStats> {
  const empty: CreatorStats = { posts: 0, followers: 0, following: 0, reactionsReceived: 0, commentsReceived: 0, balance: 0, earned: 0 };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return empty;
  const uid = session.user.id;

  const [{ count: posts }, { count: followers }, { count: following }, { data: myPosts }, wallet] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", uid),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", uid),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("follower_id", uid),
    supabase.from("posts").select("id").eq("author_id", uid),
    fetchWallet(),
  ]);

  const postIds = (myPosts ?? []).map((p: any) => p.id);
  let reactionsReceived = 0;
  let commentsReceived = 0;
  if (postIds.length) {
    const [{ count: rc }, { count: cc }] = await Promise.all([
      supabase.from("reactions").select("post_id", { count: "exact", head: true }).in("post_id", postIds),
      supabase.from("comments").select("post_id", { count: "exact", head: true }).in("post_id", postIds),
    ]);
    reactionsReceived = rc ?? 0;
    commentsReceived = cc ?? 0;
  }

  let earned = 0;
  const { data: txns } = await supabase
    .from("wallet_transactions")
    .select("amount, kind")
    .eq("user_id", uid)
    .in("kind", ["tip_received", "earning"]);
  for (const t of txns ?? []) earned += Number(t.amount) || 0;

  return {
    posts: posts ?? 0,
    followers: followers ?? 0,
    following: following ?? 0,
    reactionsReceived,
    commentsReceived,
    balance: wallet?.balance ?? 0,
    earned,
  };
}
