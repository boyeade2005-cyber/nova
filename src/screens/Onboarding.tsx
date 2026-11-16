import { useState } from "react";
import { Globe, Mail, Sparkles } from "lucide-react";
import { interestChips } from "../data/mock";
import { Logo } from "../components/Logo";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const steps = ["Welcome", "Account", "Username", "Interests", "Feed style"] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [username, setUsername] = useState("");
  const [interests, setInterests] = useState<string[]>(["💻 Tech", "🎵 Music"]);
  const [style, setStyle] = useState<"balanced" | "focused" | "wild">("balanced");

  const next = () => (step === steps.length - 1 ? onDone() : setStep(step + 1));
  const toggle = (i: string) =>
    setInterests((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  const signInWithEmail = async () => {
    if (!isSupabaseConfigured || !email.includes("@") || !password) return;
    setAuthBusy(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) setAuthError("Couldn't sign in — check your details or continue in demo mode.");
    }
    setAuthBusy(false);
    setStep(1); // move to username step regardless; demo mode still works
  };

  const exploreDemo = async () => {
    setAuthBusy(true);
    if (isSupabaseConfigured) {
      await supabase.auth.signInWithPassword({ email: "nova@demo.io", password: "password123" }).catch(() => {});
    }
    setAuthBusy(false);
    onDone();
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Progress */}
      <div className="flex gap-1.5 px-6 pt-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "nova-gradient" : "bg-surface2"}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        {step === 0 && (
          <div className="text-center animate-fade-in">
            <Logo size="lg" />
            <p className="mt-4 text-muted text-lg">Your world. <span className="nova-gradient-text font-heading font-bold">Your choice.</span></p>
            <p className="mt-2 text-sm text-muted max-w-xs mx-auto">
              Communities, stories, short video and live conversations — one warm, honest social home.
            </p>
            <div className="mt-8 space-y-3 w-full">
              <button className="w-full h-12 rounded-2xl nova-gradient text-white font-heading font-bold flex items-center justify-center gap-2 shadow-lg shadow-hot-pink/25 active:scale-[0.98] transition-transform">
                <Globe size={18} /> Continue with Google
              </button>
              <button
                onClick={signInWithEmail}
                disabled={authBusy}
                className="w-full h-12 rounded-2xl bg-surface2 border border-line font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                <Mail size={18} className="text-nova-purple" /> {authBusy ? "Connecting…" : "Continue with email"}
              </button>
            </div>
            {authError && <p className="mt-3 text-xs text-coral font-semibold">{authError}</p>}
            <button onClick={exploreDemo} disabled={authBusy} className="mt-6 text-sm font-bold text-nova-purple">
              Explore demo instead →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="w-full animate-fade-in">
            <h2 className="font-heading font-extrabold text-2xl text-center">Create your account</h2>
            <div className="mt-6 space-y-3">
              <input placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface2 rounded-2xl px-4 h-12 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
              <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface2 rounded-2xl px-4 h-12 text-sm outline-none focus:ring-2 ring-nova-purple/40" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="w-full animate-fade-in">
            <h2 className="font-heading font-extrabold text-2xl text-center">Pick a username</h2>
            <p className="text-center text-sm text-muted mt-2">This is how people find you on Nova.</p>
            <div className="mt-6">
              <div className="flex items-center bg-surface2 rounded-2xl px-4 h-12">
                <span className="text-muted font-bold">@</span>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="yourname"
                  className="flex-1 bg-transparent px-2 text-sm outline-none font-bold" />
              </div>
              <p className="text-xs text-muted mt-2 px-1">💡 nova.app/@{username || "you"} · {username.length}/20</p>
            </div>
            <div className="mt-6 flex justify-center gap-1 text-3xl">
              {["🦊", "🐼", "🦉", "🐙"].map((e) => (
                <button key={e} className="w-14 h-14 rounded-2xl bg-surface2 hover:bg-nova-lilac dark:hover:bg-white/10 transition-colors text-2xl">{e}</button>
              ))}
            </div>
            <p className="text-center text-xs text-muted mt-2">Choose an avatar emoji</p>
          </div>
        )}

        {step === 3 && (
          <div className="w-full animate-fade-in">
            <h2 className="font-heading font-extrabold text-2xl text-center">What are you into?</h2>
            <p className="text-center text-sm text-muted mt-2">Pick a few — you can change this anytime.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {interestChips.map((i) => (
                <button key={i} onClick={() => toggle(i)}
                  className={`px-4 py-2.5 rounded-full text-sm font-bold border transition-all active:scale-95 ${
                    interests.includes(i)
                      ? "nova-gradient text-white border-transparent shadow-md shadow-hot-pink/25"
                      : "bg-surface2 border-line text-muted"
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="w-full animate-fade-in">
            <h2 className="font-heading font-extrabold text-2xl text-center">How should your feed feel?</h2>
            <div className="mt-6 space-y-3">
              {([
                ["balanced", "⚖️ Balanced", "A healthy mix of everything you love"],
                ["focused", "🎯 Focused", "Deep on your top interests"],
                ["wild", "🌈 Wild", "More surprises and new voices"],
              ] as const).map(([id, label, desc]) => (
                <button key={id} onClick={() => setStyle(id)}
                  className={`w-full card p-4 text-left flex items-center gap-4 transition-colors ${style === id ? "!border-nova-purple ring-2 ring-nova-purple/30" : ""}`}>
                  <span className="text-2xl">{label.split(" ")[0]}</span>
                  <span>
                    <span className="block font-heading font-bold text-sm">{label.split(" ").slice(1).join(" ")}</span>
                    <span className="block text-xs text-muted">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-muted mt-4 flex items-center justify-center gap-1">
              <Sparkles size={12} className="text-nova-purple" /> You can fine-tune this anytime with sliders
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {step > 0 && (
        <div className="px-6 pb-8 flex gap-3 max-w-md mx-auto w-full">
          <button onClick={() => setStep(step - 1)} className="h-12 px-5 rounded-2xl bg-surface2 font-bold text-sm text-muted">
            Back
          </button>
          <button
            onClick={next}
            disabled={step === 1 && !email.includes("@")}
            className="flex-1 h-12 rounded-2xl nova-gradient text-white font-heading font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {step === steps.length - 1 ? "Enter Nova ✨" : "Continue"}
          </button>
        </div>
      )}
      {step === 0 && (
        <div className="pb-8 text-center text-xs text-muted">
          By continuing you agree to Nova's Community Guidelines — be kind, always.
        </div>
      )}
    </div>
  );
}
