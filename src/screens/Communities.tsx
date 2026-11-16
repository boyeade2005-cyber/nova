import { useEffect, useRef, useState } from "react";
import { Plus, Users, CalendarDays, BookOpen, Shield, Send, MessageCircle, Radio, Lock, MapPin, Link2, Paperclip, Check, Trash2, ExternalLink, HelpCircle, XCircle, UsersRound } from "lucide-react";
import { BottomSheet } from "../components/BottomSheet";
import { Avatar } from "../components/Avatar";
import { PostCard } from "../components/PostCard";
import { LiveScreen } from "./Live";
import {
  fetchCommunities, fetchCommunityMembers, fetchMyCommunities, joinCommunity, createCommunity,
  fetchCommunityPosts, createRemotePost, fetchCommunityConversation,
  fetchMessages, sendMessage, subscribeToMessages, setReaction, toggleSave, uploadMedia,
} from "../lib/api";
import {
  fetchCommunityEvents, createCommunityEvent, rsvpEvent, deleteCommunityEvent,
  fetchCommunityResources, addCommunityResource, deleteCommunityResource, fetchMyMembership,
  type CommunityEvent, type CommunityResource, type RsvpStatus,
} from "../lib/communityExtra";
import { useSession } from "../lib/useSession";
import type { Post, ReactionType, User } from "../data/mock";

const tabs = ["Feed", "Chat", "Events", "Resources", "Members"] as const;
const fallbackUser: User = { id: "", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };

export function CommunitiesScreen() {
  const { profile } = useSession();
  const me = profile ?? fallbackUser;
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Feed");
  const [createOpen, setCreateOpen] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<Post[]>([]);
  const [postText, setPostText] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [eventSheet, setEventSheet] = useState(false);
  const [resourceSheet, setResourceSheet] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([fetchCommunities(), fetchMyCommunities()]).then(([comms, mine]) => {
      setList(comms);
      setJoinedIds(new Set(mine.map((c) => c.id)));
      setLoading(false);
    });
  };
  useEffect(load, []);

  const toggleJoin = async (id: string) => {
    const was = joinedIds.has(id);
    setJoinedIds((s) => { const n = new Set(s); was ? n.delete(id) : n.add(id); return n; });
    await joinCommunity(id, !was);
    if (selected?.id === id) {
      setPosts([]);
      void fetchCommunityPosts(id, selected.name).then(setPosts);
    }
  };

  const openCommunity = (c: any) => {
    setSelected(c);
    setTab("Feed");
    setMembers([]);
    setPosts([]);
    setPostText("");
    setEvents([]);
    setResources([]);
    setMyRole(null);
    void fetchCommunityPosts(c.id, c.name).then(setPosts);
  };

  const memberCount = (c: any) => c.members_count ?? c.members?.[0]?.count ?? 0;
  const isJoined = selected ? joinedIds.has(selected.id) : false;

  const postToGroup = async () => {
    const t = postText.trim();
    if (!t || !selected) return;
    setPostText("");
    const id = await createRemotePost(t, [], undefined, selected.id);
    if (id) {
      const optimistic: Post = {
        id, author: me, time: "now", text: t, topics: [],
        reactions: { like: 0, love: 0, laugh: 0, wow: 0, support: 0 },
        comments: [], shares: 0, saves: 0, community: selected.name, communityId: selected.id,
        whySeeing: `Posted in ${selected.name}`,
      };
      setPosts((ps) => [optimistic, ...ps]);
    }
  };

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

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading font-extrabold text-2xl">Groups</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center shadow-md shadow-hot-pink/30 active:scale-95 transition-transform"
          aria-label="Create group"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {loading ? (
        <div className="px-3 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-muted px-6">
          <p className="text-4xl mb-2">🏘️</p>
          <p className="font-bold text-ink">No groups yet</p>
          <p className="text-sm mt-1">Create the first one — tap + above.</p>
        </div>
      ) : (
        <div className="px-3 space-y-3">
          {list.map((c) => {
            const joined = joinedIds.has(c.id);
            return (
              <button key={c.id} onClick={() => openCommunity(c)} className="card w-full p-4 text-left hover:border-nova-purple/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0" style={{ background: c.gradient ?? "var(--gradient-nova)" }}>
                    {c.emoji ?? "🌐"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold flex items-center gap-1.5">
                      {c.name}
                      {c.is_private && <Lock size={12} className="text-muted" />}
                    </p>
                    <p className="text-sm text-muted line-clamp-2 mt-0.5">{c.description}</p>
                    <p className="text-xs text-muted mt-1.5 font-semibold">
                      👥 {memberCount(c) >= 1000 ? `${(memberCount(c) / 1000).toFixed(1)}k` : memberCount(c)} members · {c.category}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggleJoin(c.id); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), toggleJoin(c.id))}
                    className={`h-9 px-4 rounded-full text-sm font-bold shrink-0 flex items-center ${
                      joined ? "bg-surface2 text-muted border border-line" : "nova-gradient text-white"
                    }`}
                  >
                    {joined ? "Joined" : "Join"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div>
            <div className="h-28 rounded-2xl mb-4 flex items-center justify-center text-5xl relative" style={{ background: selected.gradient ?? "var(--gradient-nova)" }}>
              {selected.emoji ?? "🌐"}
              {selected.is_private && (
                <span className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/40 text-white text-[10px] font-bold flex items-center gap-1">
                  <Lock size={10} /> Private
                </span>
              )}
            </div>
            <p className="text-sm text-muted mb-4">{selected.description}</p>
            <div className="flex gap-2 mb-4">
              {tabs.map((t) => {
                const icons = { Feed: Users, Chat: MessageCircle, Events: CalendarDays, Resources: BookOpen, Members: Shield } as const;
                const Icon = icons[t];
                return (
                  <button
                    key={t}
                    onClick={async () => {
                      setTab(t);
                      if (t === "Members") setMembers(await fetchCommunityMembers(selected.id));
                      if (t === "Events") {
                        void fetchCommunityEvents(selected.id).then(setEvents);
                        void fetchMyMembership(selected.id).then(setMyRole);
                      }
                      if (t === "Resources") {
                        void fetchCommunityResources(selected.id).then(setResources);
                        void fetchMyMembership(selected.id).then(setMyRole);
                      }
                    }}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1 ${
                      tab === t ? "nova-gradient text-white" : "bg-surface2 text-muted"
                    }`}
                  >
                    <Icon size={13} /> {t}
                  </button>
                );
              })}
            </div>

            {tab === "Feed" && (
              <div>
                {isJoined && (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void postToGroup()}
                      placeholder={`Post to ${selected.name}…`}
                      className="flex-1 bg-surface2 rounded-full px-4 h-10 text-sm outline-none focus:ring-2 ring-nova-purple/40"
                    />
                    <button onClick={() => void postToGroup()} disabled={!postText.trim()} className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center disabled:opacity-40" aria-label="Post">
                      <Send size={15} />
                    </button>
                  </div>
                )}
                {posts.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">
                    <p className="text-3xl mb-2">💬</p>
                    {isJoined ? "No posts yet — start the conversation." : "Join the group to see and post."}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[45vh] overflow-y-auto">
                    {posts.map((p) => <PostCard key={p.id} post={p} onReact={react} onSave={save} />)}
                  </div>
                )}
              </div>
            )}

            {tab === "Chat" && (
              isJoined ? (
                <GroupChat communityId={selected.id} communityName={selected.name} me={me} />
              ) : (
                <div className="text-center py-8 text-muted text-sm">
                  <p className="text-3xl mb-2">🔒</p>
                  Join the group to access group chat.
                </div>
              )
            )}

            {tab === "Events" && (
              <EventsTab
                events={events}
                communityId={selected.id}
                communityName={selected.name}
                canCreate={isJoined && (myRole === "owner" || myRole === "admin")}
                canRsvp={isJoined}
                myId={me.id}
                myRole={myRole}
                onCreate={() => setEventSheet(true)}
                onChanged={() => void fetchCommunityEvents(selected.id).then(setEvents)}
              />
            )}
            {tab === "Resources" && (
              <ResourcesTab
                resources={resources}
                communityId={selected.id}
                canAdd={isJoined}
                canDelete={(r) => r.uploaded_by === me.id || myRole === "owner" || myRole === "admin"}
                onAdd={() => setResourceSheet(true)}
                onChanged={() => void fetchCommunityResources(selected.id).then(setResources)}
              />
            )}
            {tab === "Members" && (
              <div className="space-y-2 text-sm">
                <p className="text-muted text-xs">Members ({memberCount(selected)})</p>
                {members.length === 0 ? (
                  <p className="text-muted">Tap Members to load the list…</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <Avatar user={{ id: m.id, name: m.display_name ?? m.username, handle: m.username, avatarColor: m.avatar_color, avatarEmoji: m.avatar_emoji, verified: m.is_verified }} size={30} />
                      <span className="font-bold text-sm">{m.display_name ?? m.username}</span>
                      {m.role !== "member" && <span className="text-[10px] font-extrabold text-nova-purple uppercase">{m.role}</span>}
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => toggleJoin(selected.id)}
                className={`flex-1 h-11 rounded-2xl font-bold text-sm ${
                  isJoined ? "bg-surface2 text-muted border border-line" : "nova-gradient text-white"
                }`}
              >
                {isJoined ? "Leave group" : `Join ${selected.name}`}
              </button>
              {isJoined && (
                <button
                  onClick={() => setLiveOpen(true)}
                  className="h-11 px-4 rounded-2xl bg-coral/15 text-coral font-bold text-sm flex items-center gap-1.5"
                >
                  <Radio size={15} /> Voice room
                </button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Create a group">
        <CreateCommunityForm
          onDone={() => { setCreateOpen(false); load(); }}
        />
      </BottomSheet>

      <BottomSheet open={eventSheet} onClose={() => setEventSheet(false)} title="Create event">
        <EventForm
          communityId={selected?.id ?? ""}
          onDone={() => {
            setEventSheet(false);
            if (selected) void fetchCommunityEvents(selected.id).then(setEvents);
          }}
        />
      </BottomSheet>

      <BottomSheet open={resourceSheet} onClose={() => setResourceSheet(false)} title="Add resource">
        <ResourceForm
          communityId={selected?.id ?? ""}
          onDone={() => {
            setResourceSheet(false);
            if (selected) void fetchCommunityResources(selected.id).then(setResources);
          }}
        />
      </BottomSheet>

      {liveOpen && selected && me.id && (
        <LiveScreen host={me} communityId={selected.id} onClose={() => setLiveOpen(false)} />
      )}
    </div>
  );
}

/** Real-time group chat backed by the community's linked conversation. */
function GroupChat({ communityId, communityName, me }: { communityId: string; communityName: string; me: User }) {
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCommunityConversation(communityId).then(async (id) => {
      if (!alive || !id) return;
      setConvoId(id);
      const msgs = await fetchMessages(id);
      if (alive) setMessages(msgs);
    });
    return () => { alive = false; };
  }, [communityId]);

  useEffect(() => {
    if (!convoId) return;
    const load = () => void fetchMessages(convoId).then(setMessages);
    const unsub = subscribeToMessages(convoId, load);
    return unsub;
  }, [convoId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || !convoId) return;
    setText("");
    await sendMessage(convoId, t);
  };

  return (
    <div className="flex flex-col h-[50vh]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && <p className="text-center text-xs text-muted py-8">No messages yet — say hi to {communityName}! 👋</p>}
        {messages.map((m) => {
          const mine = m.sender_id === me.id;
          const sender = m.sender ?? {};
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <Avatar user={{ id: sender.id ?? "?", name: sender.display_name ?? sender.username ?? "?", handle: sender.username ?? "?", avatarColor: sender.avatar_color, avatarEmoji: sender.avatar_emoji }} size={26} />
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "nova-gradient text-white rounded-br-md" : "bg-surface2 rounded-bl-md"}`}>
                {!mine && <p className="text-[10px] font-extrabold text-nova-purple mb-0.5">{sender.display_name ?? sender.username}</p>}
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={`Message ${communityName}…`}
          className="flex-1 bg-surface2 rounded-full px-4 h-10 text-sm outline-none focus:ring-2 ring-nova-purple/40"
        />
        <button onClick={() => void send()} disabled={!text.trim()} className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center disabled:opacity-40" aria-label="Send">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

function CreateCommunityForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emoji, setEmoji] = useState("🌐");
  const [category, setCategory] = useState("Tech");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await createCommunity(name.trim(), desc.trim() || "A new Nova group.", category, emoji, isPrivate);
    setBusy(false);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4) || "🌐")}
          className="w-16 h-14 bg-surface2 rounded-2xl text-2xl text-center outline-none focus:ring-2 ring-nova-purple/40"
          aria-label="Group emoji"
        />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className="flex-1 bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's it about?" rows={3} className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none" />
      <div className="flex flex-wrap gap-2">
        {["Tech", "Arts", "Sports", "Music", "Faith", "Food", "Health"].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full ${category === c ? "nova-gradient text-white" : "bg-surface2 text-muted"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <button
        onClick={() => setIsPrivate((p) => !p)}
        className={`w-full h-11 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border transition-colors ${isPrivate ? "border-nova-purple/50 text-nova-purple bg-nova-lilac dark:bg-white/5" : "border-line text-muted"}`}
      >
        <Lock size={15} /> {isPrivate ? "Private group — posts & chat members-only" : "Public group — anyone can join"}
      </button>
      <button onClick={submit} disabled={!name.trim() || busy} className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40">
        {busy ? "Creating…" : "Create group"}
      </button>
    </div>
  );
}

// ============================================================
// Events & Resources tabs
// ============================================================

function formatEventDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

const rsvpOptions: { status: RsvpStatus; label: string; icon: typeof Check; active: string }[] = [
  { status: "going", label: "Going", icon: Check, active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40" },
  { status: "maybe", label: "Maybe", icon: HelpCircle, active: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  { status: "cant_go", label: "Can't go", icon: XCircle, active: "bg-surface2 text-muted border-line" },
];

function EventsTab({
  events, canCreate, canRsvp, myRole, onCreate, onChanged,
}: {
  events: CommunityEvent[];
  communityId: string;
  communityName: string;
  canCreate: boolean;
  canRsvp: boolean;
  myId: string;
  myRole: string | null;
  onCreate: () => void;
  onChanged: () => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now).reverse();
  const canManage = () => myRole === "owner" || myRole === "admin";

  const rsvp = async (e: CommunityEvent, status: RsvpStatus) => {
    const next = e.my_rsvp === status ? null : status;
    await rsvpEvent(e.id, next);
    onChanged();
  };

  const remove = async (e: CommunityEvent) => {
    await deleteCommunityEvent(e.id);
    onChanged();
  };

  const renderEvent = (e: CommunityEvent) => {
    const { day, time } = formatEventDate(e.starts_at);
    const isPast = new Date(e.starts_at).getTime() < now;
    return (
      <div key={e.id} className={`card p-3.5 ${isPast ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface2 flex items-center justify-center text-2xl shrink-0">
            {e.emoji || "📅"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm leading-tight">{e.title}</p>
            <p className="text-xs text-muted mt-0.5">
              {day} · {time}
              {e.ends_at && ` – ${new Date(e.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
            </p>
            {e.location && (
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><MapPin size={11} /> {e.location}</p>
            )}
            {e.description && <p className="text-xs text-muted mt-1 line-clamp-2">{e.description}</p>}
            <p className="text-xs font-semibold text-nova-purple mt-1.5 flex items-center gap-1">
              <UsersRound size={12} /> {e.rsvp_counts.going} going
              {e.rsvp_counts.maybe > 0 && ` · ${e.rsvp_counts.maybe} maybe`}
            </p>
          </div>
          {canManage() && (
            <button onClick={() => void remove(e)} className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center text-muted hover:text-coral shrink-0" aria-label="Delete event">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {!isPast && canRsvp && (
          <div className="flex gap-1.5 mt-3">
            {rsvpOptions.map(({ status, label, icon: Icon, active }) => {
              const on = e.my_rsvp === status;
              return (
                <button
                  key={status}
                  onClick={() => void rsvp(e, status)}
                  className={`flex-1 h-8 rounded-full text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors ${
                    on ? active : "bg-surface2 text-muted border-line"
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-wide">Upcoming</p>
        {canCreate && (
          <button onClick={onCreate} className="h-8 px-3 rounded-full nova-gradient text-white text-xs font-bold flex items-center gap-1">
            <Plus size={13} strokeWidth={2.5} /> Create event
          </button>
        )}
      </div>
      {events.length === 0 ? (
        <div className="text-center py-6 text-muted text-sm">
          <p className="text-3xl mb-2">📅</p>
          No events scheduled yet{canCreate ? " — create the first one!" : "."}
        </div>
      ) : (
        <>
          {upcoming.length === 0 && <p className="text-xs text-muted text-center py-2">Nothing scheduled — check back soon.</p>}
          <div className="space-y-2.5">{upcoming.map(renderEvent)}</div>
          {past.length > 0 && (
            <div>
              <button onClick={() => setShowPast((s) => !s)} className="text-xs font-bold text-muted w-full text-center py-2">
                {showPast ? "Hide past events" : `Past events (${past.length})`}
              </button>
              {showPast && <div className="space-y-2.5">{past.map(renderEvent)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const eventEmojis = ["📅", "🎉", "🏃", "🎵", "🍕", "📚", "🧘", "⚽", "🎨", "💻", "🧗", "🎬"];

function EventForm({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [emoji, setEmoji] = useState("📅");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !startsAt) return;
    setBusy(true);
    await createCommunityEvent(communityId, {
      title: title.trim(),
      description: desc.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      location: location.trim(),
      emoji,
    });
    setBusy(false);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <div className="w-14 h-14 rounded-2xl bg-surface2 flex items-center justify-center text-2xl shrink-0">
          {emoji}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="flex-1 bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {eventEmojis.map((em) => (
          <button
            key={em}
            onClick={() => setEmoji(em)}
            className={`h-9 rounded-xl text-xl flex items-center justify-center transition-transform ${emoji === em ? "bg-nova-lilac dark:bg-white/10 scale-110" : "bg-surface2 hover:scale-105"}`}
          >
            {em}
          </button>
        ))}
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's happening? (optional)" rows={2} className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none" />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold text-muted uppercase">Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full bg-surface2 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-muted uppercase">Ends (optional)</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full bg-surface2 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
        </label>
      </div>
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      <button onClick={() => void submit()} disabled={!title.trim() || !startsAt || busy} className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40">
        {busy ? "Creating…" : "Create event"}
      </button>
    </div>
  );
}

function ResourcesTab({
  resources, canAdd, canDelete, onAdd, onChanged,
}: {
  resources: CommunityResource[];
  communityId: string;
  canAdd: boolean;
  canDelete: (r: CommunityResource) => boolean;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const remove = async (r: CommunityResource) => {
    await deleteCommunityResource(r.id);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-wide">Shared resources</p>
        {canAdd && (
          <button onClick={onAdd} className="h-8 px-3 rounded-full nova-gradient text-white text-xs font-bold flex items-center gap-1">
            <Plus size={13} strokeWidth={2.5} /> Add resource
          </button>
        )}
      </div>
      {resources.length === 0 ? (
        <div className="text-center py-6 text-muted text-sm">
          <p className="text-3xl mb-2">📚</p>
          No resources shared yet{canAdd ? " — add the first one!" : "."}
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((r) => {
            const href = r.kind === "file" ? r.file_url : r.url;
            const Icon = r.kind === "file" ? Paperclip : Link2;
            return (
              <div key={r.id} className="card p-3 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-nova-lilac dark:bg-white/10 text-nova-purple flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="font-bold text-sm flex items-center gap-1 hover:text-nova-purple transition-colors">
                      <span className="truncate">{r.title}</span>
                      <ExternalLink size={12} className="shrink-0 text-muted" />
                    </a>
                  ) : (
                    <p className="font-bold text-sm truncate">{r.title}</p>
                  )}
                  {r.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{r.description}</p>}
                  <p className="text-[10px] font-bold text-muted uppercase mt-1">{r.kind === "file" ? "File" : "Link"}</p>
                </div>
                {canDelete(r) && (
                  <button onClick={() => void remove(r)} className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center text-muted hover:text-coral shrink-0" aria-label="Delete resource">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResourceForm({ communityId, onDone }: { communityId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const pickFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setFileUrl(null);
    setBusy(true);
    const url = await uploadMedia(f);
    setFileUrl(url);
    setBusy(false);
    if (!url) setFileName("");
  };

  const submit = async () => {
    if (!title.trim()) return;
    if (kind === "link" && !url.trim()) return;
    if (kind === "file" && !fileUrl) return;
    setBusy(true);
    await addCommunityResource(communityId, {
      title: title.trim(),
      description: desc.trim(),
      kind,
      url: kind === "link" ? url.trim() : undefined,
      file_url: kind === "file" ? fileUrl ?? undefined : undefined,
    });
    setBusy(false);
    onDone();
  };

  const ready = title.trim() && (kind === "link" ? url.trim() : !!fileUrl) && !busy;

  return (
    <div className="space-y-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none" />
      <div className="flex gap-2">
        {(["link", "file"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-colors ${
              kind === k ? "nova-gradient text-white border-transparent" : "bg-surface2 text-muted border-line"
            }`}
          >
            {k === "link" ? <Link2 size={14} /> : <Paperclip size={14} />}
            {k === "link" ? "Link" : "File"}
          </button>
        ))}
      </div>
      {kind === "link" ? (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
      ) : (
        <label className="flex items-center gap-3 bg-surface2 rounded-2xl px-4 py-3 cursor-pointer">
          <Paperclip size={16} className="text-muted shrink-0" />
          <span className="text-sm text-muted truncate flex-1">
            {busy ? "Uploading…" : fileName || "Choose a file to upload"}
          </span>
          <input type="file" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      <button onClick={() => void submit()} disabled={!ready} className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40">
        {busy ? "Saving…" : "Add resource"}
      </button>
    </div>
  );
}
