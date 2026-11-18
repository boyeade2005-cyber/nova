import { Heart, MessageCircle, Share2, Bookmark, SmilePlus, MoreHorizontal, Check, Pencil, Trash2, Flag, Reply } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { currentUser, type Comment, type Post, type ReactionType } from "../data/mock";
import { Avatar, VerifiedBadge } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { VoiceRecorder, VoicePlay } from "./VoiceRecorder";
import { addComment, uploadMedia } from "../lib/api";
import { deleteComment, deletePost, editPostText, fetchPostComments } from "../lib/postActions";
import { submitReport } from "../lib/moderation";
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

const REPORT_REASONS = ["Spam", "Harassment", "Hate speech", "Misinformation", "Impersonation", "Other"];

export function PostCard({
  post,
  onReact,
  onSave,
  onAuthorClick,
  onUpdated,
  onDeleted,
}: {
  post: Post;
  onReact: (postId: string, r: ReactionType) => void;
  onSave: (postId: string) => void;
  onAuthorClick?: (userId: string) => void;
  onUpdated?: (post: Post) => void;
  onDeleted?: (postId: string) => void;
}) {
  const { profile } = useSession();
  const me = profile ?? currentUser;
  const isOwn = post.author.id === me.id;
  const [showPicker, setShowPicker] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [shared, setShared] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { if (shareTimer.current) clearTimeout(shareTimer.current); }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

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

  const [comments, setComments] = useState<Comment[]>(post.comments);
  useEffect(() => {
    setComments(post.comments);
    setCommentsLoaded(false);
  }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openComments = () => {
    setShowComments((v) => {
      const next = !v;
      if (next && !commentsLoaded) {
        setCommentsLoaded(true);
        void fetchPostComments(post.id).then((full) => { if (full.length) setComments(full); });
      }
      return next;
    });
  };

  const media = post.media ?? [];
  const totalReactions = Object.values(post.reactions).reduce((a, b) => a + b, 0);
  const topReaction = reactions.find((r) => r.type === post.myReaction);
  const commentCount = (list: Comment[]): number =>
    list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

  const submitEdit = async () => {
    const text = editText.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await editPostText(post.id, text);
    setBusy(false);
    if (ok) {
      setEditOpen(false);
      onUpdated?.({ ...post, text });
    }
  };

  const submitDelete = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await deletePost(post.id);
    setBusy(false);
    setConfirmDelete(false);
    if (ok) onDeleted?.(post.id);
  };

  const sendReport = async () => {
    const target = reportTarget ?? { type: "post" as const, id: post.id };
    if (!reportReason || busy) return;
    setBusy(true);
    const res = await submitReport(target.type, target.id, reportReason);
    setBusy(false);
    if (res.ok) {
      setReportDone(true);
      setTimeout(() => { setReportOpen(false); setReportTarget(null); setReportDone(false); setReportReason(null); }, 1400);
    }
  };

  const addReply = (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    const reply: Comment = { id: `c${Date.now()}`, author: me, text, time: "now" };
    setComments((cs) => cs.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c)));
    void addComment(post.id, text, parentId);
    setReplyText("");
    setReplyTo(null);
  };

  const removeComment = async (id: string, isReply: boolean, parentId?: string) => {
    setComments((cs) => isReply && parentId
      ? cs.map((c) => (c.id === parentId ? { ...c, replies: (c.replies ?? []).filter((r) => r.id !== id) } : c))
      : cs.filter((c) => c.id !== id));
    await deleteComment(id);
  };

  const menuItem = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-left hover:bg-surface2 transition-colors";

  return (
    <article className="card p-4 mx-3 sm:mx-0 mb-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => onAuthorClick?.(post.author.id)} className="shrink-0" aria-label={`View ${post.author.name}'s profile`}>
          <Avatar user={post.author} size={44} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button onClick={() => onAuthorClick?.(post.author.id)} className="font-heading font-bold text-sm hover:underline text-left">
              {post.author.name}
            </button>
            {post.author.verified && <VerifiedBadge />}
          </div>
          <div className="text-xs text-muted">
            @{post.author.handle} · {post.time}
            {post.location && ` · 📍 ${post.location}`}
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
            aria-label="Post options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-30 w-52 card !rounded-2xl py-1.5 shadow-xl">
              <button className={menuItem} onClick={() => { setMenuOpen(false); setShowWhy(true); }}>
                <SmilePlus size={16} className="text-muted" /> Why am I seeing this?
              </button>
              <button className={menuItem} onClick={() => { setMenuOpen(false); void share(); }}>
                {shared ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} className="text-muted" />} {shared ? "Link copied" : "Copy link"}
              </button>
              {isOwn && (
                <>
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setEditText(post.text); setEditOpen(true); }}>
                    <Pencil size={16} className="text-muted" /> Edit post
                  </button>
                  <button className={menuItem} onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}>
                    <Trash2 size={16} className="text-coral" /> Delete post
                  </button>
                </>
              )}
              {!isOwn && (
                <button className={menuItem} onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
                  <Flag size={16} className="text-coral" /> Report post
                </button>
              )}
            </div>
          )}
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
      {media.length > 0 && (media.length > 1 ? (
        <div className="mt-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory rounded-2xl">
            {media.map((m, i) => (
              <div
                key={i}
                className="relative rounded-2xl overflow-hidden shrink-0 snap-center w-full"
                style={{ background: m.gradient, aspectRatio: m.kind === "video" || m.kind === "audio" ? "16/10" : "4/3", minWidth: "100%" }}
              >
                {m.kind === "audio" && m.url ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 px-4">
                    <audio controls src={m.url} className="w-full" />
                    {m.label && <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/40 text-white px-2 py-0.5 rounded-md">🎙️ {m.label}</span>}
                  </div>
                ) : m.kind === "video" && m.url ? (
                  <video src={m.url} controls playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                ) : m.url ? (
                  <img src={m.url} alt={m.label ?? "post media"} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-5xl drop-shadow-lg">{m.emoji}</span>
                    {m.label && <span className="mt-2 text-xs font-bold bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">{m.label}</span>}
                    {m.duration && <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 px-2 py-0.5 rounded-md">{m.duration}</span>}
                    {m.kind === "video" && <span className="absolute inset-0 flex items-center justify-center"><span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-nova-purple text-xl">▶</span></span>}
                  </div>
                )}
                {m.url && m.duration && m.kind !== "video" && (
                  <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-md">{m.duration}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 mt-2">
            {media.map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted/40" />)}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {(() => {
            const m = media[0];
            return (
              <div
                className="relative rounded-2xl overflow-hidden w-full"
                style={{ background: m.gradient, aspectRatio: m.kind === "video" ? "16/10" : m.kind === "audio" ? "16/7" : "4/3" }}
                role="img"
                aria-label={m.label ?? `${m.kind}`}
              >
                {m.kind === "audio" && m.url ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 px-4">
                    <audio controls src={m.url} className="w-full" />
                    {m.label && <span className="absolute top-2 left-2 text-[11px] font-bold bg-black/40 text-white px-2 py-0.5 rounded-md">🎙️ {m.label}</span>}
                  </div>
                ) : m.kind === "video" && m.url ? (
                  <video src={m.url} controls playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                ) : m.url ? (
                  <img src={m.url} alt={m.label ?? "post media"} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="text-5xl drop-shadow-lg">{m.emoji}</span>
                    {m.label && <span className="mt-2 text-xs font-bold bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">{m.label}</span>}
                    {m.duration && <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 px-2 py-0.5 rounded-md">{m.duration}</span>}
                    {m.kind === "video" && <span className="absolute inset-0 flex items-center justify-center"><span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-nova-purple text-xl">▶</span></span>}
                  </div>
                )}
                {m.url && m.duration && m.kind !== "video" && (
                  <span className="absolute bottom-2 right-2 text-[11px] font-bold bg-black/50 text-white px-2 py-0.5 rounded-md">{m.duration}</span>
                )}
              </div>
            );
          })()}
        </div>
      ))}

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
          <span>{commentCount(comments)} comments</span>
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
          onClick={openComments}
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
            <div key={c.id}>
              <div className="flex gap-2.5">
                <button onClick={() => onAuthorClick?.(c.author.id)} className="shrink-0"><Avatar user={c.author} size={30} /></button>
                <div className="flex-1 min-w-0">
                  <div className="bg-surface2 rounded-2xl rounded-tl-md px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => onAuthorClick?.(c.author.id)} className="font-bold text-xs hover:underline">{c.author.name}</button>
                      <span className="flex items-center gap-1">
                        <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(""); }} className="text-muted hover:text-nova-purple" title="Reply"><Reply size={13} /></button>
                        {c.author.id === me.id ? (
                          <button onClick={() => void removeComment(c.id, false)} className="text-muted hover:text-coral" title="Delete"><Trash2 size={13} /></button>
                        ) : (
                          <button onClick={() => setReportTarget({ type: "comment", id: c.id })} className="text-muted hover:text-coral" title="Report"><Flag size={13} /></button>
                        )}
                      </span>
                    </div>
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
                  {replyTo === c.id && (
                    <div className="flex gap-2 mt-2 ml-1">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addReply(c.id); }}
                        placeholder={`Reply to ${c.author.name.split(" ")[0]}…`}
                        className="flex-1 bg-surface2 rounded-full px-3 py-1.5 text-sm outline-none focus:ring-2 ring-nova-purple/40"
                        autoFocus
                      />
                      <button onClick={() => addReply(c.id)} disabled={!replyText.trim()} className="text-xs font-bold text-nova-purple disabled:opacity-40 px-2">Send</button>
                    </div>
                  )}
                  {(c.replies ?? []).map((r) => (
                    <div key={r.id} className="flex gap-2.5 mt-2 ml-4">
                      <button onClick={() => onAuthorClick?.(r.author.id)} className="shrink-0"><Avatar user={r.author} size={24} /></button>
                      <div className="flex-1 min-w-0">
                        <div className="bg-surface2 rounded-2xl rounded-tl-md px-3 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <button onClick={() => onAuthorClick?.(r.author.id)} className="font-bold text-xs hover:underline">{r.author.name}</button>
                            <span className="flex items-center gap-1">
                              {r.author.id === me.id ? (
                                <button onClick={() => void removeComment(r.id, true, c.id)} className="text-muted hover:text-coral"><Trash2 size={12} /></button>
                              ) : (
                                <button onClick={() => setReportTarget({ type: "comment", id: r.id })} className="text-muted hover:text-coral"><Flag size={12} /></button>
                              )}
                            </span>
                          </div>
                          <p className="text-sm">{r.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                  const nc: Comment = { id: `c${Date.now()}`, author: me, text, time: "now" };
                  setComments([...comments, nc]);
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
      </BottomSheet>

      {/* Edit post */}
      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit post">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={5}
          className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none"
        />
        <button
          onClick={() => void submitEdit()}
          disabled={busy || !editText.trim()}
          className="mt-3 w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </BottomSheet>

      {/* Delete post */}
      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete post?">
        <p className="text-sm text-muted mb-4">This permanently deletes your post and its comments. This can't be undone.</p>
        <button
          onClick={() => void submitDelete()}
          disabled={busy}
          className="w-full h-11 rounded-2xl bg-coral text-white font-bold text-sm disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </BottomSheet>

      {/* Report */}
      <BottomSheet open={reportOpen || reportTarget !== null} onClose={() => { setReportOpen(false); setReportTarget(null); setReportReason(null); setReportDone(false); }} title="Report">
        {reportDone ? (
          <p className="text-center py-6 text-sm font-bold text-emerald-500">Thanks — our team will review this.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted mb-2">Why are you reporting this?</p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReportReason(r)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${reportReason === r ? "border-nova-purple bg-nova-lilac dark:bg-white/10 text-nova-purple" : "border-line hover:bg-surface2"}`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => void sendReport()}
              disabled={!reportReason || busy}
              className="mt-2 w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40"
            >
              {busy ? "Sending…" : "Submit report"}
            </button>
          </div>
        )}
      </BottomSheet>
    </article>
  );
}
