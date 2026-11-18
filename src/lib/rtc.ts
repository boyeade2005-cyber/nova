// Shared WebRTC ICE configuration: public STUN + configurable TURN.
// TURN credentials come from env (VITE_TURN_URL / VITE_TURN_USERNAME /
// VITE_TURN_CREDENTIAL). Without them we fall back to the free Open Relay
// TURN service so calls still traverse symmetric NAT on mobile networks.
// For production scale, swap in a managed TURN (Metered, Twilio, Cloudflare).

const env = import.meta.env;

function turnServer(url: string, username: string, credential: string): RTCIceServer {
  return { urls: url, username, credential };
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(env.VITE_TURN_URL && env.VITE_TURN_USERNAME && env.VITE_TURN_CREDENTIAL
    ? [turnServer(env.VITE_TURN_URL as string, env.VITE_TURN_USERNAME as string, env.VITE_TURN_CREDENTIAL as string)]
    : [
        // Open Relay free TURN (-metered demo relay) — best-effort fallback
        turnServer("turn:openrelay.metered.ca:80", "openrelayproject", "openrelayproject"),
        turnServer("turn:openrelay.metered.ca:443?transport=tcp", "openrelayproject", "openrelayproject"),
        turnServer("turns:openrelay.metered.ca:443?transport=tcp", "openrelayproject", "openrelayproject"),
      ]),
];
