import { useEffect } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "./Avatar";
import { CallScreen } from "./CallScreen";
import { initCalls, useCalls } from "../lib/calls";

/**
 * Global call UI — mounted once in App. Handles:
 *  - incoming call sheet (accept / decline)
 *  - active call screen (real WebRTC A/V)
 */
export function CallManager() {
  const calls = useCalls();

  useEffect(() => {
    void initCalls();
  }, []);

  const { incoming, call } = calls;

  if (call && call.phase !== "ended") {
    return (
      <CallScreen
        peer={call.peer}
        kind={call.kind}
        direction={call.direction}
        phase={call.phase}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        muted={call.muted}
        camOff={call.camOff}
        onToggleMute={calls.toggleMute}
        onToggleCamera={calls.toggleCamera}
        onFlipCamera={calls.flipCamera}
        onEnd={() => void calls.endCall()}
      />
    );
  }

  if (call?.phase === "ended" && call.notice) {
    return (
      <div className="fixed inset-x-0 top-16 z-[70] flex justify-center pointer-events-none">
        <div className="bg-surface border border-line shadow-xl rounded-full px-5 py-2.5 text-sm font-bold animate-fade-in">
          {call.notice}
        </div>
      </div>
    );
  }

  if (!incoming) return null;

  const peer = {
    id: incoming.peer.id,
    name: incoming.peer.name,
    handle: incoming.peer.handle,
    avatarColor: incoming.peer.avatarColor,
    avatarEmoji: incoming.peer.avatarEmoji,
    verified: incoming.peer.verified,
  };

  return (
    <div className="fixed inset-0 z-[70] bg-nova-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm card !bg-surface p-6 flex flex-col items-center animate-pop">
        <p className="text-xs font-extrabold tracking-widest text-muted uppercase mb-4">
          Incoming {incoming.kind === "video" ? "video" : "voice"} call
        </p>
        <div className="relative mb-3">
          <Avatar user={peer} size={88} />
          <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-surface flex items-center justify-center animate-pulse">
            {incoming.kind === "video" ? <Video size={14} className="text-white" /> : <Phone size={14} className="text-white" />}
          </span>
        </div>
        <p className="font-heading font-extrabold text-xl">{peer.name}</p>
        <p className="text-sm text-muted">@{peer.handle}</p>

        <div className="flex items-center gap-6 mt-6">
          <button
            onClick={() => void calls.declineCall()}
            className="flex flex-col items-center gap-1.5"
            aria-label="Decline"
          >
            <span className="w-16 h-16 rounded-full bg-coral text-white flex items-center justify-center shadow-lg shadow-coral/40 active:scale-95 transition-transform">
              <PhoneOff size={26} />
            </span>
            <span className="text-xs font-bold text-muted">Decline</span>
          </button>
          <button
            onClick={() => void calls.acceptCall()}
            className="flex flex-col items-center gap-1.5"
            aria-label="Accept"
          >
            <span className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 active:scale-95 transition-transform">
              {incoming.kind === "video" ? <Video size={26} /> : <Phone size={26} />}
            </span>
            <span className="text-xs font-bold text-muted">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
