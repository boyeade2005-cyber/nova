import { Heart, MessageCircle, Share2, Bookmark, SmilePlus, MoreHorizontal, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { currentUser, type Post, type ReactionType } from "../data/mock";
import { Avatar, VerifiedBadge } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { VoiceRecorder, VoicePlay } from "./VoiceRecorder";
import { addComment, uploadMedia } from "../lib/api";
import { shareLink } from "../lib/socialExtra";
import { useSession } from "../lib/useSession";
import { TranslateButton } from "./Translate";

const reactions: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "like", emoji: "👍", label: "Like", color: "#3B82F6" },
  { type: "love", emoji: "❤️", label: "Love", color: "#FF7A6B" },
  { type: "laugh", emoji: "😂", label: "Haha", color: "#F59E0B" },
  { type: "wow", emoji: "😮", label: "Wow", color: "#8B5CF6" },
  { type: "support", emoji: "🙌", label: "Support", color: "#10B981" },
];

function ReactionPicker({ onPick }: { onPick: (r: ReactionType) => void }) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-line rounded-full px-2 py-1.5 shadow-lg">
      {reactions.map((r) => (
        <button
          key={r.type}
          onClick={() => onPick(r.type)}
          title={r.label}
          className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-xl transition-transform hover:scale-125"
        >
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

export function PostCard({
  post,
  onReact,
  onSave,
}: {
  post: Post;
  onReact: (postId: string, r: ReactionType) => void;
  onSave: (postId: string) => void;
}) {
  const { profile } = useSession();
  const me = profile ?? currentUser;
  const [showPicker, setShowPicker] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [shared, setShared] = useState(false);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (shareTimer.current) clearTimeout(shareTimer.current); }, []);

  const share = async () => {
    const result = await shareLink({
      title: `${post.author.name} on Nova`,
      text: post.text.slice(0, 120),
      url: `${window.location.origin}/?post=${post.id}`,
    });
    if (result === "failed") return;
    setShared(true);
    if (shareTimer.current) clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShared(false), 2000);
  };
  const [comments, setComments] = useState(post.comments);
  const media = post.media ?? [];
  const totalReactions = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  const topReaction = reactions.find((r) => r.type === post.myReaction);

  return (
    <article className="card p-4 mx-3 sm:mx-0 mb-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar user={post.author} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-heading font-bold text-sm">{post.author.name}</span>
            {post.author.verified && <VerifiedBadge />}
          </div>
          <div className="text-xs text-muted">
            @{post.author.handle} · {post.time}
            {post.location && ` · 📍 ${post.location}`}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowWhy(true)}
            className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
            aria-label="Post options"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Community tag */}
      {post.community && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-nova-purple bg-nova-lilac dark:bg-white/10 px-2.5 py-1 rounded-full">
          💬 {post.community}
        </div>
      )}

      {/* Text */}
      <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap">{post.text}</p>

      {/* Topic chips */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {post.topics.map((t) => (
          <span key={t} className="text-[11px] font-bold text-muted bg-surface2 px-2 py-0.5 rounded-full">
            #{t}
          </span>
        ))}
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: media.length > 1 ? "1fr 1fr" : "1fr" }}>
          {media.map((m, i) => (
            <div
              key={i}
              className={`relative rounded-2xl overflow-hidden ${m.kind === "video" || m.kind === "audio" ? "col-span-2" : ""} ${media.length > 2 && i > 1 ? "hidden" : ""}`}
              style={{ background: m.gradient, aspectRatio: m.kind === "video" ? "16/10" : m.kind === "audio" ? "16/7" : "1/1" }}
              role="img"
              aria-label={m.label ?? `${m.kind}`}
            >
              {m.kind === "audio" && m.url ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 px-4">
                  <audio controls src={m.url} className="w-full" />
                  {m.label && (
                    <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/40 text-white px-2 py-0.5 rounded-md">
                      🎙️ {m.label}
                    </span>
                  )}
                </div>
              ) : m.url ? (
                <img src={m.url} alt={m.label ?? "post media"} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <span className="text-5xl drop-shadow-lg">{m.emoji}</span>
                  {m.label && (
                    <span className="mt-2 text-xs font-bold bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
                      {m.label}
                    </span>
                  )}
                  {m.duration && (
                    <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 px-2 py-0.5 rounded-md">
                      {m.duration}
                    </span>
                  )}
                  {m.kind === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-nova-purple text-xl">▶</span>
                    </span>
                  )}
                </div>
              )}
              {m.url && m.duration && (
                <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-md">
                  {m.duration}
                </span>
              )}
              {media.length > 2 && i === 1 && (
                <span className="absolute bottom-2 left-2 text-[11px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-md">
                  +{media.length - 2} more
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reactions summary */}
      <div className="flex items-center justify-between mt-3 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span className="flex -space-x-1">
            {reactions.slice(0, 3).map((r) => (
              <span key={r.type} className="w-5 h-5 rounded-full bg-surface2 border border-line flex items-center justify-center text-[10px]">
                {r.emoji}
              </span>
            ))}
          </span>
          <span>{totalReactions + (post.myReaction ? 1 : 0)}</span>
        </div>
        <div className="flex gap-3">
          <span>{post.comments.length + (comments.length - post.comments.length)} comments</span>
          <span>{post.shares} shares</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line relative">
        <div className="relative">
          <button
            onMouseEnter={() => setShowPicker(true)}
            onMouseLeave={() => setShowPicker(false)}
            onClick={() => {
              if (post.myReaction) onReact(post.id, post.myReaction);
              else onReact(post.id, "like");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
              topReaction ? "" : "text-muted hover:bg-surface2"
            }`}
            style={topReaction ? { color: topReaction.color } : undefined}
          >
            {topReaction ? topReaction.emoji : <Heart size={18} />} {post.myReaction ? topReaction?.label : "React"}
          </button>
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-2" onMouseEnter={() => setShowPicker(true)} onMouseLeave={() => setShowPicker(false)}>
              <ReactionPicker onPick={(r) => { onReact(post.id, r); setShowPicker(false); }} />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-muted hover:bg-surface2"
        >
          <MessageCircle size={18} /> Comment
        </button>
        <button
          onClick={() => void share()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-muted hover:bg-surface2"
        >
          {shared ? <Check size={18} className="text-emerald-500" /> : <Share2 size={18} />} {shared ? "Link copied" : "Share"}
        </button>
        <button
          onClick={() => onSave(post.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${post.saved ? "text-nova-purple" : "text-muted hover:bg-surface2"}`}
        >
          <Bookmark size={18} fill={post.saved ? "currentColor" : "none"} /> {post.saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-line space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar user={c.author} size={30} />
              <div className="flex-1">
                <div className="bg-surface2 rounded-2xl rounded-tl-md px-3 py-2">
                  <span className="font-bold text-xs">{c.author.name}</span>
                  {c.voice || c.voiceUrl ? (
                    <div className="mt-1">
                      <VoicePlay duration={c.voice ?? "0:00"} src={c.voiceUrl} small />
                      {c.transcript && <p className="text-xs italic opacity-80 mt-1">“{c.transcript}”</p>}
                      {c.transcript && <TranslateButton text={c.transcript} />}
                    </div>
                  ) : (
                    <p className="text-sm">{c.text}</p>
                  )}
                </div>
                {c.replies?.map((r) => (
                  <div key={r.id} className="flex gap-2.5 mt-2 ml-4">
                    <Avatar user={r.author} size={24} />
                    <div className="flex-1">
                      <div className="bg-surface2 rounded-2xl rounded-tl-md px-3 py-1.5">
                        <span className="font-bold text-xs">{r.author.name}</span>
                        <p className="text-sm">{r.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2 items-center">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) {
                  const text = commentText.trim();
                  setComments([...comments, { id: `c${Date.now()}`, author: me, text, time: "now" }]);
                  void addComment(post.id, text);
                  setCommentText("");
                }
              }}
              placeholder="Add a kind comment…"
              className="flex-1 bg-surface2 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 ring-nova-purple/40"
            />
            <VoiceRecorder
              compact
              onSend={async ({ durationSec: secs, blob, transcript }) => {
                const dur = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
                let voiceUrl: string | undefined;
                if (blob) {
                  const f = new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
                  voiceUrl = (await uploadMedia(f)) ?? undefined;
                }
                setComments([...comments, { id: `c${Date.now()}`, author: me, text: "🎙️ Voice comment", voice: dur, voiceUrl, transcript, time: "now" }]);
                void addComment(post.id, "🎙️ Voice comment", undefined, voiceUrl, transcript);
              }}
            />
            <SmilePlus size={20} className="text-muted" />
          </div>
        </div>
      )}

      {/* Why am I seeing this */}
      <BottomSheet open={showWhy} onClose={() => setShowWhy(false)} title="Why am I seeing this?">
        <p className="text-sm text-muted leading-relaxed mb-3">
          Nova shows you <span className="font-bold text-ink">everything</span> — no hidden algorithm deciding what you miss.
          This post appeared because:
        </p>
        <div className="bg-surface2 rounded-2xl p-4 text-sm font-semibold flex items-start gap-2">
          <span>✨</span> {post.whySeeing}
        </div>
        <button className="mt-4 w-full h-11 rounded-2xl border border-line font-bold text-sm text-nova-purple hover:bg-surface2 transition-colors">
          See less like this
        </button>
        <button className="mt-2 w-full h-11 rounded-2xl border border-line font-bold text-sm text-coral hover:bg-surface2 transition-colors">
          Report post
        </button>
      </BottomSheet>
    </article>
  );
}
