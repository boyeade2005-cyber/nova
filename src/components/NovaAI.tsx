import { Sparkles, Wand2, Search, Bookmark } from "lucide-react";
import { BottomSheet } from "./BottomSheet";

export function NovaAI({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="">
      <div className="flex flex-col items-center pt-2 pb-4">
        <div className="w-14 h-14 rounded-2xl nova-gradient flex items-center justify-center shadow-lg shadow-hot-pink/30 mb-3">
          <Sparkles size={26} className="text-white" fill="currentColor" />
        </div>
        <h3 className="font-heading font-bold text-xl">Nova AI</h3>
        <p className="text-sm text-muted mt-1 text-center">Your friendly assistant — nothing hidden, everything findable.</p>
      </div>

      <div className="space-y-2.5">
        {[
          { icon: Wand2, label: "Summarise this thread", hint: "Turn long discussions into 3 key points" },
          { icon: Search, label: "Find communities for me", hint: "Based on your interests and location" },
          { icon: Bookmark, label: "Search my Library", hint: "Find saved posts about a topic" },
        ].map(({ icon: Icon, label, hint }) => (
          <button
            key={label}
            className="w-full card !rounded-2xl p-4 flex items-center gap-3 text-left hover:border-nova-purple/50 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple shrink-0">
              <Icon size={20} />
            </span>
            <span>
              <span className="block font-bold text-sm">{label}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 bg-surface2 rounded-2xl p-4">
        <p className="text-xs font-bold text-muted mb-2">TRY ASKING</p>
        <p className="text-sm italic text-muted">"Summarise the debate in Builders of Africa about fair creator pay"</p>
      </div>
    </BottomSheet>
  );
}

export function NovaAIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open Nova AI"
      className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full nova-gradient flex items-center justify-center text-white shadow-lg shadow-hot-pink/40 active:scale-90 transition-transform"
    >
      <Sparkles size={22} fill="currentColor" />
    </button>
  );
}
