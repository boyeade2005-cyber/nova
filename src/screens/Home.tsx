import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, MapPin, Globe, UserCheck, Sparkles } from "lucide-react";
import { makeLocalPost, type Post, type ReactionType, type User, type MediaItem } from "../data/mock";
import { MomentsRow } from "../components/MomentsRow";
import { Composer } from "../components/Composer";
import { PostCard } from "../components/PostCard";
import { CustomizeFeedSheet } from "../components/CustomizeFeedSheet";
import { fetchFeedPosts, createRemotePost, subscribeToPosts, setReaction, toggleSave } from "../lib/api";
import { fetchFollowingIds, OPEN_POST_EVENT } from "../lib/profiles";
import { useSession } from "../lib/useSession";

type FeedTab = "following" | "local" | "global";

const dailyPrompts = [
  "What's one good thing that happened today?",
  "Share a tiny win — however small.",
  "Who made your day better this week?",
  "Drop your current hyperfixation.",
  "One thing you're grateful for right now.",
];

function DailyPrompt({ onPost }: { onPost: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const prompt = dailyPrompts[new Date().getDate() % dailyPrompts.length];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="card mx-3 sm:mx-0 mb-4 p-4 w-[calc(100%-1.5rem)] sm:w-full flex items-center gap-3 text-left hover:border-nova-purple/40 transition-colors"
      >
        <span className="w-10 h-10 rounded-xl nova-gradient flex items-center justify-center text-white shrink-0">
          <Sparkles size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-xs font-bold text-muted">DAILY NOVA</span>
          <span className="block font-bold text-sm mt-0.5">{prompt}</span>
        </span>
        <span className="text-nova-purple font-bold text-sm">Answer →</span>
      </button>
    );
  }

  return (
    <div className="card mx-3 sm:mx-0 mb-4 p-4">
      <p className="text-xs font-bold text-muted mb-2 flex items-center gap-1.5"><Sparkles size={12} className="text-nova-purple" /> DAILY NOVA</p>
      <p className="font-heading font-bold mb-3">{prompt}</p>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Share something kind…"
        className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={() => { setOpen(false); setText(""); }} className="h-9 px-4 rounded-full text-sm font-bold text-muted hover:bg-surface2">Skip</button>
        <button
          onClick={() => { if (text.trim()) { onPost(text.trim()); setText(""); setOpen(false); } }}
          disabled={!text.trim()}
          className="h-9 px-5 rounded-full nova-gradient text-white text-sm font-bold disabled:opacity-40"
        >
          Share
        </button>
      </div>
    </div>
  );
}

export function HomeScreen({
  posts,
  setPosts,
  onGoLive,
  focusPost,
}: {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  onGoLive?: () => void;
  /** Deep-link target: scroll to and highlight this post when it (re)appears. */
  focusPost?: { id: string; n: number } | null;
}) {
  const [feedTab, setFeedTab] = useState<FeedTab>("following");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [eventFocusId, setEventFocusId] = useState<string | null>(null);
  const { profile } = useSession();
  const me: User = profile ?? { id: "me", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };

  useEffect(() => {
    void fetchFollowingIds().then(setFollowingIds);
  }, []);

  // Live open-post requests (notifications, shares, other screens)
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ id?: string; pulse?: boolean }>).detail;
      if (d?.id && !d.pulse) {
        setEventFocusId(d.id);
        setFeedTab("global"); // make sure the target post is actually rendered
      }
    };
    window.addEventListener(OPEN_POST_EVENT, handler);
    return () => window.removeEventListener(OPEN_POST_EVENT, handler);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchFeedPosts().then((remote) => {
      if (!alive || remote.length === 0) return;
      setPosts((ps) => {
        const ids = new Set(ps.map((p) => p.id));
        const fresh = remote.filter((p) => !ids.has(p.id));
        return fresh.length ? [...fresh, ...ps] : ps;
      });
    });
    return () => { alive = false; };
  }, [setPosts]);

  useEffect(() => {
    const refresh = () => {
      fetchFeedPosts().then((remote) => {
        if (remote.length === 0) return;
        setPosts((ps) => {
          const ids = new Set(ps.map((p) => p.id));
          const fresh = remote.filter((p) => !ids.has(p.id));
          return fresh.length ? [...fresh, ...ps] : ps;
        });
      });
    };
    const unsub = subscribeToPosts(refresh);
    return unsub;
  }, [setPosts]);

  const filtered = useMemo(() => {
    const feed = posts.filter((p) => !p.communityId);
    if (feedTab === "local") {
      const myCountry = me.country && me.country !== "Global" ? me.country : null;
      if (!myCountry) return feed.filter((p) => p.location);
      return feed.filter((p) => p.country === myCountry || (!p.country && p.location?.toLowerCase().includes(myCountry.toLowerCase())));
    }
    if (feedTab === "global") return [...feed].reverse();
    // "following": only posts by people the current user follows
    if (feedTab === "following") {
      if (!followingIds) return feed; // still resolving follows — show feed briefly
      return feed.filter((p) => followingIds.has(p.author.id));
    }
    return feed;
  }, [posts, feedTab, me.country, followingIds]);

  // A deep-linked post may belong to someone we don't follow — show Global.
  useEffect(() => {
    if (focusPost) setFeedTab("global");
  }, [focusPost]);

  // Scroll to + highlight a deep-linked post once it exists in the DOM.
  const focusId = focusPost?.id ?? eventFocusId;
  useEffect(() => {
    if (!focusId) return;
    let tries = 0;
    const scroll = () => {
      const el = document.getElementById(`nova-post-${focusId}`);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-nova-purple", "rounded-2xl");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-nova-purple", "rounded-2xl"), 2600);
      return true;
    };
    if (scroll()) return;
    const t = window.setInterval(() => {
      tries += 1;
      if (scroll() || tries > 25) window.clearInterval(t);
    }, 400);
    return () => window.clearInterval(t);
  }, [focusId, posts]);

  const react = (postId: string, r: ReactionType) => {
    const post = posts.find((p) => p.id === postId);
    const final = post?.myReaction === r ? null : r;
    void setReaction(postId, final);
    setPosts((ps) =>
      ps.map((p) => {
        if (p.id !== postId) return p;
        const reactions = { ...p.reactions };
        const was = p.myReaction;
        if (was) reactions[was] = Math.max(0, reactions[was] - 1);
        if (was === r) return { ...p, reactions, myReaction: null };
        reactions[r] += 1;
        return { ...p, reactions, myReaction: r };
      })
    );
  };

  const save = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    void toggleSave(postId, !post?.saved);
    setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)));
  };

  const addPost = (text: string, media?: { kind: "photo" | "video" | "audio"; url: string }[]) => {
    const mediaItems: MediaItem[] | undefined = media?.length
      ? media.map((m) => ({
          kind: m.kind, url: m.url,
          gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)",
          emoji: m.kind === "video" ? "🎬" : "📷",
        }))
      : undefined;
    void createRemotePost(text, [], media).then((id) => {
      if (!id) return;
      setPosts((ps) => ps.some((p) => p.id === id) ? ps : [makeLocalPost(me, text, id, mediaItems), ...ps]);
    });
  };

  const feedTabs: { id: FeedTab; label: string; icon: typeof UserCheck }[] = [
    { id: "following", label: "Following", icon: UserCheck },
    { id: "local", label: "Local", icon: MapPin },
    { id: "global", label: "Global", icon: Globe },
  ];

  return (
    <div>
      {/* Moments — Facebook-style stories row */}
      <div className="bg-surface border-b border-line">
        <MomentsRow />
      </div>

      {/* Composer */}
      <div className="pt-4">
        <Composer onPost={addPost} onLive={onGoLive} />
      </div>

      {/* Daily Nova prompt */}
      <DailyPrompt onPost={(text) => addPost(`✨ Daily Nova — ${text}`)} />

      {/* Feed tabs */}
      <div className="flex items-center gap-2 px-3 sm:px-0 mb-3">
        <div className="flex flex-1 bg-surface2 rounded-full p-1">
          {feedTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFeedTab(t.id)}
              className={`flex-1 h-8 rounded-full text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
                feedTab === t.id ? "bg-surface text-ink shadow-sm" : "text-muted"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCustomizeOpen(true)}
          className="h-10 px-4 rounded-full border border-line font-bold text-sm text-nova-purple flex items-center gap-1.5 hover:bg-surface2 transition-colors shrink-0"
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Customize</span>
        </button>
      </div>

      {/* Feed */}
      <div className="pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-3">🌍</p>
            <p className="font-bold">Nothing here yet</p>
            <p className="text-sm mt-1">Try another feed tab or follow more people.</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} id={`nova-post-${p.id}`}>
              <PostCard post={p} onReact={react} onSave={save} />
            </div>
          ))
        )}
      </div>

      <CustomizeFeedSheet
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        sliders={sliders}
        onChange={(topic, value) => setSliders((s) => ({ ...s, [topic]: value }))}
        onReset={() => setSliders({})}
      />
    </div>
  );
}
