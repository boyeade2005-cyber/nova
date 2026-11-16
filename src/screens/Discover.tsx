import { useEffect, useState } from "react";
import { Search, TrendingUp, UserPlus, Radio, Eye, Check } from "lucide-react";
import { Avatar, VerifiedBadge } from "../components/Avatar";
import { LiveScreen } from "./Live";
import { fetchLiveStreams, getSuggestedProfiles, fetchCommunities, fetchFeedPosts, followUser } from "../lib/api";
import type { LiveStream, User } from "../data/mock";

function mapUser(p: any): User {
  return {
    id: p?.id ?? "unknown",
    name: p?.display_name ?? p?.username ?? "Unknown",
    handle: p?.username ?? "unknown",
    avatarColor: p?.avatar_color ?? "#FF6B00",
    avatarEmoji: p?.avatar_emoji ?? "🦊",
    bio: p?.bio ?? undefined,
    location: p?.location ?? undefined,
    verified: p?.is_verified,
  };
}

export function toLiveStream(s: any): LiveStream {
  return {
    id: s.id,
    host: mapUser(s.host),
    title: s.title,
    viewers: s.viewer_count ?? 0,
    gradient: s.gradient ?? "linear-gradient(135deg,#FF6B00,#FF2A5F)",
    emoji: s.emoji ?? "📡",
    category: s.category ?? "Live",
    isLive: s.is_live ?? true,
    scheduledAt: s.scheduled_at ?? undefined,
    communityId: s.community_id ?? undefined,
    communityName: s.community?.name ?? undefined,
    country: s.country ?? undefined,
  };
}

export function DiscoverScreen({ onCommunities }: { onCommunities?: () => void }) {
  const [query, setQuery] = useState("");
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [trending, setTrending] = useState<{ tag: string; posts: number }[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [liveIdx, setLiveIdx] = useState<number | null>(null);

  useEffect(() => {
    void fetchLiveStreams().then((s) => setStreams(s.map(toLiveStream)));
    void getSuggestedProfiles(8).then(setPeople);
    void fetchCommunities().then((c) => setComms(c.slice(0, 4)));
    void fetchFeedPosts().then((posts) => {
      const counts = new Map<string, number>();
      for (const p of posts) for (const t of p.topics) counts.set(t, (counts.get(t) ?? 0) + 1);
      setTrending([...counts.entries()].map(([tag, posts]) => ({ tag, posts })).sort((a, b) => b.posts - a.posts).slice(0, 6));
    });
  }, []);

  const toggleFollow = async (id: string) => {
    const now = !following[id];
    setFollowing((f) => ({ ...f, [id]: now }));
    await followUser(id, now);
  };

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-heading font-extrabold text-2xl mb-3">Discover</h1>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, posts, communities…"
            className="w-full bg-surface2 rounded-full pl-11 pr-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40"
          />
        </div>
      </div>

      {/* Live now */}
      <section className="mt-4">
        <h2 className="px-4 font-heading font-bold text-sm flex items-center gap-1.5 text-muted uppercase tracking-wide">
          <Radio size={15} className="text-coral" /> Live now
        </h2>
        {streams.length === 0 ? (
          <p className="px-4 mt-3 text-sm text-muted">No one is live right now — be the first. 🔴</p>
        ) : (
          <div className="mt-2 flex gap-3 overflow-x-auto no-scrollbar px-4">
            {streams.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setLiveIdx(i)}
                className="w-44 shrink-0 rounded-2xl overflow-hidden text-left relative"
                style={{ background: l.gradient, aspectRatio: "9/14" }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl opacity-80">{l.emoji}</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-coral text-white text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </span>
                <div className="absolute bottom-0 inset-x-0 p-2.5 text-white">
                  <p className="font-bold text-xs truncate">{l.title}</p>
                  <p className="text-[10px] text-white/80 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-0.5"><Eye size={10} /> {l.viewers >= 1000 ? `${(l.viewers / 1000).toFixed(1)}k` : l.viewers}</span>
                    <span>{l.host.name.split(" ")[0]}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trending */}
      <section className="mt-4">
        <h2 className="px-4 font-heading font-bold text-sm flex items-center gap-1.5 text-muted uppercase tracking-wide">
          <TrendingUp size={15} /> Trending now
        </h2>
        {trending.length === 0 ? (
          <p className="px-4 mt-3 text-sm text-muted">Trends will appear as the world posts. 🌍</p>
        ) : (
          <div className="mt-2 space-y-1 px-2">
            {trending.map((t, i) => (
              <div key={t.tag} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl">
                <span className="font-heading font-extrabold text-lg w-6 text-muted">{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-bold text-sm">#{t.tag}</span>
                  <span className="block text-xs text-muted">{t.posts} post{t.posts === 1 ? "" : "s"}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* People to follow */}
      <section className="mt-4">
        <h2 className="px-4 font-heading font-bold text-sm text-muted uppercase tracking-wide">People to follow</h2>
        <div className="mt-2 px-2 space-y-1">
          {people.map((p) => {
            const u = mapUser(p);
            return (
              <div key={u.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl">
                <Avatar user={u} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm truncate">{u.name}</span>
                    {u.verified && <VerifiedBadge />}
                  </div>
                  <div className="text-xs text-muted truncate">@{u.handle} · {u.location ?? "Earth"}</div>
                </div>
                <button
                  onClick={() => toggleFollow(u.id)}
                  className={`h-9 px-4 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                    following[u.id] ? "bg-surface2 text-muted border border-line" : "nova-gradient text-white"
                  }`}
                >
                  {following[u.id] ? <><Check size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Communities */}
      <section className="mt-4">
        <div className="px-4 flex items-center justify-between">
          <h2 className="font-heading font-bold text-sm text-muted uppercase tracking-wide">Communities</h2>
          {onCommunities && (
            <button onClick={onCommunities} className="text-xs font-bold text-nova-purple">See all →</button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 px-3">
          {comms.map((c) => (
            <button key={c.id} onClick={onCommunities} className="card p-4 text-left hover:border-nova-purple/40 transition-colors">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl mb-2" style={{ background: c.gradient ?? "var(--gradient-nova)" }}>
                {c.emoji ?? "🌐"}
              </div>
              <p className="font-bold text-sm leading-tight">{c.name}</p>
              <p className="text-xs text-muted mt-0.5">{c.members_count ?? 0} members</p>
            </button>
          ))}
        </div>
      </section>

      {liveIdx !== null && streams[liveIdx] && (
        <LiveScreen
          stream={streams[liveIdx]}
          onClose={() => setLiveIdx(null)}
          onNext={streams.length > 1 ? () => setLiveIdx((i) => ((i ?? 0) + 1) % streams.length) : undefined}
        />
      )}
    </div>
  );
}
