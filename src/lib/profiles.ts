import { supabase, isSupabaseConfigured } from "./supabase";
import { getProfile, fetchUserPosts, isFollowing } from "./api";
import { ensureDM, DM_EVENT, DM_STORAGE_KEY } from "./profileExtra";
import type { Post, User } from "../data/mock";

// ============================================================
// Cross-screen navigation + profile helpers
// ============================================================

/** App listens: detail { tab, postId?, pulseId? } — switches tab, then deep-links to a post/pulse. */
export const NAV_EVENT = "nova:navigate";
/** App listens: detail { userId } — opens that user's profile screen. */
export const PROFILE_EVENT = "nova:open-profile";
/** Home/Pulse listen: detail { id, pulse? } — scroll to `post-<id>` / `pulse-<id>` and highlight. */
export const OPEN_POST_EVENT = "nova:open-post";

/** Map a raw profiles row to the app's User shape (mirrors api.ts mapAuthor). */
function mapProfileRow(p: any): User {
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

export interface PublicProfileStats {
  posts: number;
  followers: number;
  following: number;
}

export interface PublicProfileData {
  user: User;
  stats: PublicProfileStats;
  /** Whether the current user follows this profile. */
  isFollowing: boolean;
  posts: Post[];
}

async function countRows(table: string, column: string, value: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  return error ? null : (count ?? 0);
}

/**
 * Full public view of any user: profile row, post/follower/following stats,
 * follow state (me → them) and their recent posts.
 */
export async function fetchPublicProfile(userId: string): Promise<PublicProfileData | null> {
  if (!isSupabaseConfigured) return null;
  const p = await getProfile(userId);
  if (!p) return null;

  const [posts, postsCount, followersA, followersB, followingCount, following] = await Promise.all([
    fetchUserPosts(userId),
    countRows("posts", "author_id", userId),
    // follows schema differs across migrations: followee_id vs following_id
    countRows("follows", "followee_id", userId),
    countRows("follows", "following_id", userId),
    countRows("follows", "follower_id", userId),
    isFollowing(userId),
  ]);

  const followers = followersA ?? followersB ?? 0;

  return {
    user: mapProfileRow(p),
    stats: {
      posts: p.posts_count ?? postsCount ?? posts.length,
      followers: p.followers_count ?? followers,
      following: p.following_count ?? followingCount ?? 0,
    },
    isFollowing: following,
    posts,
  };
}

/** Ids of everyone the current user follows (for the Following feed). */
export async function fetchFollowingIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!isSupabaseConfigured) return ids;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return ids;

  let { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", session.user.id);

  if (error) {
    // fallback column naming (following_id)
    const r = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", session.user.id);
    for (const row of r.data ?? []) ids.add((row as any).following_id as string);
    return ids;
  }

  for (const row of data ?? []) {
    const id = (row as any).followee_id as string | undefined;
    if (id) ids.add(id);
  }
  return ids;
}

/** Resolve a username (with or without @) to a profile id — for ?u= deep links. */
export async function lookupProfileByUsername(username: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const clean = username.trim().replace(/^@/, "").replace(/[%_]/g, "");
  if (!clean) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", clean)
    .limit(1);
  return (data?.[0] as { id: string } | undefined) ?? null;
}

/**
 * Find-or-create the DM with another user, stash the id for Inbox's mount
 * fallback, and fire DM_EVENT so an already-mounted Inbox opens it live.
 */
export async function openDMConversation(otherUserId: string): Promise<string | null> {
  const convoId = await ensureDM(otherUserId);
  if (!convoId) return null;
  try {
    localStorage.setItem(DM_STORAGE_KEY, convoId);
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(DM_EVENT, { detail: { conversationId: convoId } }));
  return convoId;
}

