import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, SwitchCamera, Phone, WifiOff } from "lucide-react";
import { Avatar } from "./Avatar";
import type { CallPeer, CallKind, CallPhase } from "../lib/calls";

function useStreamVideo(stream: MediaStream | null) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && stream) {
      el.srcObject = stream;
      void el.play().catch(() => {});
    }
    return () => { if (el) el.srcObject = null; };
  }, [stream]);
  return ref;
}

export function CallScreen({
  peer,
  kind,
  direction,
  phase,
  localStream,
  remoteStream,
  muted,
  camOff,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onEnd,
}: {
  peer: CallPeer;
  kind: CallKind;
  direction: "incoming" | "outgoing";
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  camOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEnd: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [speaker, setSpeaker] = useState(true);
  const remoteRef = useStreamVideo(remoteStream);
  const localRef = useStreamVideo(localStream);
  const hasRemoteVideo = !!remoteStream?.getVideoTracks().length;

  const connected = phase === "active" || phase === "connecting";
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const statusText =
    phase === "ringing"
      ? direction === "outgoing"
        ? "Calling…"
        : "Incoming call"
      : phase === "connecting"
        ? "Connecting…"
        : phase === "active"
          ? `Connected · ${fmt(seconds)}`
          : phase === "ended"
            ? "Call ended"
            : "Connecting…";

  const user = {
    id: peer.id,
    name: peer.name,
    handle: peer.handle,
    avatarColor: peer.avatarColor,
    avatarEmoji: peer.avatarEmoji,
    verified: peer.verified,
  };

  return (
    <div className="fixed inset-0 z-[70] bg-nova-black flex flex-col">
      {/* Remote video / avatar */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {kind === "video" && hasRemoteVideo ? (
          <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, ${peer.avatarColor}66, #0B0A12)` }}
          />
        )}
        {!hasRemoteVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {kind === "video" && remoteStream && (
              <p className="text-white/40 text-xs mb-3 flex items-center gap-1.5">
                <WifiOff size={13} /> Waiting for their camera…
              </p>
            )}
            <div className="relative">
              <Avatar user={user} size={110} />
              {connected && (
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-4 border-nova-black flex items-center justify-center">
                  {kind === "video" ? <Video size={12} className="text-white" /> : <Phone size={12} className="text-white" />}
                </span>
              )}
            </div>
            <p className="mt-4 font-heading font-bold text-2xl text-white">{peer.name}</p>
            <p className="text-white/60 text-sm mt-1">{statusText}</p>
          </div>
        )}
        {hasRemoteVideo && (
          <div className="absolute bottom-6 inset-x-0 flex flex-col items-center">
            <p className="font-heading font-bold text-lg text-white drop-shadow">{peer.name}</p>
            <p className="text-white/70 text-xs drop-shadow">{statusText}</p>
          </div>
        )}

        {/* Self view */}
        {kind === "video" && localStream && (
          <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border border-white/20 bg-black/40 shadow-xl">
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${camOff ? "opacity-30" : ""}`}
              style={{ transform: "scaleX(-1)" }}
            />
            {camOff && <span className="absolute inset-0 flex items-center justify-center text-white/80"><VideoOff size={22} /></span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-nova-black/80 backdrop-blur pb-10 pt-6 px-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onToggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? "bg-white text-nova-black" : "bg-white/15 text-white"}`}
            aria-label="Mute"
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          {kind === "video" && (
            <>
              <button
                onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${camOff ? "bg-white text-nova-black" : "bg-white/15 text-white"}`}
                aria-label="Camera"
              >
                {camOff ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
              <button
                onClick={onFlipCamera}
                className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center"
                aria-label="Flip camera"
              >
                <SwitchCamera size={22} />
              </button>
            </>
          )}
          <button
            onClick={() => setSpeaker(!speaker)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speaker ? "bg-white text-nova-black" : "bg-white/15 text-white"}`}
            aria-label="Speaker"
          >
            <Volume2 size={22} />
          </button>
          <button
            onClick={onEnd}
            className="w-16 h-16 rounded-full bg-coral flex items-center justify-center text-white shadow-lg shadow-coral/40 active:scale-95 transition-transform"
            aria-label="End call"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>
    </div>
  );
}
