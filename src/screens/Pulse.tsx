import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, Music, Radio, HandCoins, Send, Check } from "lucide-react";
import { type PulseVideo, type User } from "../data/mock";
import { Avatar } from "../components/Avatar";
import { BottomSheet } from "../components/BottomSheet";
import { LiveScreen } from "./Live";
import { GiftSheet } from "../components/GiftSheet";
import { fetchPulseVideos, fetchLiveStreams, togglePulseLike, fetchMyPulseLikes } from "../lib/api";
import { fetchPulseComments, addPulseComment, subscribeToPulseComments, shareLink, type PulseComment } from "../lib/socialExtra";
import { toLiveStream } from "./Discover";
import type { LiveStream } from "../data/mock";

function mapUser(p: any): User {
  return {
    id: p?.id ?? "unknown",
    name: p?.display_name ?? p?.username ?? "Unknown",
    handle: p?.username ?? "unknown",
    avatarColor: p?.avatar_color ?? "#FF6B00",
    avatarEmoji: p?.avatar_emoji ?? "🦊",
    verified: p?.is_verified,
  };
}

interface RemotePulse extends PulseVideo {
  videoUrl?: string;
}

function PulseCommentsSheet({ pulseId, onClose }: { pulseId: string; onClose: () => void }) {
  const [comments, setComments] = useState<PulseComment[]>([]);
  const [text, setText] = useState("");

  const load = useCallback(() => { void fetchPulseComments(pulseId).then(setComments); }, [pulseId]);
  useEffect(load, [load]);
  useEffect(() => subscribeToPulseComments(pulseId, load), [pulseId, load]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await addPulseComment(pulseId, t);
    load();
  };

  return (
    <BottomSheet open onClose={onClose} title={`Comments · ${comments.length}`}>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar">
        {comments.length === 0 && (
          <p className="text-sm text-muted text-center py-6">No comments yet — be the first 💬</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <Avatar user={c.author} size={32} />
            <div className="flex-1">
              <div className="bg-surface2 rounded-2xl rounded-tl-md px-3 py-2">
                <span className="font-bold text-xs">{c.author.name}</span>
                <span className="text-[10px] text-muted ml-1.5">{c.time}</span>
                <p className="text-sm mt-0.5">{c.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center mt-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder="Add a comment…"
          className="flex-1 bg-surface2 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 ring-nova-purple/40"
        />
        <button
          onClick={() => void send()}
          disabled={!text.trim()}
          className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          aria-label="Send comment"
        >
          <Send size={16} />
        </button>
      </div>
    </BottomSheet>
  );
}

function PulseCard({ v, likedByMe, onLike }: { v: RemotePulse; likedByMe: boolean; onLike: (id: string, like: boolean) => void }) {
  const [liked, setLiked] = useState(likedByMe);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(v.likes);
  const [giftOpen, setGiftOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (shareTimer.current) clearTimeout(shareTimer.current); }, []);

  const share = async () => {
    const result = await shareLink({
      title: `${v.creator.name} on Nova Pulse`,
      text: v.caption || "Check this Pulse ⚡",
      url: `${window.location.origin}/?pulse=${v.id}`,
    });
    if (result === "failed") return;
    setShared(true);
    if (shareTimer.current) clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShared(false), 2000);
  };

  const toggleLike = () => {
    const now = !liked;
    setLiked(now);
    setLikes((l) => l + (now ? 1 : -1));
    onLike(v.id, now);
  };

  return (
    <div className="relative w-full h-full snap-start snap-always overflow-hidden bg-nova-black">
      {/* Video area */}
      {v.videoUrl ? (
        <video src={v.videoUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: v.gradient }}>
          <span className="text-[10rem] drop-shadow-2xl opacity-80 select-none">{v.emoji}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4">
        <span className="px-3 py-1 rounded-full bg-coral text-white text-xs font-extrabold tracking-widest">PULSE</span>
        <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur text-white text-xs font-bold flex items-center gap-1">
          <Radio size={12} className="text-hot-pink" /> live
        </span>
      </div>

      {/* Right action rail */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur ${liked ? "bg-coral" : "bg-black/30"} transition-transform active:scale-90`}>
            <Heart size={22} className="text-white" fill={liked ? "currentColor" : "none"} />
          </span>
          <span className="text-white text-xs font-bold drop-shadow">{likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}</span>
        </button>
        <button onClick={() => setCommentsOpen(true)} className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
            <MessageCircle size={22} className="text-white" />
          </span>
          <span className="text-white text-xs font-bold drop-shadow">{v.comments}</span>
        </button>
        <button onClick={() => void share()} className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
            {shared ? <Check size={22} className="text-emerald-400" /> : <Share2 size={22} className="text-white" />}
          </span>
          <span className="text-white text-xs font-bold drop-shadow">{shared ? "Copied" : v.shares}</span>
        </button>
        <button onClick={() => setSaved(!saved)} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur ${saved ? "bg-nova-purple" : "bg-black/30"} transition-transform active:scale-90`}>
            <Bookmark size={22} className="text-white" fill={saved ? "currentColor" : "none"} />
          </span>
          <span className="text-white text-xs font-bold drop-shadow">Save</span>
        </button>
        <button onClick={() => setGiftOpen(true)} className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full nova-gradient flex items-center justify-center shadow-lg shadow-hot-pink/50">
            <HandCoins size={22} className="text-white" />
          </span>
          <span className="text-white text-xs font-bold drop-shadow">Tip</span>
        </button>
      </div>
      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} onSend={() => {}} tipTo={v.creator.id} />
      {commentsOpen && <PulseCommentsSheet pulseId={v.id} onClose={() => setCommentsOpen(false)} />}

      {/* Bottom info */}
      <div className="absolute left-4 right-20 bottom-6 text-white">
        <div className="flex items-center gap-2.5 mb-2">
          <Avatar user={v.creator} size={36} />
          <div>
            <p className="font-bold text-sm drop-shadow">@{v.creator.handle}</p>
            <p className="text-xs text-white/80">{v.creator.location ?? "Nova"}</p>
          </div>
        </div>
        <p className="text-sm font-semibold drop-shadow line-clamp-2">{v.caption}</p>
        <div className="mt-2 flex items-center gap-1.5 text-xs bg-black/30 backdrop-blur rounded-full px-3 py-1.5 w-fit">
          <Music size={12} className="text-hot-pink animate-pulse" />
          <span className="truncate max-w-[200px]">{v.music}</span>
        </div>
      </div>
    </div>
  );
}

export function PulseScreen() {
  const [videos, setVideos] = useState<RemotePulse[]>([]);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveIdx, setLiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  useEffect(() => {
    void Promise.all([fetchPulseVideos(), fetchLiveStreams(), fetchMyPulseLikes()]).then(([vs, ss, likes]) => {
      setVideos(vs.map((v: any) => ({
        id: v.id,
        creator: mapUser(v.creator),
        caption: v.caption ?? "",
        gradient: v.gradient ?? "linear-gradient(180deg,#FF6B00,#FF2A5F)",
        emoji: v.emoji ?? "🎬",
        videoUrl: v.video_url ?? undefined,
        likes: v.likes ?? 0,
        comments: v.comments_count ?? 0,
        shares: v.shares ?? 0,
        tips: 0,
        music: "Original sound",
      })));
      setStreams(ss.map(toLiveStream));
      setMyLikes(likes);
      setLoading(false);
    });
  }, []);

  const handleLike = (id: string, like: boolean) => {
    void togglePulseLike(id, like);
    setMyLikes((s) => {
      const n = new Set(s);
      if (like) n.add(id); else n.delete(id);
      return n;
    });
  };

  if (loading) {
    return <div className="h-[calc(100vh-4rem)] md:h-screen bg-nova-black flex items-center justify-center"><div className="skeleton w-40 h-72 rounded-3xl" /></div>;
  }

  if (videos.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] md:h-screen bg-nova-black flex flex-col items-center justify-center text-white/60 px-8 text-center">
        <span className="text-6xl mb-4">🎬</span>
        <p className="font-heading font-bold text-xl text-white">Pulse is quiet… for now</p>
        <p className="text-sm mt-2">The first videos will appear here. Record yours from the Create orb.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen snap-y snap-mandatory overflow-y-auto no-scrollbar bg-nova-black relative">
      {streams.length > 0 && (
        <button
          onClick={() => { setLiveIdx(0); setLiveOpen(true); }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-coral text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-lg shadow-coral/50"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {streams.length} LIVE NOW — tap to watch
        </button>
      )}
      {videos.map((v) => (
        <PulseCard key={v.id} v={v} likedByMe={myLikes.has(v.id)} onLike={handleLike} />
      ))}
      {liveOpen && streams[liveIdx] && (
        <LiveScreen
          stream={streams[liveIdx]}
          onClose={() => setLiveOpen(false)}
          onNext={streams.length > 1 ? () => setLiveIdx((i) => (i + 1) % streams.length) : undefined}
        />
      )}
    </div>
  );
}
