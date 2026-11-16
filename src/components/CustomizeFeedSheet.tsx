import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { feedTopics } from "../data/mock";
import { BottomSheet } from "./BottomSheet";

export function CustomizeFeedSheet({
  open,
  onClose,
  sliders,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  sliders: Record<string, number>;
  onChange: (topic: string, value: number) => void;
  onReset: () => void;
}) {
  const [style, setStyle] = useState<"balanced" | "focused" | "wild">("balanced");

  return (
    <BottomSheet open={open} onClose={onClose} title="Customize your feed">
      <p className="text-sm text-muted mb-4">
        You control what you see. Nothing is hidden — these sliders just decide what floats to the top.
      </p>

      {/* Feed style */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Feed style</p>
        <div className="grid grid-cols-3 gap-2">
          {(["balanced", "focused", "wild"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`h-10 rounded-2xl font-bold text-sm capitalize border transition-colors ${
                style === s
                  ? "nova-gradient text-white border-transparent"
                  : "border-line text-muted hover:bg-surface2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">
          {style === "balanced" && "A healthy mix of everything you like."}
          {style === "focused" && "Deep on your top interests, fewer surprises."}
          {style === "wild" && "More unexpected finds and new voices."}
        </p>
      </div>

      {/* Topic sliders */}
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Topic sliders</p>
      <div className="space-y-4">
        {feedTopics.map((topic) => {
          const value = sliders[topic] ?? 50;
          return (
            <div key={topic}>
              <div className="flex justify-between text-sm font-bold mb-1">
                <span>{topic}</span>
                <span className="text-muted">{value}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => onChange(topic, Number(e.target.value))}
                className="w-full accent-[#2F6BFF] h-2 cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={onReset}
        className="mt-6 w-full h-11 rounded-2xl border border-line font-bold text-sm text-muted hover:bg-surface2 flex items-center justify-center gap-2 transition-colors"
      >
        <RotateCcw size={16} /> Reset my feed
      </button>
    </BottomSheet>
  );
}
