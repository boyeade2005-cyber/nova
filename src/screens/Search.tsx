import { useEffect, useState } from "react";
import { Search, X, Users, FileText, UsersRound } from "lucide-react";
import { Avatar, VerifiedBadge } from "../components/Avatar";
import { searchProfiles, fetchCommunities, fetchFeedPosts, followUser } from "../lib/api";
import type { Post } from "../data/mock";

type Scope = "All" | "People" | "Communities" | "Posts";

const mapUser = (p: any) => ({
  id: p.id,
  name: p.display_name ?? p.username,
  handle: p.username,
  avatarColor: p.avatar_color ?? "#FF6B00",
  avatarEmoji: p.avatar_emoji ?? "🦊",
  verified: p.is_verified,
});

export function SearchScreen({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("All");
  const [people, setPeople] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [allComms, setAllComms] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void fetchCommunities().then(setAllComms);
    void fetchFeedPosts().then(setAllPosts);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim().toLowerCase();
      if (!q) { setPeople([]); setComms([]); setPosts([]); return; }
      void searchProfiles(query).then(setPeople);
      setComms(allComms.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6));
      setPosts(allPosts.filter((p) => p.text.toLowerCase().includes(q) || p.topics.some((tp) => tp.toLowerCase().includes(q))).slice(0, 6));
    }, 250);
    return () => clearTimeout(t);
  }, [query, allComms, allPosts]);

  const scopes: Scope[] = ["All", "People", "Communities", "Posts"];
  const empty = !query.trim() && scope === "All";
  const showPeople = scope === "All" || scope === "People";
  const showComms = scope === "All" || scope === "Communities";
  const showPosts = scope === "All" || scope === "Posts";

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, posts, communities…"
            className="w-full bg-surface2 rounded-full pl-11 pr-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40"
          />
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-muted" aria-label="Close search">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {scopes.map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 h-8 rounded-full text-xs font-bold whitespace-nowrap ${scope === s ? "nova-gradient text-white" : "bg-surface2 text-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {empty && (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-2">🔍</p>
            <p className="font-bold text-ink">Find your people</p>
            <p className="text-sm mt-1">Search creators, communities and posts — the whole world.</p>
          </div>
        )}

        {showPeople && people.length > 0 && (
          <section className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5"><Users size={13} /> People</h3>
            <div className="space-y-1">
              {people.map((p) => {
                const u = mapUser(p);
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl">
                    <Avatar user={u} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm flex items-center gap-1 truncate">{u.name} {u.verified && <VerifiedBadge />}</p>
                      <p className="text-xs text-muted truncate">@{u.handle} · {p.location ?? "Earth"}</p>
                    </div>
                    <button
                      onClick={() => {
                        const now = !following[u.id];
                        setFollowing((f) => ({ ...f, [u.id]: now }));
                        void followUser(u.id, now);
                      }}
                      className={`h-9 px-4 rounded-full text-sm font-bold ${following[u.id] ? "bg-surface2 text-muted border border-line" : "nova-gradient text-white"}`}
                    >
                      {following[u.id] ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {showComms && comms.length > 0 && (
          <section className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5"><UsersRound size={13} /> Communities</h3>
            <div className="grid grid-cols-2 gap-2">
              {comms.map((c) => (
                <div key={c.id} className="card p-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl mb-2" style={{ background: c.gradient ?? "var(--gradient-nova)" }}>{c.emoji ?? "🌐"}</div>
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs text-muted">{c.members_count ?? 0} members</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {showPosts && posts.length > 0 && (
          <section className="mb-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5"><FileText size={13} /> Posts</h3>
            <div className="space-y-1">
              {posts.map((p) => (
                <div key={p.id} className="px-3 py-2.5 rounded-2xl">
                  <p className="font-bold text-sm">{p.author.name}</p>
                  <p className="text-sm text-muted line-clamp-2 mt-0.5">{p.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {query.trim() && people.length + comms.length + posts.length === 0 && (
          <div className="text-center py-14 text-muted">
            <p className="text-4xl mb-2">🫥</p>
            <p className="font-bold text-ink">No results for "{query}"</p>
            <p className="text-sm mt-1">Try a different spelling or broaden your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
