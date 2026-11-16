import { useEffect, useRef, useState } from "react";
import { X, Eye, Gift, Send, ChevronUp } from "lucide-react";
import { type LiveStream, type User } from "../data/mock";
import { Avatar } from "../components/Avatar";
import { GiftSheet } from "../components/GiftSheet";
import {
  startLiveStream, endLiveStream, fetchLiveMessages, sendLiveMessage,
  subscribeToLiveMessages, joinLiveStream, leaveLiveStream,
  followUser, goLiveNow,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface LiveChatMsg {
  id: string;
  name: string;
  text: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

function mapChatMsg(m: any): LiveChatMsg {
  const u = m.user ?? {};
  return {
    id: m.id,
    name: u.display_name ?? u.username ?? "Nova",
    text: m.text,
    avatarColor: u.avatar_color,
    avatarEmoji: u.avatar_emoji,
  };
}

export function LiveScreen({
  stream,
  host,
  onClose,
  onNext,
  communityId,
}: {
  stream?: LiveStream;
  host?: User;
  onClose: () => void;
  onNext?: () => void;
  /** Group/community this live belongs to (host mode). */
  communityId?: string;
}) {
  const isHost = !!host;
  const { profile } = useSession();
  const displayUser = host ?? stream?.host;
  const title = isHost ? "Your live stream" : stream?.title;
  // viewer of a scheduled stream waits until the host goes live
  const scheduledWait = !isHost && !!stream && stream.isLive === false && !!stream.scheduledAt;
  const [liveNow, setLiveNow] = useState(!scheduledWait);
  const isOwner = !isHost && !!stream && profile?.id === stream.host.id;
  const [broadcasting, setBroadcasting] = useState(false);
  // host mode is also active when the owner of a scheduled stream hits "Start broadcast"
  const wantsHost = isHost || (isOwner && broadcasting);

  const [viewers, setViewers] = useState(stream?.viewers ?? 1);
  const [seconds, setSeconds] = useState(0);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftFeed, setGiftFeed] = useState<string[]>([]);
  const [chat, setChat] = useState<LiveChatMsg[]>([]);
  const [comment, setComment] = useState("");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [liveVideo, setLiveVideo] = useState<MediaStream | null>(null);
  const [ended, setEnded] = useState(false);
  const [starting, setStarting] = useState(isHost);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [following, setFollowing] = useState(false);

  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hostPeers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPc = useRef<RTCPeerConnection | null>(null);
  const signalChannel = useRef<RealtimeChannel | null>(null);
  const streamChannel = useRef<RealtimeChannel | null>(null);
  const msgUnsub = useRef<(() => void) | null>(null);
  const myIdRef = useRef<string | null>(null);
  const seenSignals = useRef<Set<string>>(new Set());

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ---------- timers ----------
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ---------- shared chat ----------
  useEffect(() => {
    if (!streamId) return;
    const load = () => void fetchLiveMessages(streamId).then((m) => setChat(m.map(mapChatMsg)));
    load();
    msgUnsub.current = subscribeToLiveMessages(streamId, load);
    return () => { msgUnsub.current?.(); msgUnsub.current = null; };
  }, [streamId]);

  const sendChat = async () => {
    const t = comment.trim();
    if (!t || !streamId) return;
    setComment("");
    await sendLiveMessage(streamId, t);
  };

  // ---------- viewer: join stream, watch host via WebRTC mesh ----------
  useEffect(() => {
    if (isHost || !stream) return;
    let cancelled = false;
    let joined = false;
    const hostId = stream.host.id;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      myIdRef.current = session.user.id;
      setStreamId(stream.id);
      setViewers(stream.viewers);

      // stream ended / went live watcher — always on, even while scheduled
      streamChannel.current = supabase
        .channel(`live-watch-${stream.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${stream.id}` }, (p) => {
          const row = p.new as any;
          if (typeof row?.viewer_count === "number") setViewers(row.viewer_count);
          if (row?.is_live === true) setLiveNow(true);
          if (row?.is_live === false && !scheduledWait) setEnded(true);
        })
        .subscribe();

      if (!liveNow) return; // scheduled stream — wait for the host to go live

      await joinLiveStream(stream.id);
      joined = true;
      if (cancelled) { void leaveLiveStream(stream.id); joined = false; return; }

      // watch host's camera — recvonly peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      viewerPc.current = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (e) => {
        const s = e.streams[0];
        if (s && remoteRef.current) {
          remoteRef.current.srcObject = s;
          void remoteRef.current.play().catch(() => {});
          setHasRemoteVideo(true);
        }
      };
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void supabase.from("live_signals").insert({
          stream_id: stream.id, from_id: session.user.id, to_id: hostId,
          kind: "ice", payload: e.candidate.toJSON(),
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await supabase.from("live_signals").insert({
        stream_id: stream.id, from_id: session.user.id, to_id: hostId,
        kind: "offer", payload: { type: offer.type, sdp: offer.sdp },
      });

      // listen for host's answer + ICE
      signalChannel.current = supabase
        .channel(`live-viewer-${stream.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_signals", filter: `to_id=eq.${session.user.id}` }, (p) => {
          void handleViewerSignal(p.new as any, pc);
        })
        .subscribe();
    };

    const handleViewerSignal = async (row: any, conn: RTCPeerConnection) => {
      if (row.from_id === myIdRef.current || seenSignals.current.has(row.id)) return;
      seenSignals.current.add(row.id);
      try {
        if (row.kind === "answer") {
          const sdp = row.payload?.sdp ?? row.payload;
          await conn.setRemoteDescription({ type: "answer", sdp });
        } else if (row.kind === "ice") {
          const cand = row.payload;
          if (cand && typeof cand === "object" && (cand.candidate || cand.sdp)) {
            try { await conn.addIceCandidate(cand); } catch { /* stale */ }
          }
        }
      } catch { /* ignore */ }
    };

    void setup();
    return () => {
      cancelled = true;
      // tell the host we're leaving so it can drop our peer connection
      if (joined) {
        void leaveLiveStream(stream.id);
        if (myIdRef.current) {
          void supabase.from("live_signals").insert({
            stream_id: stream.id, from_id: myIdRef.current, to_id: stream.host.id,
            kind: "peer-left", payload: {},
          });
        }
      }
      if (signalChannel.current) void supabase.removeChannel(signalChannel.current);
      if (streamChannel.current) void supabase.removeChannel(streamChannel.current);
      try { viewerPc.current?.close(); } catch { /* noop */ }
      viewerPc.current = null;
      const el = remoteRef.current;
      if (el) el.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, stream?.id, liveNow]);

  // ---------- host: camera + stream row + viewer mesh ----------
  useEffect(() => {
    if (!wantsHost || !displayUser) return;
    let cancelled = false;
    let sid: string | null = null;

    const sendTo = (toId: string, kind: string, payload: unknown) => {
      if (!sid) return;
      void supabase.from("live_signals").insert({
        stream_id: sid, from_id: myIdRef.current, to_id: toId, kind,
        payload: payload as Record<string, unknown>,
      });
    };

    const setupHost = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      myIdRef.current = session.user.id;

      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      } catch {
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          window.alert("Camera/mic unavailable — cannot go live.");
          onClose();
          return;
        }
      }
      if (cancelled) { media.getTracks().forEach((t) => t.stop()); return; }
      localStreamRef.current = media;
      setLiveVideo(media);
      if (localRef.current) {
        localRef.current.srcObject = media;
        void localRef.current.play().catch(() => {});
      }

      // owner of a scheduled stream reuses the existing row — everyone else creates a new one
      const presetId = !isHost && stream?.id ? stream.id : null;
      const id = presetId ?? await (async () => {
        const titleText = window.prompt("What are you live for?", "Going live 🔴") ?? "Going live 🔴";
        return startLiveStream(titleText, "just-chatting", {
          communityId: communityId ?? stream?.communityId,
          country: host?.country ?? profile?.country,
        });
      })();
      if (!id || cancelled) {
        media.getTracks().forEach((t) => t.stop());
        if (id && cancelled) void endLiveStream(id); // strict-mode remount / unmount race
        if (!cancelled) onClose();
        return;
      }
      sid = id;
      setStreamId(id);
      setStarting(false);

      const handleHostSignal = async (row: any) => {
        if (row.from_id === myIdRef.current || seenSignals.current.has(row.id)) return;
        if (row.to_id !== myIdRef.current) return; // host only handles signals addressed to it
        seenSignals.current.add(row.id);
        const viewerId = row.from_id as string;
        try {
          if (row.kind === "offer") {
            const sdp = row.payload?.sdp ?? row.payload;
            let conn = hostPeers.current.get(viewerId);
            if (!conn) {
              conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
              hostPeers.current.set(viewerId, conn);
              conn.onicecandidate = (e) => {
                if (e.candidate) sendTo(viewerId, "ice", e.candidate.toJSON());
              };
              conn.onconnectionstatechange = () => {
                const s = conn!.connectionState;
                if (s === "failed" || s === "closed") {
                  hostPeers.current.delete(viewerId);
                  try { conn!.close(); } catch { /* noop */ }
                }
              };
              for (const track of localStreamRef.current?.getTracks() ?? []) {
                conn.addTrack(track, localStreamRef.current!);
              }
            }
            await conn.setRemoteDescription({ type: "offer", sdp });
            const answer = await conn.createAnswer();
            await conn.setLocalDescription(answer);
            sendTo(viewerId, "answer", { type: answer.type, sdp: answer.sdp });
          } else if (row.kind === "ice") {
            const conn = hostPeers.current.get(viewerId);
            const cand = row.payload;
            if (conn && cand && typeof cand === "object" && (cand.candidate || cand.sdp)) {
              try { await conn.addIceCandidate(cand); } catch { /* stale */ }
            }
          } else if (row.kind === "peer-left") {
            const conn = hostPeers.current.get(viewerId);
            if (conn) { try { conn.close(); } catch { /* noop */ } hostPeers.current.delete(viewerId); }
          }
        } catch { /* ignore malformed */ }
      };

      // host listens for viewer offers on this stream
      signalChannel.current = supabase
        .channel(`live-host-${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_signals", filter: `stream_id=eq.${id}` }, (p) => {
          void handleHostSignal(p.new as any);
        })
        .subscribe();

      // backlog — viewers may have signaled before we subscribed
      const { data: backlog } = await supabase.from("live_signals").select("*").eq("stream_id", id).order("created_at");
      for (const row of backlog ?? []) {
        if (seenSignals.current.has((row as any).id)) continue;
        seenSignals.current.add((row as any).id);
        void handleHostSignal(row as any);
      }

      streamChannel.current = supabase
        .channel(`live-host-stream-${id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${id}` }, (p) => {
          const row = p.new as any;
          if (typeof row?.viewer_count === "number") setViewers(row.viewer_count);
        })
        .subscribe();
    };

    void setupHost();
    return () => {
      cancelled = true;
      if (sid) void endLiveStream(sid);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      for (const conn of hostPeers.current.values()) { try { conn.close(); } catch { /* noop */ } }
      hostPeers.current.clear();
      if (signalChannel.current) void supabase.removeChannel(signalChannel.current);
      if (streamChannel.current) void supabase.removeChannel(streamChannel.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsHost]);

  // ended stream → auto close for viewers
  useEffect(() => {
    if (ended) {
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [ended, onClose]);

  // GiftSheet already charged the wallet via send_gift rpc — just animate the feed
  const sendGiftTo = (g: { emoji: string; name: string }) => {
    setGiftFeed((f) => [...f.slice(-4), `${g.emoji} ${g.name}`]);
  };

  const recentChat = chat.slice(-3);

  return (
    <div className="fixed inset-0 z-50 bg-nova-black flex flex-col">
      {/* Stream area */}
      <div className="flex-1 relative overflow-hidden bg-nova-black">
        {wantsHost ? (
          <>
            <video ref={localRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
            {!liveVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                <span className="text-6xl mb-3 animate-pulse">🔴</span>
                <p className="text-sm font-bold">{starting ? "Starting your stream…" : "Camera offline"}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[9rem] opacity-50 select-none">{stream?.emoji ?? "📡"}</span>
              </div>
            )}
            {!liveNow && stream?.scheduledAt && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-white z-10 px-6 text-center">
                <span className="text-5xl mb-3">📅</span>
                <p className="font-heading font-bold text-xl">Scheduled live</p>
                <p className="text-white/70 text-sm mt-1">
                  {displayUser?.name} goes live {new Date(stream.scheduledAt).toLocaleString()}
                </p>
                <p className="text-white/50 text-xs mt-3">Chat is open — the stream starts automatically when they're live.</p>
                {isOwner && (
                  <button
                    onClick={() => void goLiveNow(stream.id).then(() => setBroadcasting(true))}
                    className="mt-6 h-12 px-8 rounded-full nova-gradient text-white font-extrabold text-sm active:scale-95 transition-transform"
                  >
                    🔴 Start broadcast now
                  </button>
                )}
              </div>
            )}
            {ended && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-10">
                <span className="text-5xl mb-3">🔴</span>
                <p className="font-heading font-bold text-xl">This stream has ended</p>
              </div>
            )}
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-white text-xs font-extrabold tracking-widest flex items-center gap-1.5 ${!liveNow && stream?.scheduledAt ? "bg-amber-500" : "bg-coral"}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {!liveNow && stream?.scheduledAt ? "SCHEDULED" : "LIVE"}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-black/50 text-white text-xs font-bold">{fmt(seconds)}</span>
            {stream && <span className="px-2.5 py-1 rounded-md bg-black/50 text-white text-xs font-bold capitalize">{stream.category}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-black/50 text-white text-xs font-bold flex items-center gap-1">
              <Eye size={12} /> {viewers.toLocaleString()}
            </span>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="Close live">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Host info */}
        {displayUser && (
          <div className="absolute top-16 left-4 right-4 flex items-center gap-3">
            <Avatar
              user={{
                id: displayUser.id, name: displayUser.name, handle: displayUser.handle,
                avatarColor: displayUser.avatarColor, avatarEmoji: displayUser.avatarEmoji, verified: displayUser.verified,
              }}
              size={44}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm drop-shadow truncate">{displayUser.name}</p>
              <p className="text-white/70 text-xs truncate">{title}</p>
            </div>
            {!isOwner && !isHost && (
              <button
                onClick={() => {
                  const now = !following;
                  setFollowing(now);
                  void followUser(stream!.host.id, now);
                }}
                className={`h-8 px-3.5 rounded-full text-xs font-bold ${following ? "bg-white/20 text-white" : "nova-gradient text-white"}`}
              >
                {following ? "Following" : "Follow"}
              </button>
            )}
          </div>
        )}

        {/* Real chat — floating comments */}
        <div className="absolute left-3 bottom-32 w-3/4 space-y-2 pointer-events-none">
          {recentChat.map((m) => (
            <p key={m.id} className="text-white/90 text-sm font-semibold drop-shadow bg-black/20 backdrop-blur-sm rounded-xl px-3 py-1.5 w-fit max-w-full truncate animate-fade-in">
              <span className="text-hot-pink font-extrabold">{m.name}: </span>{m.text}
            </p>
          ))}
        </div>

        {/* Gift feed */}
        <div className="absolute right-3 top-1/3 flex flex-col items-end gap-1.5 pointer-events-none">
          {giftFeed.map((g, i) => (
            <span key={`${g}-${i}`} className="text-2xl animate-pop bg-black/30 backdrop-blur rounded-full px-3 py-1">{g}</span>
          ))}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 inset-x-0 p-4 pb-8">
          <div className="flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendChat()}
              placeholder={isHost ? "Say something to viewers…" : "Say something nice…"}
              className="flex-1 bg-white/15 backdrop-blur border border-white/20 rounded-full px-4 h-11 text-sm text-white placeholder-white/60 outline-none"
            />
            <button onClick={() => void sendChat()} className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white" aria-label="Send comment">
              <Send size={18} />
            </button>
            <button
              onClick={() => setGiftOpen(true)}
              className="w-11 h-11 rounded-full nova-gradient flex items-center justify-center text-white shadow-lg shadow-hot-pink/50"
              aria-label="Send gift"
            >
              <Gift size={19} />
            </button>
            {wantsHost ? (
              <button onClick={onClose} className="h-11 px-5 rounded-full bg-coral text-white text-sm font-extrabold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> End
              </button>
            ) : (
              onNext && (
                <button onClick={onNext} className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white" aria-label="Next live">
                  <ChevronUp size={20} />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <GiftSheet open={giftOpen} onClose={() => setGiftOpen(false)} onSend={sendGiftTo} tipTo={wantsHost ? undefined : stream?.host?.id} />
    </div>
  );
}
