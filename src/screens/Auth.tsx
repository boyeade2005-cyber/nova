import { useState } from "react";
import { ArrowLeft, Mail, Lock, User, Loader2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { supabase } from "../lib/supabase";

export function AuthScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async () => {
    if (!email.includes("@") || password.length < 6) {
      setError("Enter a valid email and a password of 6+ characters.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "nova";
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              display_name: name.trim() || username,
              avatar_emoji: "🦊",
              avatar_color: "#FF6B00",
            },
          },
        });
        if (error) {
          setError(error.message);
        } else if (data.session) {
          onDone();
        } else {
          // email confirmation required — account created, no session yet
          setNotice("Account created! Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else onDone();
      }
    } catch {
      setError("Something went wrong — try again.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--aurora)" }} />

      <div className="relative flex items-center gap-3 px-4 h-14">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-muted" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <Logo size="sm" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div className="w-full animate-fade-in">
          <h1 className="font-heading font-extrabold text-3xl text-center">
            {mode === "signin" ? "Welcome back" : "Join Nova"}
          </h1>
          <p className="text-center text-sm text-muted mt-2">
            {mode === "signin" ? "Sign in to pick up where you left off." : "Create your account — it takes 30 seconds."}
          </p>

          {/* Tabs */}
          <div className="flex bg-surface2 rounded-full p-1 mt-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 h-9 rounded-full text-sm font-bold transition-colors ${mode === m ? "bg-surface shadow-sm text-ink" : "text-muted"}`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Display name"
                  className="w-full bg-surface2 rounded-2xl pl-11 pr-4 h-12 text-sm outline-none focus:ring-2 ring-nova-purple/40"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email address"
                className="w-full bg-surface2 rounded-2xl pl-11 pr-4 h-12 text-sm outline-none focus:ring-2 ring-nova-purple/40"
              />
            </div>
            <div className="relative">
              <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className="w-full bg-surface2 rounded-2xl pl-11 pr-4 h-12 text-sm outline-none focus:ring-2 ring-nova-purple/40"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          </div>

          {error && <p className="mt-3 text-xs text-coral font-semibold text-center">{error}</p>}
          {notice && <p className="mt-3 text-xs text-emerald-500 font-semibold text-center">{notice}</p>}

          <button
            onClick={submit}
            disabled={busy}
            className="mt-5 w-full h-12 rounded-2xl nova-gradient text-white font-heading font-bold flex items-center justify-center gap-2 shadow-lg shadow-hot-pink/25 press disabled:opacity-50"
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p className="text-[11px] text-muted text-center mt-4">
            Demo accounts: nova@demo.io · lena@demo.io · kenji@demo.io — password <b>password123</b>
          </p>
        </div>
      </div>

      <p className="relative text-center text-[11px] text-muted pb-6">
        By continuing you agree to Nova's Community Guidelines — be kind, always.
      </p>
    </div>
  );
}
