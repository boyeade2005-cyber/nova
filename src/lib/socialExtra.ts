import { supabase, isSupabaseConfigured } from "./supabase";
import type { User } from "../data/mock";

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

// ============================================================
// Pulse comments
// ============================================================

export interface PulseComment {
  id: string;
  pulseId: string;
  author: User;
  text: string;
  time: string;
}

function mapPulseComment(c: any): PulseComment {
  const p = c.author ?? {};
  return {
    id: c.id,
    pulseId: c.pulse_id,
    author: {
      id: p.id ?? "unknown",
      name: p.display_name ?? p.username ?? "Unknown",
      handle: p.username ?? "unknown",
      avatarColor: p.avatar_color ?? "#FF6B00",
      avatarEmoji: p.avatar_emoji ?? "🦊",
      verified: p.is_verified,
    },
    text: c.text,
    time: timeAgo(c.created_at),
  };
}

export async function fetchPulseComments(pulseId: string): Promise<PulseComment[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("pulse_comments")
    .select("id, pulse_id, text, created_at, author:profiles(id, username, display_name, avatar_emoji, avatar_color, is_verified)")
    .eq("pulse_id", pulseId)
    .order("created_at", { ascending: true })
    .limit(100);
  return (data ?? []).map(mapPulseComment);
}

export async function addPulseComment(pulseId: string, text: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await supabase.from("pulse_comments").insert({
    pulse_id: pulseId,
    author_id: session.user.id,
    text: text.trim(),
  });
}

export function subscribeToPulseComments(pulseId: string, onChange: () => void) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel(`pulse-comments-${pulseId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "pulse_comments", filter: `pulse_id=eq.${pulseId}` }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export const EMOJIS = [
  "😀", "😂", "🥰", "😍", "🤩", "😎", "🥳", "😴",
  "🤔", "😢", "😭", "😡", "🤯", "🫡", "👋", "🙏",
  "❤️", "🔥", "✨", "🎉", "🌅", "🌈", "⚽", "🎮",
  "🍕", "☕", "✈️", "🏖️", "🐶", "🌙", "⭐", "💡",
];

// ============================================================
// Share helper — Web Share API with clipboard fallback
// ============================================================

export type ShareResult = "shared" | "copied" | "failed";

export async function shareLink(opts: { title: string; text?: string; url: string }): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(opts.url);
    return "copied";
  } catch {
    return "failed";
  }
}
