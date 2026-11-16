import { useEffect, useState } from "react";
import { LogoMark } from "./Logo";

export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 1400);
    const t2 = setTimeout(onDone, 1750);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-nova-black flex flex-col items-center justify-center transition-opacity duration-300 ${
        phase === "out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="animate-pop">
        <LogoMark size={120} glow />
      </div>
      <p className="mt-5 font-heading font-extrabold text-4xl lowercase tracking-tight">
        <span className="nova-gradient-text">nova</span>
      </p>
      <p className="mt-2 text-sm text-white/50 font-semibold tracking-wide">Your world. Your choice.</p>
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full nova-gradient animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
