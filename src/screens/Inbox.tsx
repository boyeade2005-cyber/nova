import { useEffect, useRef, useState } from "react";
import {
  Search, Plus, Phone, Video, MoreVertical, Send, Bookmark,
  Megaphone, Lock, ArrowLeft, Check, CheckCheck, Image as ImageIcon, Smile,
} from "lucide-react";
import { Avatar } from "../components/Avatar";
import { VoiceRecorder, VoicePlay } from "../components/VoiceRecorder";
import { BottomSheet } from "../components/BottomSheet";
import { useSession } from "../lib/useSession";
import {
  fetchConversations, fetchMessages, sendMessage, sendVoiceMessage,
  subscribeToMessages, createDM, createChannelConversation, createSavedMessages,
  uploadMedia, saveMessageTranslation, markConversationRead,
  type RemoteConversation,
} from "../lib/api";
import { startCall } from "../lib/calls";
import { DM_EVENT, DM_STORAGE_KEY } from "../lib/profileExtra";
import { TranslateButton } from "../components/Translate";

function convoTitle(c: RemoteConversation): string {
  if (c.kind === "saved") return "Saved Messages";
  if (c.name) return c.name;
  if (c.otherUser) return c.otherUser.display_name ?? c.otherUser.username;
  return c.kind === "channel" ? "Channel" : "Chat";
}

function convoAvatar(c: RemoteConversation) {
  if (c.kind === "saved") return { id: "saved", name: "Saved", handle: "saved", avatarColor: "#FF6B00", avatarEmoji: "🔖" };
  if (c.kind === "channel") return { id: c.id, name: c.name ?? "Channel", handle: "channel", avatarColor: "#8B5CF6", avatarEmoji: "📢" };
  if (c.otherUser) return {
    id: c.otherUser.id,
    name: c.otherUser.display_name ?? c.otherUser.username,
    handle: c.otherUser.username,
    avatarColor: c.otherUser.avatar_color ?? "#FF6B00",
    avatarEmoji: c.otherUser.avatar_emoji ?? "🦊",
    verified: c.otherUser.is_verified,
  };
  return { id: c.id, name: "Chat", handle: "group", avatarColor: "#00C2D1", avatarEmoji: "👥" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function InboxScreen() {
  const { profile } = useSession();
  const [convos, setConvos] = useState<RemoteConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<RemoteConversation | null>(null);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [people, setPeople] = useState<any[]>([]);

  const load = () => {
    fetchConversations().then((c) => { setConvos(c); setLoading(false); });
  };
  useEffect(load, []);

  // Auto-open a conversation handed off from Profile's "Message" button
  useEffect(() => {
    const openById = async (convoId?: string) => {
      if (!convoId) return;
      const list = await fetchConversations();
      const found = list.find((c) => c.id === convoId);
      if (found) setActive(found);
    };
    try {
      const pending = localStorage.getItem(DM_STORAGE_KEY);
      if (pending) {
        localStorage.removeItem(DM_STORAGE_KEY);
        void openById(pending);
      }
    } catch { /* storage unavailable */ }
    const handler = (e: Event) => void openById((e as CustomEvent<{ conversationId?: string }>).detail?.conversationId);
    window.addEventListener(DM_EVENT, handler);
    return () => window.removeEventListener(DM_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!newOpen) return;
    // fetch suggested people for new chat
    import("../lib/api").then(({ getSuggestedProfiles }) =>
      getSuggestedProfiles(8).then(setPeople)
    );
  }, [newOpen]);

  const openChat = (c: RemoteConversation) => setActive(c);

  const filtered = convos.filter((c) => convoTitle(c).toLowerCase().includes(query.toLowerCase()));

  if (active) {
    return (
      <ChatView
        convo={active}
        me={profile}
        onBack={() => { setActive(null); load(); }}
      />
    );
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading font-extrabold text-2xl">Whispers</h1>
        <button onClick={() => setNewOpen(true)} className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center shadow-md shadow-hot-pink/30 press" aria-label="New chat">
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="px-4">
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats…" className="w-full bg-surface2 rounded-full pl-11 pr-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
        </div>
      </div>

      <div className="mt-3 divide-y divide-line/60">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 px-4 py-3.5">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-32 rounded-full" /><div className="skeleton h-3 w-48 rounded-full" /></div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted px-6">
            <p className="text-4xl mb-2">💬</p>
            <p className="font-bold text-ink">No conversations yet</p>
            <p className="text-sm mt-1">Tap + to message someone or start a channel.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const av = convoAvatar(c);
            const isChannel = c.kind === "channel";
            const isSaved = c.kind === "saved";
            return (
              <button key={c.id} onClick={() => openChat(c)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface2/60 transition-colors text-left">
                <div className="relative shrink-0">
                  <Avatar user={av} size={48} />
                  {isChannel && <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-nova-purple text-white flex items-center justify-center"><Megaphone size={10} /></span>}
                  {isSaved && <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-nova-purple text-white flex items-center justify-center"><Bookmark size={10} /></span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm truncate flex items-center gap-1">
                      {convoTitle(c)}
                      {c.kind === "secret" && <Lock size={11} className="text-muted" />}
                    </p>
                    <span className="text-[10px] text-muted font-semibold shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{c.lastMessage || (isChannel ? "Broadcast channel" : "Say hello 👋")}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <BottomSheet open={newOpen} onClose={() => setNewOpen(false)} title="New conversation">
        <div className="space-y-2">
          <button
            onClick={async () => {
              setNewOpen(false);
              const id = await createSavedMessages();
              if (id) {
                const convo: RemoteConversation = { id, kind: "saved", name: "Saved Messages", otherUser: null, lastMessage: "", lastMessageAt: null, unread: 0, members: 1 };
                setActive(convo);
              }
            }}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface2 hover:bg-surface2/70 transition-colors text-left"
          >
            <span className="w-11 h-11 rounded-full nova-gradient flex items-center justify-center text-white"><Bookmark size={18} /></span>
            <div><p className="font-bold text-sm">Saved Messages</p><p className="text-xs text-muted">Notes to self, files & links</p></div>
          </button>
          <button
            onClick={async () => {
              const name = window.prompt("Channel name");
              if (!name?.trim()) return;
              setNewOpen(false);
              const id = await createChannelConversation(name.trim());
              if (id) load();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-surface2 hover:bg-surface2/70 transition-colors text-left"
          >
            <span className="w-11 h-11 rounded-full bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple"><Megaphone size={18} /></span>
            <div><p className="font-bold text-sm">New channel</p><p className="text-xs text-muted">Broadcast to everyone on Nova</p></div>
          </button>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted pt-2">People</p>
          {people.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                setNewOpen(false);
                const id = await createDM(p.id);
                if (id) {
                  const convo: RemoteConversation = {
                    id, kind: "dm", name: null,
                    otherUser: p, lastMessage: "", lastMessageAt: null, unread: 0, members: 2,
                  };
                  setActive(convo);
                }
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface2 transition-colors text-left"
            >
              <Avatar user={{ id: p.id, name: p.display_name ?? p.username, handle: p.username, avatarColor: p.avatar_color, avatarEmoji: p.avatar_emoji, verified: p.is_verified }} size={42} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{p.display_name ?? p.username}</p>
                <p className="text-xs text-muted truncate">@{p.username} · {p.location ?? ""}</p>
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

function ChatView({ convo, me, onBack }: { convo: RemoteConversation; me: any; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMsgs = () => {
    fetchMessages(convo.id).then((m) => { setMessages(m); setLoading(false); });
  };
  useEffect(() => {
    loadMsgs();
    void markConversationRead(convo.id);
    const unsub = subscribeToMessages(convo.id, loadMsgs);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendMessage(convo.id, t);
  };

  const sendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadMedia(file);
    if (url) await sendMessage(convo.id, "📷 Photo", "image-once", url);
  };

  const title = convoTitle(convo);
  const av = convoAvatar(convo);

  return (
    <div className="flex flex-col h-[100dvh] bg-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-line bg-surface/80 backdrop-blur-lg shrink-0">
        <button onClick={onBack} className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <Avatar user={av} size={38} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate flex items-center gap-1">{title} {convo.kind === "secret" && <Lock size={11} className="text-muted" />}</p>
          <p className="text-[11px] text-emerald-500 font-bold">{convo.kind === "channel" ? `${convo.members} subscribers` : "online"}</p>
        </div>
        {convo.otherUser && convo.kind !== "channel" && convo.kind !== "saved" ? (
          <>
            <button
              onClick={() => void startCall(convo.otherUser!.id, "voice")}
              className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
              aria-label="Voice call"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => void startCall(convo.otherUser!.id, "video")}
              className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
              aria-label="Video call"
            >
              <Video size={19} />
            </button>
          </>
        ) : null}
        <button className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-muted" aria-label="More"><MoreVertical size={18} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className={`skeleton h-10 rounded-2xl ${i % 2 ? "ml-16" : "mr-16"}`} />)}</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-2">👋</p>
            <p className="font-bold text-ink">No messages yet</p>
            <p className="text-sm mt-1">Send the first one — be kind.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me?.id || (me == null && false);
            const sender = m.sender ?? {};
            const senderName = sender.display_name ?? sender.username ?? "Nova";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine && convo.kind !== "dm" && convo.kind !== "saved" && (
                    <span className="text-[10px] font-bold text-muted ml-2 mb-0.5">{senderName}</span>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      mine
                        ? "nova-gradient text-white rounded-br-md"
                        : "bg-surface2 rounded-bl-md"
                    }`}
                  >
                    {m.kind === "voice" && m.media_url ? (
                      <span className="flex flex-col gap-1.5">
                        <VoicePlay duration={m.text?.replace("Voice note · ", "") ?? "0:00"} src={m.media_url} small />
                        {m.transcript && (
                          <span className="text-xs opacity-90 italic">“{m.transcript}”</span>
                        )}
                        {m.transcript && (
                          <TranslateButton
                            text={m.transcript}
                            onTranslated={(lang, t) => void saveMessageTranslation(m.id, lang, t)}
                          />
                        )}
                      </span>
                    ) : m.kind === "image-once" && m.media_url ? (
                      <img src={m.media_url} alt="" className="rounded-xl max-w-[240px] max-h-64 object-cover" />
                    ) : m.emoji && !m.text ? (
                      <span className="text-3xl">{m.emoji}</span>
                    ) : (
                      m.text ?? ""
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-0.5 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="text-[9px] text-muted">{timeAgo(m.created_at)}</span>
                    {mine && (m.is_viewed_once ? <CheckCheck size={11} className="text-sky-400" /> : <Check size={11} className="text-muted" />)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-line bg-surface/60 backdrop-blur shrink-0">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={sendImage} />
        <div className="flex items-center gap-1.5">
          <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-full hover:bg-surface2 flex items-center justify-center text-muted shrink-0" aria-label="Send image">
            <ImageIcon size={19} />
          </button>
          <div className="flex-1 flex items-center bg-surface2 rounded-full px-4 min-h-10">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={convo.kind === "channel" ? "Broadcast to everyone…" : "Message…"}
              className="flex-1 bg-transparent text-sm outline-none py-2.5"
            />
            <button className="text-muted hover:text-nova-purple" aria-label="Emoji"><Smile size={18} /></button>
          </div>
          {text.trim() ? (
            <button onClick={send} className="w-10 h-10 rounded-full nova-gradient text-white flex items-center justify-center shrink-0 press" aria-label="Send">
              <Send size={17} />
            </button>
          ) : (
            <VoiceRecorder
              compact={false}
              onSend={({ durationSec, blob, transcript }) => { void sendVoiceMessage(convo.id, blob, durationSec, transcript); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
