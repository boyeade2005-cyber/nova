import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet, Send, Search, X, Check, Loader2, CreditCard } from "lucide-react";
import { BottomSheet } from "../components/BottomSheet";
import { Avatar } from "../components/Avatar";
import {
  fetchWallet, fetchWalletTransactions, buyCoins, sendCoins, searchProfiles,
  type WalletTransaction,
} from "../lib/api";

const PACKAGES = [
  { cents: 500, label: "$5", coins: 50 },
  { cents: 1000, label: "$10", coins: 100, popular: true },
  { cents: 2500, label: "$25", coins: 250 },
  { cents: 5000, label: "$50", coins: 500 },
  { cents: 10000, label: "$100", coins: 1000 },
];

const KIND_LABEL: Record<string, { icon: typeof ArrowDownLeft; color: string }> = {
  topup: { icon: ArrowDownLeft, color: "text-emerald-500" },
  tip_received: { icon: ArrowDownLeft, color: "text-emerald-500" },
  earning: { icon: ArrowDownLeft, color: "text-emerald-500" },
  tip_sent: { icon: ArrowUpRight, color: "text-coral" },
  purchase: { icon: ArrowUpRight, color: "text-coral" },
  payout: { icon: ArrowUpRight, color: "text-coral" },
};

export function WalletScreen({ onBack }: { onBack: () => void }) {
  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchWallet(), fetchWalletTransactions()]).then(([w, t]) => {
      setWallet(w);
      setTxns(t);
      setLoading(false);
    });
  };
  useEffect(() => {
    load();
    // returning from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get("wallet") === "success") {
      setNotice("Payment received — your coins will appear in a moment.");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(load, 2500);
    } else if (params.get("wallet") === "cancel") {
      setNotice("Checkout cancelled.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (cents: number) => {
    setBuying(cents);
    const url = await buyCoins(cents);
    setBuying(null);
    if (url) window.location.href = url;
    else setNotice("Payments aren't configured yet — add STRIPE_SECRET_KEY to enable checkout.");
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-lg border-b border-line flex items-center gap-3 px-4 h-14">
        <button onClick={onBack} className="text-nova-purple font-bold text-sm">← Back</button>
        <h1 className="font-heading font-extrabold text-lg flex items-center gap-2"><Wallet size={18} className="text-nova-purple" /> Wallet</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {notice && (
          <div className="card p-3.5 text-sm font-semibold text-emerald-500 flex items-center gap-2">
            <Check size={16} /> {notice}
          </div>
        )}

        {/* Balance */}
        <div className="card p-6 nova-gradient text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">NOVA balance</p>
          <p className="font-heading font-extrabold text-5xl mt-1">
            {loading ? "—" : Math.floor(wallet?.balance ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-white/70 mt-1">🪙 coins · ≈ ${((wallet?.balance ?? 0) / 10).toFixed(2)} USD</p>
          <button
            onClick={() => setSendOpen(true)}
            className="mt-4 h-10 px-5 rounded-full bg-white text-nova-purple text-sm font-extrabold flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Send size={15} /> Send coins
          </button>
        </div>

        {/* Buy coins */}
        <div>
          <p className="font-heading font-bold text-sm mb-2 flex items-center gap-1.5"><CreditCard size={15} className="text-nova-purple" /> Add funds</p>
          <div className="grid grid-cols-2 gap-2">
            {PACKAGES.map((p) => (
              <button
                key={p.cents}
                onClick={() => void buy(p.cents)}
                disabled={buying !== null}
                className={`card p-4 text-left relative ${p.popular ? "ring-2 ring-nova-purple/50" : ""} ${buying === p.cents ? "opacity-60" : ""}`}
              >
                {p.popular && <span className="absolute top-2 right-2 text-[9px] font-extrabold uppercase tracking-wide text-nova-purple bg-nova-lilac dark:bg-white/10 px-1.5 py-0.5 rounded-full">Popular</span>}
                <p className="font-heading font-extrabold text-xl">{p.label}</p>
                <p className="text-xs text-muted font-semibold">{p.coins} NOVA coins</p>
                {buying === p.cents && <Loader2 size={14} className="absolute bottom-3 right-3 animate-spin text-nova-purple" />}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">Secure checkout by Stripe · 1 coin = $0.10 · coins never expire</p>
        </div>

        {/* History */}
        <div>
          <p className="font-heading font-bold text-sm mb-2">Activity</p>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
          ) : txns.length === 0 ? (
            <div className="card p-8 text-center text-muted">
              <p className="text-3xl mb-2">🪙</p>
              <p className="font-bold text-ink">No activity yet</p>
              <p className="text-sm mt-1">Buy coins or receive gifts to see your history here.</p>
            </div>
          ) : (
            <div className="card divide-y divide-line">
              {txns.map((t) => {
                const k = KIND_LABEL[t.kind] ?? KIND_LABEL.topup;
                const Icon = k.icon;
                const incoming = t.amount > 0;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${incoming ? "bg-emerald-500/15" : "bg-coral/15"}`}>
                      <Icon size={16} className={k.color} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {t.kind === "topup" ? "Coin purchase" : incoming ? `From ${t.counterparty?.name ?? "someone"}` : `To ${t.counterparty?.name ?? "someone"}`}
                      </p>
                      <p className="text-[11px] text-muted truncate">{t.note ?? t.kind} · {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                    </div>
                    <span className={`font-heading font-extrabold text-sm ${incoming ? "text-emerald-500" : "text-coral"}`}>
                      {incoming ? "+" : "−"}{Math.abs(Math.floor(t.amount)).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SendCoinsSheet open={sendOpen} onClose={() => { setSendOpen(false); load(); }} balance={wallet?.balance ?? 0} />
    </div>
  );
}

function SendCoinsSheet({ open, onClose, balance }: { open: boolean; onClose: () => void; balance: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!query.trim() || picked) { setResults([]); return; }
    const t = setTimeout(() => void searchProfiles(query, 5).then(setResults), 300);
    return () => clearTimeout(t);
  }, [query, picked]);

  const send = async () => {
    if (!picked || !amount) return;
    setBusy(true);
    setError(null);
    const res = await sendCoins(picked.id, Number(amount), "coin transfer");
    setBusy(false);
    if (res.ok) { setDone(true); setTimeout(onClose, 1200); }
    else setError(res.error === "insufficient_funds" ? "Not enough coins." : "Couldn't send — try again.");
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Send coins">
      {done ? (
        <div className="text-center py-8">
          <span className="text-5xl">✅</span>
          <p className="font-heading font-bold mt-3">Sent!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {!picked ? (
            <>
              <div className="flex items-center gap-2 bg-surface2 rounded-2xl px-4 h-11">
                <Search size={16} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoFocus
                />
                {query && <button onClick={() => setQuery("")}><X size={15} className="text-muted" /></button>}
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setPicked(u)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface2 text-left"
                  >
                    <Avatar user={{ id: u.id, name: u.display_name ?? u.username, handle: u.username, avatarColor: u.avatar_color, avatarEmoji: u.avatar_emoji, verified: u.is_verified }} size={36} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate">{u.display_name ?? u.username}</span>
                      <span className="block text-xs text-muted truncate">@{u.username}</span>
                    </span>
                  </button>
                ))}
                {query.trim() && results.length === 0 && <p className="text-center text-xs text-muted py-4">No people found.</p>}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 bg-surface2 rounded-2xl p-3">
                <Avatar user={{ id: picked.id, name: picked.display_name ?? picked.username, handle: picked.username, avatarColor: picked.avatar_color, avatarEmoji: picked.avatar_emoji }} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{picked.display_name ?? picked.username}</p>
                  <p className="text-xs text-muted">@{picked.username}</p>
                </div>
                <button onClick={() => { setPicked(null); setAmount(""); }} className="text-xs font-bold text-nova-purple">Change</button>
              </div>
              <div className="flex items-center gap-2 bg-surface2 rounded-2xl px-4 h-12">
                <span className="text-muted font-bold">🪙</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Amount"
                  inputMode="numeric"
                  className="flex-1 bg-transparent outline-none text-sm font-bold"
                  autoFocus
                />
                <button onClick={() => setAmount(String(Math.floor(balance)))} className="text-[11px] font-extrabold text-nova-purple">MAX</button>
              </div>
              {error && <p className="text-xs font-bold text-coral">{error}</p>}
              <button
                onClick={() => void send()}
                disabled={!amount || Number(amount) <= 0 || busy}
                className="w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                Send {amount ? `${Number(amount).toLocaleString()} coins` : ""}
              </button>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
