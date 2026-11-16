import { useSyncExternalStore } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type CallKind = "voice" | "video";
export type CallPhase = "ringing" | "connecting" | "active" | "ended";

export interface CallPeer {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  avatarEmoji: string;
  verified?: boolean;
}

export interface IncomingCall {
  id: string;
  kind: CallKind;
  callerId: string;
  peer: CallPeer;
}

export interface ActiveCall {
  id: string;
  kind: CallKind;
  direction: "incoming" | "outgoing";
  phase: CallPhase;
  peer: CallPeer;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  camOff: boolean;
  notice?: string; // e.g. "Call declined", "No answer"
}

interface State {
  myId: string | null;
  incoming: IncomingCall | null;
  call: ActiveCall | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const RING_TIMEOUT_MS = 45_000;

// ---------------------------------------------------------------------------
// Module-level call manager (singleton). All state lives here; React reads it
// through useCalls() via useSyncExternalStore.
// ---------------------------------------------------------------------------

let state: State = { myId: null, incoming: null, call: null };
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

let initialized = false;
let incomingChannel: RealtimeChannel | null = null;

// per-call resources
let pc: RTCPeerConnection | null = null;
let signalChannel: RealtimeChannel | null = null;
let callChannel: RealtimeChannel | null = null;
let ringTimer: ReturnType<typeof setTimeout> | null = null;
const seenSignals = new Set<string>();
let cleanupLocal: (() => void) | null = null;

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function fetchPeer(id: string): Promise<CallPeer> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_emoji, avatar_color, is_verified")
    .eq("id", id)
    .maybeSingle();
  const p: any = data ?? {};
  return {
    id,
    name: p.display_name ?? p.username ?? "Unknown",
    handle: p.username ?? "unknown",
    avatarColor: p.avatar_color ?? "#FF6B00",
    avatarEmoji: p.avatar_emoji ?? "🦊",
    verified: p.is_verified,
  };
}

function newPeerConnection(): RTCPeerConnection {
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  conn.onicecandidate = (e) => {
    if (!e.candidate || !state.call) return;
    void supabase.from("call_signals").insert({
      call_id: state.call.id,
      from_id: state.myId,
      kind: "ice",
      payload: e.candidate.toJSON(),
    });
  };
  conn.ontrack = (e) => {
    const stream = e.streams[0];
    if (stream && state.call) {
      setState({ call: { ...state.call, remoteStream: stream } });
    }
  };
  conn.onconnectionstatechange = () => {
    if (!state.call) return;
    const s = conn.connectionState;
    if (s === "connected") setState({ call: { ...state.call, phase: "active" } });
    if (s === "failed" || s === "closed" || s === "disconnected") {
      // give it a moment — 'disconnected' can recover
      if (s !== "disconnected") finishCallInternal("Connection lost");
    }
  };
  return conn;
}

async function insertSignal(callId: string, kind: string, payload: unknown) {
  await supabase.from("call_signals").insert({
    call_id: callId,
    from_id: state.myId,
    kind,
    payload: payload as Record<string, unknown>,
  });
}

async function handleSignal(row: any) {
  if (!pc || !state.call || row.call_id !== state.call.id) return;
  if (seenSignals.has(row.id)) return;
  seenSignals.add(row.id);
  try {
    if (row.kind === "offer" && state.call.direction === "incoming") {
      const sdp = row.payload?.sdp ?? row.payload;
      await pc.setRemoteDescription({ type: "offer", sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await insertSignal(state.call.id, "answer", { type: answer.type, sdp: answer.sdp });
      if (state.call) setState({ call: { ...state.call, phase: "connecting" } });
    } else if (row.kind === "answer" && state.call.direction === "outgoing") {
      const sdp = row.payload?.sdp ?? row.payload;
      await pc.setRemoteDescription({ type: "answer", sdp });
      if (state.call) setState({ call: { ...state.call, phase: "connecting" } });
    } else if (row.kind === "ice") {
      const cand = row.payload;
      if (cand && typeof cand === "object" && (cand.candidate || cand.sdp)) {
        try { await pc.addIceCandidate(cand); } catch { /* stale candidate */ }
      }
    } else if (row.kind === "end") {
      finishCallInternal(state.call.direction === "incoming" ? "Call ended" : undefined);
    }
  } catch {
    /* ignore malformed signals */
  }
}

async function loadSignalBacklog(callId: string) {
  const { data } = await supabase
    .from("call_signals")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true });
  for (const row of data ?? []) await handleSignal(row);
}

function subscribeCallChannels(callId: string) {
  signalChannel = supabase
    .channel(`call-sig-${callId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
      (payload) => void handleSignal(payload.new)
    )
    .subscribe();

  callChannel = supabase
    .channel(`call-row-${callId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
      (payload) => {
        const s = (payload.new as any)?.status;
        if (s === "ended" || s === "declined" || s === "missed") {
          const reason = s === "declined" ? "Call declined" : s === "missed" ? "No answer" : undefined;
          finishCallInternal(reason);
        } else if (s === "active" && state.call) {
          setState({ call: { ...state.call, phase: "active" } });
        }
      }
    )
    .subscribe();

  void loadSignalBacklog(callId);
}

function teardownChannels() {
  if (signalChannel) void supabase.removeChannel(signalChannel);
  if (callChannel) void supabase.removeChannel(callChannel);
  signalChannel = null;
  callChannel = null;
  seenSignals.clear();
}

function teardownPeer() {
  cleanupLocal?.();
  cleanupLocal = null;
  try { pc?.close(); } catch { /* noop */ }
  pc = null;
}

async function getMedia(kind: CallKind, videoEnabled = true): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video" && videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  } catch {
    // camera denied for video call → fall back to audio-only
    if (kind === "video") {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        return null;
      }
    }
    return null;
  }
}

function attachLocalTracks(stream: MediaStream) {
  if (!pc) return;
  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  const video = stream.getVideoTracks()[0];
  if (video) {
    // reflect camOff state on the sender
    video.enabled = !state.call?.camOff;
  }
}

async function acquireCallResources(kind: CallKind): Promise<MediaStream | null> {
  const stream = await getMedia(kind);
  if (!stream) return null;
  pc = newPeerConnection();
  attachLocalTracks(stream);
  cleanupLocal = () => stream.getTracks().forEach((t) => t.stop());
  return stream;
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

export async function startCall(calleeId: string, kind: CallKind = "voice"): Promise<void> {
  if (!isSupabaseConfigured || state.call || state.incoming) return;
  const me = await myId();
  if (!me || me === calleeId) return;
  if (!state.myId) setState({ myId: me });

  const peer = await fetchPeer(calleeId);
  const stream = await acquireCallResources(kind);
  if (!stream || !pc) return;

  const { data: callRow, error } = await supabase
    .from("calls")
    .insert({ caller_id: me, callee_id: calleeId, kind })
    .select("id")
    .single();
  if (error || !callRow) {
    teardownPeer();
    return;
  }

  setState({
    call: {
      id: callRow.id,
      kind,
      direction: "outgoing",
      phase: "ringing",
      peer,
      localStream: stream,
      remoteStream: null,
      muted: false,
      camOff: false,
    },
  });

  subscribeCallChannels(callRow.id);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await insertSignal(callRow.id, "offer", { type: offer.type, sdp: offer.sdp });

  ringTimer = setTimeout(() => {
    void supabase.from("calls").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", callRow.id);
    finishCallInternal("No answer");
  }, RING_TIMEOUT_MS);
}

export async function acceptCall(): Promise<void> {
  const inc = state.incoming;
  if (!inc || state.call) return;
  const me = await myId();
  if (!me) return;
  if (!state.myId) setState({ myId: me });

  const stream = await acquireCallResources(inc.kind);
  if (!stream || !pc) return;

  setState({ incoming: null });
  setState({
    call: {
      id: inc.id,
      kind: inc.kind,
      direction: "incoming",
      phase: "connecting",
      peer: inc.peer,
      localStream: stream,
      remoteStream: null,
      muted: false,
      camOff: false,
    },
  });
  subscribeCallChannels(inc.id);
  await supabase
    .from("calls")
    .update({ status: "active", answered_at: new Date().toISOString() })
    .eq("id", inc.id);
}

export async function declineCall(): Promise<void> {
  const inc = state.incoming;
  if (!inc) return;
  await supabase
    .from("calls")
    .update({ status: "declined", ended_at: new Date().toISOString() })
    .eq("id", inc.id);
  setState({ incoming: null });
}

export async function endCall(): Promise<void> {
  const c = state.call;
  if (!c) return;
  await insertSignal(c.id, "end", {});
  await supabase
    .from("calls")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", c.id);
  finishCallInternal();
}

export function toggleMute(): void {
  if (!state.call) return;
  const muted = !state.call.muted;
  state.call.localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  setState({ call: { ...state.call, muted } });
}

export function toggleCamera(): void {
  if (!state.call) return;
  const camOff = !state.call.camOff;
  state.call.localStream?.getVideoTracks().forEach((t) => { t.enabled = !camOff; });
  setState({ call: { ...state.call, camOff } });
}

export async function flipCamera(): Promise<void> {
  const c = state.call;
  if (!c?.localStream || c.kind !== "video") return;
  const current = c.localStream.getVideoTracks()[0];
  if (!current) return;
  const facing = current.getSettings().facingMode === "user" ? "environment" : "user";
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing },
      audio: false,
    });
    const newTrack = newStream.getVideoTracks()[0];
    const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
    if (sender && newTrack) {
      await sender.replaceTrack(newTrack);
      current.stop();
      const stream = new MediaStream([newTrack, ...c.localStream.getAudioTracks()]);
      setState({ call: { ...c, localStream: stream, camOff: !newTrack.enabled } });
      cleanupLocal = () => stream.getTracks().forEach((t) => t.stop());
    } else {
      newTrack?.stop();
    }
  } catch { /* flip unsupported */ }
}

function finishCallInternal(notice?: string) {
  if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
  const had = !!state.call;
  teardownChannels();
  teardownPeer();
  setState({ call: had ? { ...state.call!, phase: "ended", notice } : state.call, incoming: state.incoming });
  // clear the ended call after a beat so the UI can show "ended" briefly
  setTimeout(() => {
    if (state.call?.phase === "ended") setState({ call: null });
  }, 1600);
}

// ---------------------------------------------------------------------------
// Incoming-call listener (mounted once via initCalls)
// ---------------------------------------------------------------------------

async function handleIncomingCall(row: any) {
  const me = state.myId;
  if (!me || row.callee_id !== me || row.status !== "ringing") return;
  if (state.call || state.incoming) {
    // busy — auto decline
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", row.id);
    return;
  }
  const peer = await fetchPeer(row.caller_id);
  setState({ incoming: { id: row.id, kind: row.kind as CallKind, callerId: row.caller_id, peer } });
}

async function handleIncomingUpdate(row: any) {
  const me = state.myId;
  if (!me || row.callee_id !== me) return;
  if (state.incoming?.id === row.id && row.status !== "ringing") {
    setState({ incoming: null });
  }
}

export async function initCalls(): Promise<() => void> {
  if (initialized || !isSupabaseConfigured) return () => {};
  initialized = true;
  const id = await myId();
  if (!id) return () => {};
  setState({ myId: id });

  incomingChannel = supabase
    .channel("calls-incoming")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${id}` },
      (p) => void handleIncomingCall(p.new)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "calls", filter: `callee_id=eq.${id}` },
      (p) => void handleIncomingUpdate(p.new)
    )
    .subscribe();

  // also check for a ringing call that arrived while the tab was closed/reloading
  const { data: ringing } = await supabase
    .from("calls")
    .select("*")
    .eq("callee_id", id)
    .eq("status", "ringing")
    .order("created_at", { ascending: false })
    .limit(1);
  const fresh = (ringing ?? []).find((r: any) => Date.now() - new Date(r.created_at).getTime() < RING_TIMEOUT_MS);
  if (fresh) void handleIncomingCall(fresh);

  return () => {
    if (incomingChannel) void supabase.removeChannel(incomingChannel);
    incomingChannel = null;
    initialized = false;
  };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCalls(): State & {
  startCall: typeof startCall;
  acceptCall: typeof acceptCall;
  declineCall: typeof declineCall;
  endCall: typeof endCall;
  toggleMute: typeof toggleMute;
  toggleCamera: typeof toggleCamera;
  flipCamera: typeof flipCamera;
} {
  const s = useSyncExternalStore(subscribe, () => state);
  return {
    ...s,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
