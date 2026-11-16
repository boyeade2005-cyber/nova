import { useEffect, useState } from "react";
import { BadgeCheck, MapPin, Pencil, Settings, Moon, Sun, LogOut, Share2, QrCode, Lock, LayoutGrid, Rows3, Users, Wallet, BarChart3, Trash2, Check, MessageCircle } from "lucide-react";
import { type ReactionType, type Post, type User } from "../data/mock";
import { Avatar } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import { BottomSheet } from "../components/BottomSheet";
import { QRCodeImage } from "../components/QRCode";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { fetchUserPosts, fetchPulseVideos, fetchWallet, fetchMyCommunities, getProfile, updateProfile, setReaction, toggleSave, fetchCreatorStats, type CreatorStats } from "../lib/api";
import {
  fetchBadgeState, fetchHighlights, addHighlight, deleteHighlight,
  ensureDM, fetchProfileMeta, DM_EVENT, DM_STORAGE_KEY,
  type BadgeState, type ProfileHighlight,
} from "../lib/profileExtra";

const profileTabs = ["Posts", "Pulse", "Portfolio", "Communities", "About"] as const;

const NO_BADGES: BadgeState = {
  communityGrower: false, topCreator: false, globetrotter: false,
  weekWarrior: false, voiceStar: false, earlyAdopter: false,
};

const HIGHLIGHT_EMOJIS = ["✨", "✈️", "🍲", "💻", "🦊", "🎧", "📸", "🏆", "🌱", "🎬", "🙏", "⚽", "📚", "🎨", "💼", "🌍"];

const fallbackUser: User = { id: "", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };

export function ProfileScreen({ dark, onToggleTheme, onSettings, onCommunities, onWallet }: { dark: boolean; onToggleTheme: () => void; onSettings: () => void; onCommunities?: () => void; onWallet?: () => void }) {
  const { profile, loading } = useSession();
  const me = profile ?? fallbackUser;
  const [tab, setTab] = useState<(typeof profileTabs)[number]>("Posts");
  const [view, setView] = useState<"list" | "grid">("list");
  const [posts, setPosts] = useState<Post[]>([]);
  const [pulseVideos, setPulseVideos] = useState<any[]>([]);
  const [myCommunities, setMyCommunities] = useState<any[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [full, setFull] = useState<any>(null);
  const [meta, setMeta] = useState<{ created_at: string | null; country: string | null; region: string | null }>({ created_at: null, country: null, region: null });
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [badges, setBadges] = useState<BadgeState>(NO_BADGES);
  const [highlightsList, setHighlightsList] = useState<ProfileHighlight[]>([]);
  const [highlightSheet, setHighlightSheet] = useState<"new" | ProfileHighlight | null>(null);
  const [newEmoji, setNewEmoji] = useState("✨");
  const [newTitle, setNewTitle] = useState("");
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dmNotice, setDmNotice] = useState<string | null>(null);

  const profileUrl = `${window.location.origin}/?u=${me.handle || "you"}`;

  useEffect(() => {
    if (!profile) return;
    void fetchUserPosts(profile.id).then(setPosts);
    void fetchPulseVideos().then((v) => setPulseVideos(v.filter((x) => x.creator_id === profile.id || x.creator?.id === profile.id)));
    void fetchWallet().then(setWallet);
    void fetchMyCommunities().then(setMyCommunities);
    void getProfile(profile.id).then(setFull);
    void fetchProfileMeta().then(setMeta);
    void fetchHighlights().then(setHighlightsList);
  }, [profile]);

  // badges depend on communities + gravity, which load async
  useEffect(() => {
    if (!profile) return;
    void fetchBadgeState(myCommunities.length, full?.gravity_score ?? 0).then(setBadges);
  }, [profile, myCommunities.length, full?.gravity_score]);

  const react = (postId: string, r: ReactionType) => {
    const post = posts.find((p) => p.id === postId);
    void setReaction(postId, post?.myReaction === r ? null : r);
    setPosts((ps) => ps.map((p) => {
      if (p.id !== postId) return p;
      const reactions = { ...p.reactions };
      if (p.myReaction) reactions[p.myReaction] = Math.max(0, reactions[p.myReaction] - 1);
      if (p.myReaction === r) return { ...p, reactions, myReaction: null };
      reactions[r] += 1;
      return { ...p, reactions, myReaction: r };
    }));
  };
  const save = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    void toggleSave(postId, !post?.saved);
    setPosts((ps) => ps.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p)));
  };

  const editBio = async () => {
    const bio = window.prompt("Your bio", full?.bio ?? "");
    if (bio === null) return;
    await updateProfile({ bio });
    setFull((f: any) => ({ ...f, bio }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const shareProfile = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${me.name} on Nova`, text: `Check out ${me.name}'s profile on Nova`, url: profileUrl });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(profileUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy your profile link", profileUrl);
    }
  };

  const messageMe = async () => {
    if (!profile) return;
    const convoId = await ensureDM(profile.id);
    if (!convoId) {
      setDmNotice("Couldn't start a conversation right now.");
      return;
    }
    // let Inbox auto-open this conversation whenever it next mounts
    try {
      localStorage.setItem(DM_STORAGE_KEY, convoId);
      window.dispatchEvent(new CustomEvent(DM_EVENT, { detail: { conversationId: convoId } }));
    } catch { /* storage unavailable */ }
    setDmNotice("Conversation ready — open Whispers (Inbox) to chat.");
    setTimeout(() => setDmNotice(null), 4000);
  };

  const saveHighlight = async () => {
    setSavingHighlight(true);
    const h = await addHighlight(newEmoji, newTitle);
    setSavingHighlight(false);
    if (h) {
      setHighlightsList((hs) => [...hs, h]);
      setHighlightSheet(null);
      setNewTitle("");
      setNewEmoji("✨");
    }
  };

  const removeHighlight = async (h: ProfileHighlight) => {
    await deleteHighlight(h.id);
    setHighlightsList((hs) => hs.filter((x) => x.id !== h.id));
    setHighlightSheet(null);
  };

  const followers = full?.followers_count ?? 0;
  const following = full?.following_count ?? 0;
  const gravity = full?.gravity_score ?? 0;

  const badgeDefs: { key: keyof BadgeState; e: string; label: string }[] = [
    { key: "weekWarrior", e: "🔥", label: "Week Warrior" },
    { key: "voiceStar", e: "🎙️", label: "Voice Star" },
    { key: "communityGrower", e: "🌱", label: "Community Grower" },
    { key: "earlyAdopter", e: "⚡", label: "Early Adopter" },
    { key: "topCreator", e: "👑", label: "Top Creator" },
    { key: "globetrotter", e: "🌍", label: "Globetrotter" },
  ];

  return (
    <div className="pb-24">
      {/* Cover */}
      <div className="h-32 nova-gradient relative">
        <button onClick={onSettings} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center" aria-label="Settings">
          <Settings size={18} />
        </button>
        <button onClick={onToggleTheme} className="absolute top-3 right-14 w-9 h-9 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center" aria-label="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="px-4 -mt-10">
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton w-20 h-20 rounded-full" />
            <div className="skeleton h-6 w-48 rounded-full" />
            <div className="skeleton h-4 w-32 rounded-full" />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-bg overflow-hidden">
                  <Avatar user={me} size={72} />
                </div>
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-[3px] border-bg" />
              </div>
              <div className="flex gap-2 pb-1">
                <button onClick={editBio} className="h-9 px-4 rounded-full bg-surface2 border border-line text-sm font-bold flex items-center gap-1.5">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={messageMe} className="h-9 px-4 rounded-full bg-surface2 border border-line text-sm font-bold flex items-center gap-1.5">
                  <MessageCircle size={14} /> Message
                </button>
              </div>
            </div>

            <h1 className="font-heading font-extrabold text-xl mt-3 flex items-center gap-1.5">
              {me.name}
              {me.verified && <BadgeCheck size={18} className="text-nova-purple" fill="currentColor" />}
            </h1>
            <p className="text-sm text-muted">@{me.handle}</p>
            {full?.bio && <p className="text-sm mt-2">{full.bio}</p>}
            {(full?.location || me.location) && (
              <p className="text-xs text-muted mt-1.5 flex items-center gap-1"><MapPin size={12} /> {full?.location ?? me.location}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-3">
              {(me.interests ?? []).map((i: string) => (
                <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full bg-nova-lilac dark:bg-white/10 text-nova-purple">{i}</span>
              ))}
            </div>

            <div className="flex gap-6 mt-4 text-sm">
              <span><b>{posts.length}</b> <span className="text-muted">Posts</span></span>
              <span><b>{followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers}</b> <span className="text-muted">Followers</span></span>
              <span><b>{following >= 1000 ? `${(following / 1000).toFixed(1)}k` : following}</b> <span className="text-muted">Following</span></span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="card p-3.5 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl nova-gradient flex items-center justify-center text-white font-heading font-extrabold text-sm">★</span>
                <div>
                  <p className="font-heading font-extrabold text-lg leading-none">{gravity}</p>
                  <p className="text-[11px] text-muted font-semibold">Gravity Score</p>
                </div>
              </div>
              <button onClick={onWallet} className="card p-3.5 flex items-center gap-3 text-left hover:border-nova-purple/40 transition-colors">
                <span className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-nova-purple"><Wallet size={18} /></span>
                <div>
                  <p className="font-heading font-extrabold text-lg leading-none">{wallet ? wallet.balance.toLocaleString() : "—"}</p>
                  <p className="text-[11px] text-muted font-semibold">{wallet?.currency ?? "NOVA"} Credits · Wallet →</p>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Achievements — computed from live data */}
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Badges</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {badgeDefs.map((b) => {
              const got = badges[b.key];
              return (
                <div key={b.key} className={`shrink-0 w-[72px] rounded-2xl p-2.5 text-center border ${got ? "bg-surface2 border-line" : "bg-surface2/50 border-line opacity-50"}`}>
                  <span className="text-xl block">{b.e}</span>
                  <span className="text-[10px] font-bold block mt-1 leading-tight">{b.label}</span>
                  {!got && <Lock size={10} className="mx-auto mt-0.5 text-muted" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Share — real QR code for the live profile URL */}
        <button onClick={shareProfile} className="card mt-4 p-4 w-full flex items-center gap-4 text-left hover:border-nova-purple/40 transition-colors">
          <div className="w-16 h-16 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center border border-line">
            <QRCodeImage value={profileUrl} size={52} className="w-full h-full" />
          </div>
          <span className="flex-1">
            <span className="block font-heading font-bold text-sm flex items-center gap-1.5">
              <QrCode size={15} className="text-nova-purple" /> Share my profile
              {linkCopied && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5"><Check size={11} /> Link copied</span>}
            </span>
            <span className="block text-xs text-muted mt-0.5">Let friends scan to add you instantly</span>
          </span>
          <Share2 size={18} className="text-muted" />
        </button>

        {dmNotice && (
          <p className="mt-2 text-xs font-bold text-emerald-500 flex items-center gap-1.5 px-1">
            <MessageCircle size={13} /> {dmNotice}
          </p>
        )}

        {onCommunities && (
          <button onClick={onCommunities} className="card mt-3 p-3.5 w-full flex items-center gap-3 text-left hover:border-nova-purple/40 transition-colors">
            <span className="w-10 h-10 rounded-xl bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple">
              <Users size={18} />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-sm">My communities</span>
              <span className="block text-xs text-muted">
                {myCommunities.length ? myCommunities.map((c) => c.name).slice(0, 2).join(" · ") + (myCommunities.length > 2 ? ` +${myCommunities.length - 2}` : "") : "Join communities to see them here"}
              </span>
            </span>
            <span className="text-muted">→</span>
          </button>
        )}

        <button
          onClick={() => { setStatsOpen(true); void fetchCreatorStats().then(setStats); }}
          className="card mt-3 p-3.5 w-full flex items-center gap-3 text-left hover:border-nova-purple/40 transition-colors"
        >
          <span className="w-10 h-10 rounded-xl bg-nova-purple/15 flex items-center justify-center text-nova-purple">
            <BarChart3 size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-sm">Creator Studio</span>
            <span className="block text-xs text-muted">Views, reach, earnings & audience growth</span>
          </span>
          <span className="text-muted">→</span>
        </button>

        {/* Highlights — persisted per user */}
        <div className="flex gap-4 mt-4 overflow-x-auto no-scrollbar">
          {highlightsList.map((h) => (
            <button key={h.id} onClick={() => setHighlightSheet(h)} className="flex flex-col items-center gap-1 shrink-0">
              <div className="rounded-full p-[3px]" style={{ background: h.gradient }}>
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-2xl border-2 border-bg">{h.emoji}</div>
              </div>
              <span className="text-[10px] font-bold">{h.title}</span>
            </button>
          ))}
          <button onClick={() => setHighlightSheet("new")} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-line flex items-center justify-center text-muted text-2xl">+</div>
            <span className="text-[10px] font-bold text-muted">New</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b border-line overflow-x-auto no-scrollbar">
        <div className="flex px-2 min-w-max">
          {profileTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 h-11 text-sm font-bold border-b-2 transition-colors ${
                tab === t ? "border-nova-purple text-nova-purple" : "border-transparent text-muted"
              }`}
            >
              {t}
            </button>
          ))}
          {tab === "Posts" && (
            <div className="ml-auto flex items-center pr-2">
              <button onClick={() => setView(view === "list" ? "grid" : "list")} className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted" aria-label="Toggle view">
                {view === "list" ? <LayoutGrid size={17} /> : <Rows3 size={17} />}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pt-3 space-y-3">
        {tab === "Posts" && view === "grid" && (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.filter((p) => p.media?.length).map((p) => (
              <div key={p.id} className="aspect-square rounded-xl overflow-hidden relative" style={{ background: p.media?.[0]?.gradient ?? "var(--surface-2)" }}>
                {p.media?.[0]?.url ? (
                  <img src={p.media[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">{p.media?.[0]?.emoji ?? "📝"}</div>
                )}
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-white text-[10px] font-bold drop-shadow">
                  <span>❤️ {p.reactions.like + p.reactions.love}</span>
                </div>
              </div>
            ))}
            {posts.filter((p) => !p.media?.length).length > 0 && (
              <p className="col-span-3 text-center text-xs text-muted py-2">{posts.filter((p) => !p.media?.length).length} text post{posts.filter((p) => !p.media?.length).length > 1 ? "s" : ""} not shown in grid</p>
            )}
          </div>
        )}
        {tab === "Posts" && view === "list" &&
          (posts.length ? posts.map((p) => <PostCard key={p.id} post={p} onReact={react} onSave={save} />) : (
            <div className="card p-8 text-center text-muted">
              <p className="text-4xl mb-2">✨</p>
              <p className="font-bold text-ink">No posts yet</p>
              <p className="text-sm mt-1">Share your first post — the world is watching.</p>
            </div>
          ))}
        {tab === "Pulse" && (
          pulseVideos.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {pulseVideos.map((v) => (
                <div key={v.id} className="aspect-[3/4] rounded-xl relative overflow-hidden" style={{ background: v.gradient ?? "var(--surface-2)" }}>
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">{v.emoji ?? "🎬"}</div>
                  <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold text-white drop-shadow line-clamp-2">{v.caption}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-8 text-center text-muted">
              <p className="text-4xl mb-2">🎬</p>
              <p className="font-bold text-ink">No Pulse videos yet</p>
              <p className="text-sm mt-1">Record a short vertical video to appear here.</p>
            </div>
          )
        )}
        {tab === "Portfolio" && (
          <div className="grid grid-cols-3 gap-2">
            {posts.filter((p) => p.media?.length).slice(0, 6).map((p) => (
              <div key={p.id} className="aspect-square rounded-2xl overflow-hidden relative" style={{ background: p.media?.[0]?.gradient ?? "var(--surface-2)" }}>
                {p.media?.[0]?.url && <img src={p.media[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                {!p.media?.[0]?.url && <div className="absolute inset-0 flex items-center justify-center text-3xl">{p.media?.[0]?.emoji ?? "📝"}</div>}
              </div>
            ))}
            {posts.filter((p) => p.media?.length).length === 0 && (
              <p className="col-span-3 text-center text-xs text-muted py-6">Your portfolio fills up as you post photos & videos.</p>
            )}
          </div>
        )}
        {tab === "Communities" && (
          <div className="card p-5 text-center text-muted">
            <p className="text-3xl mb-2">🏘️</p>
            <p className="font-bold text-ink">Member of {myCommunities.length} communit{myCommunities.length === 1 ? "y" : "ies"}</p>
            <p className="text-sm mt-1">{myCommunities.map((c) => c.name).join(" · ") || "Join some to see them here"}</p>
          </div>
        )}
        {tab === "About" && (
          <div className="card p-5 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Joined</span><span className="font-bold">{meta.created_at ? new Date(meta.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted">Website</span><span className="font-bold text-nova-purple">{full?.website ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted">Region</span><span className="font-bold">{meta.country ?? "Global"}</span></div>
            <div className="flex justify-between"><span className="text-muted">Verified</span><span className="font-bold text-emerald-500">{me.verified ? "Authentic ✓" : "Not verified"}</span></div>
          </div>
        )}
      </div>

      <button onClick={signOut} className="mx-4 mt-6 w-[calc(100%-2rem)] h-11 rounded-2xl border border-line text-coral font-bold text-sm flex items-center justify-center gap-2">
        <LogOut size={16} /> Sign out
      </button>

      <BottomSheet open={statsOpen} onClose={() => setStatsOpen(false)} title="Creator Studio">
        {!stats ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Posts", value: stats.posts },
                { label: "Followers", value: stats.followers },
                { label: "Reactions received", value: stats.reactionsReceived },
                { label: "Comments received", value: stats.commentsReceived },
              ].map((s) => (
                <div key={s.label} className="card p-4">
                  <p className="font-heading font-extrabold text-2xl">{s.value.toLocaleString()}</p>
                  <p className="text-[11px] text-muted font-semibold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted font-semibold">NOVA balance</p>
                <p className="font-heading font-extrabold text-xl text-nova-purple">🪙 {Math.floor(stats.balance).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted font-semibold">Lifetime earned</p>
                <p className="font-heading font-extrabold text-xl text-emerald-500">+{Math.floor(stats.earned).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted text-center">Gifts & tips pay creators directly — 90% reaches you.</p>
          </div>
        )}
      </BottomSheet>

      {/* New highlight */}
      <BottomSheet open={highlightSheet === "new"} onClose={() => setHighlightSheet(null)} title="New highlight">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Emoji</p>
        <div className="grid grid-cols-8 gap-1.5">
          {HIGHLIGHT_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setNewEmoji(e)}
              className={`h-10 rounded-xl text-xl flex items-center justify-center border transition-colors ${newEmoji === e ? "nova-gradient border-transparent" : "border-line hover:border-nova-purple/40"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted mt-4 mb-2">Title</p>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && saveHighlight()}
          placeholder="e.g. Trips, Food, Work…"
          maxLength={20}
          className="w-full bg-surface2 rounded-xl px-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40"
        />
        <button
          onClick={saveHighlight}
          disabled={savingHighlight || !newTitle.trim()}
          className="mt-4 w-full h-11 rounded-xl nova-gradient text-white font-bold text-sm disabled:opacity-50"
        >
          {savingHighlight ? "Saving…" : "Create highlight"}
        </button>
      </BottomSheet>

      {/* Existing highlight — delete option */}
      <BottomSheet open={typeof highlightSheet === "object" && highlightSheet !== null} onClose={() => setHighlightSheet(null)} title={typeof highlightSheet === "object" && highlightSheet ? highlightSheet.title : ""}>
        {typeof highlightSheet === "object" && highlightSheet && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-full p-[3px]" style={{ background: highlightSheet.gradient }}>
              <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center text-4xl border-2 border-bg">{highlightSheet.emoji}</div>
            </div>
            <button onClick={() => removeHighlight(highlightSheet)} className="w-full h-11 rounded-xl border border-coral/40 text-coral font-bold text-sm flex items-center justify-center gap-2">
              <Trash2 size={15} /> Delete highlight
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
