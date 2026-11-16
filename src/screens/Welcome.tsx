import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Logo } from "../components/Logo";

type Msg = { from: "me" | "them"; text: string; delay: number };

const sceneA: Msg[] = [
  { from: "them", text: "okay but did you see the game last night??", delay: 0.4 },
  { from: "me", text: "LENA. I literally screamed", delay: 1.6 },
  { from: "them", text: "send me the Nova clip, I'm sending it to everyone", delay: 2.8 },
  { from: "me", text: "already on it 😂", delay: 4.0 },
];

const sceneB: Msg[] = [
  { from: "me", text: "Boss, the proposal is ready — want me to send it?", delay: 0.4 },
  { from: "them", text: "Send it over. Also saw your profile, great work", delay: 1.8 },
  { from: "me", text: "🙌 thanks! btw any news on the Lagos role?", delay: 3.2 },
  { from: "them", text: "Interview Thursday. You've got this", delay: 4.6 },
];

function PhoneMock({ msgs, name, emoji, tint, delay }: { msgs: Msg[]; name: string; emoji: string; tint: string; delay: number }) {
  return (
    <div className="w-36 sm:w-44 rounded-[2rem] border-[6px] border-nova-black bg-nova-black shadow-2xl shadow-black/50 overflow-hidden">
      <div className="bg-surface rounded-t-[1.6rem] overflow-hidden">
        {/* status + chat header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-line">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: tint }}>{emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold leading-none">{name}</p>
            <p className="text-[8px] text-emerald-500 font-bold">● online</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-muted/40 mx-0.5" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted/40" />
        </div>
        {/* chat area */}
        <div className="h-44 sm:h-52 px-2.5 py-2.5 flex flex-col justify-end gap-1.5 overflow-hidden">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`animate-msg max-w-[85%] px-2.5 py-1.5 rounded-2xl text-[9.5px] font-bold leading-snug ${
                m.from === "me"
                  ? "self-end rounded-br-sm text-white"
                  : "self-start bg-surface2 rounded-bl-sm"
              }`}
              style={{
                animationDelay: `${m.delay}s`,
                background: m.from === "me" ? "linear-gradient(120deg,#FF6B00,#FF2A5F)" : undefined,
              }}
            >
              {m.text}
            </div>
          ))}
          {/* typing dots */}
          <div className="self-start bg-surface2 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 animate-msg" style={{ animationDelay: `${delay}s` }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
        {/* input bar */}
        <div className="px-2.5 pb-3 pt-1 flex items-center gap-1.5">
          <div className="flex-1 h-6 rounded-full bg-surface2" />
          <div className="w-6 h-6 rounded-full nova-gradient" />
        </div>
      </div>
    </div>
  );
}

export function Welcome({ onNext }: { onNext: () => void }) {
  const [loop, setLoop] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLoop((l) => l + 1), 9000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-nova-black text-white flex flex-col">
      {/* Aurora backdrop */}
      <div className="absolute inset-0 animate-ken-burns" style={{ background: "var(--aurora)" }} />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-hot-pink/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-nova-purple/20 blur-3xl" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <Logo size="sm" />
        <button onClick={onNext} className="text-sm font-bold text-white/70 hover:text-white transition-colors">
          I have an account
        </button>
      </div>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div key={loop} className="flex items-center gap-4 sm:gap-8">
          <PhoneMock msgs={sceneA} name="Lena" emoji="👩🏻" tint="linear-gradient(135deg,#FF6B00,#FF2A5F)" delay={5.2} />
          <div className="flex flex-col items-center gap-2 px-1">
            <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-full nova-gradient flex items-center justify-center shadow-lg shadow-hot-pink/40 animate-float-y">
              <Play size={18} className="text-white ml-0.5" fill="currentColor" />
            </span>
            <span className="text-[10px] font-extrabold tracking-widest text-white/50">LIVE ON NOVA</span>
          </div>
          <PhoneMock msgs={sceneB} name="Marcus" emoji="👨🏾" tint="linear-gradient(135deg,#00C2D1,#2F6BFF)" delay={6.0} />
        </div>

        {/* Floating reactions */}
        <span className="absolute left-[8%] top-[20%] text-2xl animate-float-y" style={{ animationDelay: "0.6s" }}>❤️</span>
        <span className="absolute right-[10%] top-[30%] text-xl animate-float-y" style={{ animationDelay: "1.4s" }}>🔥</span>
        <span className="absolute left-[16%] bottom-[24%] text-xl animate-float-y" style={{ animationDelay: "2.2s" }}>✨</span>
        <span className="absolute right-[18%] bottom-[30%] text-2xl animate-float-y" style={{ animationDelay: "0.9s" }}>🎉</span>

        <h1 className="mt-8 font-heading font-extrabold text-4xl sm:text-5xl leading-[1.05] tracking-tight">
          One app.<br />
          <span className="nova-gradient-text">Every conversation.</span>
        </h1>
        <p className="mt-4 text-white/60 text-sm sm:text-base max-w-sm font-medium">
          Chat your people, go live with the world, earn while you create — all in one place.
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-6 pb-10 space-y-3 max-w-sm mx-auto w-full">
        <button
          onClick={onNext}
          className="w-full h-13 rounded-full nova-gradient text-white font-heading font-bold text-lg shadow-xl shadow-hot-pink/30 active:scale-[0.98] transition-transform press"
          style={{ height: 52 }}
        >
          Create your account
        </button>
        <button onClick={onNext} className="w-full h-12 rounded-full border border-white/20 text-white/80 font-bold text-sm hover:bg-white/5 transition-colors">
          Sign in
        </button>
        <button onClick={onNext} className="w-full text-center text-xs text-white/40 font-semibold pt-1">
          Continue in demo mode — no account needed
        </button>
      </div>
    </div>
  );
}
