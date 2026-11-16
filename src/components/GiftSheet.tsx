import { useEffect, useState } from "react";
import { gifts, type Gift } from "../data/mock";
import { BottomSheet } from "./BottomSheet";
import { fetchWallet, sendGift } from "../lib/api";

export function GiftSheet({
  open,
  onClose,
  onSend,
  tipTo,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (gift: Gift) => void;
  /** Profile id of the gift recipient (live host, pulse creator…). */
  tipTo?: string;
}) {
  const [coins, setCoins] = useState(0);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      void fetchWallet().then((w) => setCoins(Math.floor(w?.balance ?? 0)));
    }
  }, [open]);

  const send = async (g: Gift) => {
    if (coins < g.coins || busy) return;
    setBusy(true);
    setError("");
    try {
      await sendGift(g.coins, tipTo, `Gift: ${g.name}`);
      setCoins((c) => c - g.coins);
      onSend(g);
      setSent(g.id);
      setTimeout(() => setSent(null), 1200);
    } catch {
      setError("Not enough NOVA credits — top up in your wallet.");
    }
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Send a gift">
      <div className="flex items-center justify-between mb-4 bg-surface2 rounded-2xl px-4 py-3">
        <span className="text-sm font-bold text-muted">Your balance</span>
        <span className="font-heading font-extrabold text-nova-purple">🪙 {coins.toLocaleString()} NOVA</span>
      </div>
      {error && <p className="text-xs text-coral font-semibold text-center mb-2">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        {gifts.map((g) => (
          <button
            key={g.id}
            onClick={() => void send(g)}
            disabled={coins < g.coins || busy}
            className={`relative card p-4 flex flex-col items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 ${sent === g.id ? "ring-2 ring-nova-purple" : ""}`}
          >
            <span
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: g.gradient }}
            >
              {g.emoji}
            </span>
            <span className="text-xs font-bold">{g.name}</span>
            <span className="text-[11px] text-muted font-semibold">🪙 {g.coins}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted text-center mt-4">
        Gifts go straight to the creator — 90% of every coin reaches them. 💜
      </p>
    </BottomSheet>
  );
}
