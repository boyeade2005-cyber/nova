import { useEffect, useRef, useState } from "react";
import { Plus, X, Eye, Send, MessageCircle } from "lucide-react";
import type { Moment, User } from "../data/mock";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { EmojiGrid } from "./EmojiPicker";
import { EMOJIS } from "../lib/socialExtra";
import { fetchMoments, createMoment } from "../lib/api";
import {
  recordMomentView, fetchMomentViewCounts, fetchMyMomentViews,
  fetchMomentReplies, addMomentReply,
  type MomentReply,
} from "../lib/engagement";
import { useSession } from "../lib/useSession";

const STORY_GRADIENTS = [
  "linear-gradient(135deg,#FF6B00,#FF2A5F)",
  "linear-gradient(135deg,#8B5CF6,#EC4899)",
  "linear-gradient(135deg,#0EA5E9,#6366F1)",
  "linear-gradient(135deg,#10B981,#84CC16)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
];

const mapUser = (p: any): User => ({
  id: p?.id ?? "unknown",
  name: p?.display_name ?? p?.username ?? "Unknown",
  handle: p?.username ?? "unknown",
  avatarColor: p?.avatar_color ?? "#FF6B00",
  avatarEmoji: p?.avatar_emoji ?? "🦊",
  verified: p?.is_verified,
});

export function MomentsRow() {
  const { profile } = useSession();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [viewCounts, setViewCounts] = useState<Map<string, number>>(new Map());
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const viewedIdsRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<Moment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [storyEmoji, setStoryEmoji] = useState(EMOJIS[0]);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyGradient, setStoryGradient] = useState(STORY_GRADIENTS[0]);
  const [posting, setPosting] = useState(false);

  const load = () => {
    fetchMoments().then(async (rows) => {
      const list = rows
        .filter((m: any) => m.user_id !== profile?.id)
        .slice(0, 20)
        .map((m: any) => ({
          id: m.id,
          user: mapUser(m.user),
          gradient: m.gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
          emoji: m.emoji ?? "✨",
          caption: m.caption ?? undefined,
          viewed: false,
        }));
      setMoments(list);
      const ids = list.map((m) => m.id);
      const [counts, mine] = await Promise.all([
        fetchMomentViewCounts(ids),
        fetchMyMomentViews(ids),
      ]);
      setViewCounts(counts);
      viewedIdsRef.current = mine;
      setViewedIds(mine);
    });
  };
  useEffect(load, [profile?.id]);

  const markViewed = (id: string) => {
    if (viewedIdsRef.current.has(id)) return;
    viewedIdsRef.current = new Set(viewedIdsRef.current).add(id);
    setViewedIds(viewedIdsRef.current);
    setViewCounts((c) => new Map(c).set(id, (c.get(id) ?? 0) + 1));
  };

  const openCreate = () => {
    setStoryEmoji(EMOJIS[0]);
    setStoryCaption("");
    setStoryGradient(STORY_GRADIENTS[0]);
    setCreateOpen(true);
  };

  const publishStory = async () => {
    if (posting) return;
    setPosting(true);
    await createMoment(storyEmoji, storyCaption.trim() || undefined, storyGradient);
    setPosting(false);
    setCreateOpen(false);
    load();
  };

  return (
    <div className="py-3">
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4">
        {/* Your story */}
        <button className="flex flex-col items-center gap-1.5 shrink-0" onClick={openCreate}>
          <div className="relative">
            <Avatar user={profile ?? { id: "me", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" }} size={60} />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full nova-gradient text-white flex items-center justify-center border-2 border-surface">
              <Plus size={12} strokeWidth={3} />
            </span>
          </div>
          <span className="text-xs font-bold">Your story</span>
        </button>
        {moments.map((m) => {
          const seen = viewedIds.has(m.id);
          const views = viewCounts.get(m.id) ?? 0;
          return (
            <button key={m.id} className="flex flex-col items-center gap-1.5 shrink-0" onClick={() => setActive(m)}>
              <div className={`rounded-full p-[3px] ${seen ? "bg-surface2 border border-line" : ""}`} style={seen ? undefined : { background: m.gradient }}>
                <div className="w-[54px] h-[54px] rounded-full bg-surface flex items-center justify-center text-2xl">
                  {m.emoji}
                </div>
              </div>
              <span className="text-xs font-bold max-w-[64px] truncate">{m.user.name.split(" ")[0]}</span>
              {views > 0 && (
                <span className="text-[10px] text-muted -mt-1 flex items-center gap-0.5">
                  <Eye size={9} /> {views}
                </span>
              )}
            </button>
          );
        })}
        {moments.length === 0 && (
          <p className="self-center text-xs text-muted pl-2">No stories yet — add yours ✨</p>
        )}
      </div>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Add to your story">
        {/* Preview */}
        <div
          className="h-44 rounded-2xl flex flex-col items-center justify-center mb-4"
          style={{ background: storyGradient }}
        >
          <span className="text-7xl drop-shadow-lg select-none">{storyEmoji}</span>
          {storyCaption.trim() && (
            <p className="mt-2 text-white font-semibold text-sm text-center px-6 drop-shadow">{storyCaption.trim()}</p>
          )}
        </div>

        <p className="text-xs font-bold text-muted mb-2">Pick an emoji</p>
        <EmojiGrid onPick={setStoryEmoji} active={storyEmoji} />

        <input
          value={storyCaption}
          onChange={(e) => setStoryCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          maxLength={80}
          className="mt-4 w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40"
        />

        <p className="text-xs font-bold text-muted mt-4 mb-2">Background</p>
        <div className="flex gap-2">
          {STORY_GRADIENTS.map((g) => (
            <button
              key={g}
              onClick={() => setStoryGradient(g)}
              className={`w-12 h-12 rounded-2xl transition-transform ${storyGradient === g ? "ring-2 ring-nova-purple ring-offset-2 ring-offset-surface scale-105" : "hover:scale-105"}`}
              style={{ background: g }}
              aria-label="Choose background"
            />
          ))}
        </div>

        <button
          onClick={() => void publishStory()}
          disabled={posting}
          className="mt-5 w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {posting ? "Sharing…" : "Share story · expires in 24h"}
        </button>
      </BottomSheet>

      {active && (
        <MomentViewer
          moment={active}
          viewCount={viewCounts.get(active.id) ?? 0}
          onViewed={() => markViewed(active.id)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function MomentViewer({
  moment, viewCount, onViewed, onClose,
}: {
  moment: Moment;
  viewCount: number;
  onViewed: () => void;
  onClose: () => void;
}) {
  const [replies, setReplies] = useState<MomentReply[] | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const viewedRef = useRef(false);

  // Record the view once per open and load replies.
  useEffect(() => {
    if (!viewedRef.current) {
      viewedRef.current = true;
      void recordMomentView(moment.id);
      onViewed();
    }
    let live = true;
    void fetchMomentReplies(moment.id).then((r) => { if (live) setReplies(r); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment.id]);

  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    await addMomentReply(moment.id, text);
    setReplyText("");
    setSending(false);
    setReplies(await fetchMomentReplies(moment.id));
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col"
      style={{ background: moment.gradient }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      <div className="relative flex items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <Avatar user={moment.user} size={36} />
          <div>
            <p className="font-bold text-white text-sm drop-shadow">{moment.user.name}</p>
            <p className="text-white/70 text-xs">@{moment.user.handle} · just now</p>
          </div>
        </div>
        <button className="w-9 h-9 rounded-full bg-black/30 text-white flex items-center justify-center" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="relative flex-1 flex flex-col items-center justify-center px-8">
        <span className="text-[9rem] drop-shadow-2xl select-none">{moment.emoji}</span>
        {moment.caption && (
          <p className="mt-4 text-white font-semibold text-lg text-center drop-shadow">{moment.caption}</p>
        )}
      </div>

      {/* Replies + engagement bar */}
      <div className="relative px-4 pb-6" onClick={(e) => e.stopPropagation()}>
        {replies && replies.length > 0 && (
          <div className="max-h-36 overflow-y-auto no-scrollbar mb-2 space-y-1.5">
            {replies.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Avatar
                  user={{
                    id: r.author.id, name: r.author.name, handle: r.author.handle,
                    avatarColor: r.author.avatarColor, avatarEmoji: r.author.avatarEmoji,
                  }}
                  size={22}
                />
                <p className="text-white/90 text-xs bg-black/25 rounded-full px-3 py-1.5">
                  <b>{r.author.name.split(" ")[0]}</b> {r.text}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-white/70 text-xs shrink-0 px-1">
            <span className="flex items-center gap-1"><Eye size={13} /> {viewCount}</span>
            <span className="flex items-center gap-1"><MessageCircle size={13} /> {replies?.length ?? 0}</span>
          </div>
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendReply(); }}
            placeholder="Reply to this story…"
            maxLength={280}
            className="flex-1 bg-black/30 backdrop-blur rounded-full px-4 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:ring-2 ring-white/40"
          />
          <button
            onClick={() => void sendReply()}
            disabled={!replyText.trim() || sending}
            className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center disabled:opacity-40 shrink-0"
            aria-label="Send reply"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-white/50 text-xs pt-2">Expires in 24h · tap outside to close</p>
      </div>
    </div>
  );
}
