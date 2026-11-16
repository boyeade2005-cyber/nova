import { EMOJIS } from "../lib/socialExtra";

export function EmojiGrid({ onPick, active }: { onPick: (emoji: string) => void; active?: string }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-transform hover:scale-110 ${active === e ? "bg-nova-lilac dark:bg-white/10 ring-2 ring-nova-purple/50" : "hover:bg-surface2"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
