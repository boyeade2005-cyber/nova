import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Moment, User } from "../data/mock";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { EmojiGrid } from "./EmojiPicker";
import { EMOJIS } from "../lib/socialExtra";
import { fetchMoments, createMoment } from "../lib/api";
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
  const [active, setActive] = useState<Moment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [storyEmoji, setStoryEmoji] = useState(EMOJIS[0]);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyGradient, setStoryGradient] = useState(STORY_GRADIENTS[0]);
  const [posting, setPosting] = useState(false);

  const load = () => {
    fetchMoments().then((rows) =>
      setMoments(
        rows
          .filter((m: any) => m.user_id !== profile?.id)
          .slice(0, 20)
          .map((m: any) => ({
            id: m.id,
            user: mapUser(m.user),
            gradient: m.gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
            emoji: m.emoji ?? "✨",
            caption: m.caption ?? undefined,
            viewed: false,
          }))
      )
    );
  };
  useEffect(load, [profile?.id]);

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
        {moments.map((m) => (
          <button key={m.id} className="flex flex-col items-center gap-1.5 shrink-0" onClick={() => setActive(m)}>
            <div className="rounded-full p-[3px]" style={{ background: m.gradient }}>
              <div className="w-[54px] h-[54px] rounded-full bg-surface flex items-center justify-center text-2xl">
                {m.emoji}
              </div>
            </div>
            <span className="text-xs font-bold max-w-[64px] truncate">{m.user.name.split(" ")[0]}</span>
          </button>
        ))}
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

      {active && <MomentViewer moment={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function MomentViewer({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

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
      <p className="relative text-center text-white/50 text-xs pb-8">Expires in 24h · tap to close</p>
    </div>
  );
}
