import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, MessageCircle, UserCheck, UserPlus } from "lucide-react";
import { Avatar, VerifiedBadge } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import {
  fetchPublicProfile, openDMConversation, NAV_EVENT,
  type PublicProfileData,
} from "../lib/profiles";
import { followUser, setReaction, toggleSave } from "../lib/api";
import type { Post, ReactionType } from "../data/mock";

/**
 * Public profile view for any user (opened via ?u=, nova:open-profile,
 * notification taps, Discover/Pulse taps, etc.).
 */
export function UserProfileScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageNote, setMessageNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchPublicProfile(userId).then((d) => {
      if (!alive) return;
      setData(d);
      setPosts(d?.posts ?? []);
      setFollowing(d?.isFollowing ?? false);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId]);

  const toggleFollow = () => {
    const now = !following;
    setFollowing(now);
    void followUser(userId, now).then(() => {
      // refresh stats (followers count) without a full reload flash
      void fetchPublicProfile(userId).then((d) => {
        if (d) setData((prev) => (prev ? { ...prev, stats: d.stats, isFollowing: d.isFollowing } : prev));
      });
    });
  };

  const message = () => {
    void openDMConversation(userId).then((convoId) => {
      if (!convoId) {
        setMessageNote("Couldn't start a conversation right now.");
        setTimeout(() => setMessageNote(null), 4000);
        return;
      }
      // Inbox picks up the stashed convo id on mount; jump there live too.
      window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { tab: "inbox" } }));
      setMessageNote("Opening Whispers…");
      setTimeout(() => setMessageNote(null), 3000);
    });
  };

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

  const u = data?.user;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-extrabold text-lg leading-tight truncate">{u?.name ?? "Profile"}</p>
          <p className="text-xs text-muted">{posts.length} post{posts.length === 1 ? "" : "s"}</p>
        </div>
      </div>

      {loading ? (
        <div className="px-4 pt-2 space-y-3">
          <div className="skeleton h-32 rounded-3xl" />
          <div className="flex gap-3">
            <div className="skeleton w-16 h-16 rounded-full -mt-8" />
            <div className="skeleton h-9 w-28 rounded-full mt-2" />
          </div>
          <div className="skeleton h-4 w-40 rounded-full" />
          <div className="skeleton h-4 w-56 rounded-full" />
        </div>
      ) : !u ? (
        <div className="text-center py-20 text-muted px-6">
          <p className="text-4xl mb-3">🦊</p>
          <p className="font-bold text-ink">Profile not found</p>
          <p className="text-sm mt-1">This person may have left Nova.</p>
        </div>
      ) : (
        <>
          {/* Cover */}
          <div className="h-28 nova-gradient mx-3 sm:mx-0 rounded-3xl" />

          <div className="px-4 -mt-8">
            <div className="flex items-end justify-between">
              <Avatar user={u} size={80} ring />
              <div className="flex gap-2 pb-1">
                <button
                  onClick={message}
                  className="h-9 px-4 rounded-full bg-surface2 border border-line text-sm font-bold flex items-center gap-1.5"
                >
                  <MessageCircle size={14} /> Message
                </button>
                <button
                  onClick={toggleFollow}
                  className={`h-9 px-4 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                    following ? "bg-surface2 border border-line text-muted" : "nova-gradient text-white"
                  }`}
                >
                  {following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
                </button>
              </div>
            </div>

            <h1 className="font-heading font-extrabold text-xl mt-3 flex items-center gap-1.5">
              {u.name}
              {u.verified && <VerifiedBadge size={18} />}
            </h1>
            <p className="text-sm text-muted">@{u.handle}</p>
            {u.bio && <p className="text-sm mt-2">{u.bio}</p>}
            {u.location && (
              <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
                <MapPin size={12} /> {u.location}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div><p className="font-heading font-extrabold text-lg leading-none">{data!.stats.posts}</p><p className="text-xs text-muted">Posts</p></div>
              <div><p className="font-heading font-extrabold text-lg leading-none">{data!.stats.followers}</p><p className="text-xs text-muted">Followers</p></div>
              <div><p className="font-heading font-extrabold text-lg leading-none">{data!.stats.following}</p><p className="text-xs text-muted">Following</p></div>
            </div>

            {messageNote && <p className="text-xs text-nova-purple font-bold mt-3">{messageNote}</p>}
          </div>

          {/* Posts */}
          <div className="mt-4">
            {posts.length === 0 ? (
              <div className="text-center py-14 text-muted">
                <p className="text-4xl mb-2">📭</p>
                <p className="font-bold text-ink">No posts yet</p>
                <p className="text-sm mt-1">When {u.name.split(" ")[0]} posts, it'll show up here.</p>
              </div>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} onReact={react} onSave={save} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
