import { supabase, isSupabaseConfigured } from "./supabase";
import type { Comment, User } from "../data/mock";

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
    id: p?.id ?? "unknown",
    name: p?.display_name ?? p?.username ?? "Unknown",
    handle: p?.username ?? "unknown",
    avatarColor: p?.avatar_color ?? "#FF6B00",
    avatarEmoji: p?.avatar_emoji ?? "🦊",
    verified: p?.is_verified,
  };
}

const COMMENT_SELECT = `id, post_id, author_id, parent_id, text, voice_url, transcript, transcript_lang, created_at, author:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)`;

/** Full comment thread for a post, replies nested one level under parents. */
export async function fetchPostComments(postId: string): Promise<Comment[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as any[];
  const toComment = (c: any): Comment => ({
    id: c.id,
    author: mapAuthor(c.author),
    text: c.text,
    time: timeAgo(c.created_at),
    voiceUrl: c.voice_url ?? undefined,
    transcript: c.transcript ?? undefined,
    transcriptLang: c.transcript_lang ?? undefined,
  });
  const top: Comment[] = [];
  const byId = new Map<string, Comment>();
  for (const c of rows) {
    const cm = toComment(c);
    byId.set(c.id, cm);
    if (!c.parent_id) top.push(cm);
  }
  for (const c of rows) {
    if (c.parent_id && byId.has(c.parent_id)) {
      const parent = byId.get(c.parent_id)!;
      (parent.replies ??= []).push(byId.get(c.id)!);
    }
  }
  return top;
}

export async function editPostText(postId: string, text: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from("posts").update({ text }).eq("id", postId);
  return !error;
}

export async function deletePost(postId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  return !error;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  return !error;
}
