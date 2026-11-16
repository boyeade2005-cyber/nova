import { Image, Video, Smile, SmilePlus, MapPin, X, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { EmojiGrid } from "./EmojiPicker";
import { VoiceRecorder } from "./VoiceRecorder";
import { uploadMedia } from "../lib/api";
import { useSession } from "../lib/useSession";

const fallbackUser = { id: "me", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };

export interface ComposerMedia {
  kind: "photo" | "video" | "audio";
  url: string;
  preview: string;
  label?: string;
}

const FEELINGS = [
  "happy", "excited", "blessed", "grateful", "motivated", "productive",
  "creative", "adventurous", "calm", "nostalgic", "proud", "loved",
];

export function Composer({
  onPost,
  onLive,
}: {
  onPost: (text: string, media?: { kind: "photo" | "video" | "audio"; url: string }[]) => void;
  onLive?: () => void;
}) {
  const { profile } = useSession();
  const me = profile ?? fallbackUser;
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sheet, setSheet] = useState<"feeling" | "location" | "emoji" | null>(null);
  const [location, setLocation] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pickMedia = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setExpanded(true);
    const url = await uploadMedia(file);
    setUploading(false);
    if (url) {
      setMedia((m) => [...m, { kind: file.type.startsWith("video") ? "video" : "photo", url, preview: URL.createObjectURL(file) }]);
    }
  };

  const appendText = (snippet: string) => {
    setText((t) => (t.trim() ? `${t.trimEnd()}\n\n${snippet}` : snippet));
    setExpanded(true);
  };

  const pickFeeling = (f: string) => {
    appendText(`feeling ${f}`);
    setSheet(null);
  };

  const addLocation = () => {
    const loc = location.trim();
    if (loc) appendText(`📍 ${loc}`);
    setLocation("");
    setSheet(null);
  };

  const pickEmoji = (emoji: string) => {
    setText((t) => t + emoji);
    setExpanded(true);
  };

  const onVoice = async ({ durationSec: secs, blob, transcript }: { durationSec: number; blob?: Blob; transcript?: string }) => {
    const mins = Math.floor(secs / 60);
    const label = `Voice note · ${mins}:${String(secs % 60).padStart(2, "0")}`;
    let url: string | null = null;
    if (blob) {
      setUploading(true);
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      url = await uploadMedia(file);
      setUploading(false);
    }
    if (url) {
      setMedia((m) => [...m, { kind: "audio", url, preview: url, label }]);
      setExpanded(true);
    }
    if (transcript) appendText(`🎙️ ${transcript}`);
  };

  const submit = () => {
    if (!text.trim() && media.length === 0) return;
    onPost(text.trim(), media.length ? media.map(({ kind, url }) => ({ kind, url })) : undefined);
    setText("");
    setMedia([]);
    setExpanded(false);
  };

  const firstName = me.name.split(" ")[0];

  return (
    <div className="card mx-3 sm:mx-0 mb-4 !rounded-xl overflow-hidden">
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />

      {/* FB-style: avatar + "What's on your mind" pill */}
      <div className="flex gap-3 p-4 pb-3">
        <Avatar user={me} size={40} />
        <div className="flex-1">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-left bg-surface2 hover:bg-surface2/70 rounded-full px-4 py-2.5 text-muted text-[15px] transition-colors"
            >
              What's on your mind, {firstName}?
            </button>
          ) : (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => !text && !media.length && setExpanded(false)}
              placeholder={`What's on your mind, ${firstName}?`}
              rows={3}
              className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none"
            />
          )}
        </div>
      </div>

      {media.length > 0 && (
        <div className="flex gap-2 px-4 pb-3">
          {media.map((m, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface2 flex items-center justify-center">
              {m.kind === "audio" ? (
                <span className="text-2xl">🎙️</span>
              ) : (
                <img src={m.preview} alt="" className="w-full h-full object-cover" />
              )}
              {m.label && (
                <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white bg-black/50 rounded px-1 truncate text-center">
                  {m.label}
                </span>
              )}
              <button
                onClick={() => setMedia((mm) => mm.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs font-bold text-nova-purple">
          <Loader2 size={14} className="animate-spin" /> Uploading media…
        </div>
      )}

      {/* Action row — always visible like Facebook */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-line mx-2 mb-2 rounded-xl">
        <div className="flex gap-1">
          <button
            onClick={pickMedia}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface2 text-sm font-semibold text-nova-purple transition-colors"
          >
            <Image size={20} /> <span className="hidden sm:inline">Photo/video</span>
          </button>
          {onLive && (
            <button
              onClick={onLive}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface2 text-sm font-semibold text-coral transition-colors"
            >
              <Video size={20} /> <span className="hidden sm:inline">Live video</span>
            </button>
          )}
          <VoiceRecorder compact onSend={(r) => void onVoice(r)} />
          <button
            onClick={() => setSheet("feeling")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface2 text-sm font-semibold text-amber-500 transition-colors"
          >
            <Smile size={20} /> <span className="hidden sm:inline">Feeling</span>
          </button>
          <button
            onClick={() => setSheet("location")}
            className="w-9 h-9 rounded-lg hover:bg-surface2 hidden md:flex items-center justify-center text-nova-purple"
            aria-label="Add location"
          >
            <MapPin size={18} />
          </button>
          <button
            onClick={() => setSheet("emoji")}
            className="w-9 h-9 rounded-lg hover:bg-surface2 hidden md:flex items-center justify-center text-nova-purple"
            aria-label="Insert emoji"
          >
            <SmilePlus size={18} />
          </button>
        </div>
        {(expanded || media.length > 0) && (
          <button
            onClick={submit}
            disabled={(!text.trim() && media.length === 0) || uploading}
            className="px-5 h-9 rounded-full nova-gradient text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
          >
            Post
          </button>
        )}
      </div>

      {/* Feeling picker */}
      <BottomSheet open={sheet === "feeling"} onClose={() => setSheet(null)} title="How are you feeling?">
        <div className="grid grid-cols-2 gap-2">
          {FEELINGS.map((f) => (
            <button
              key={f}
              onClick={() => pickFeeling(f)}
              className="h-11 rounded-2xl bg-surface2 hover:bg-nova-lilac dark:hover:bg-white/10 font-bold text-sm capitalize transition-colors"
            >
              feeling {f}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Location picker */}
      <BottomSheet open={sheet === "location"} onClose={() => setSheet(null)} title="Add a location">
        <input
          autoFocus
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLocation()}
          placeholder="e.g. Tokyo, Japan"
          className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40"
        />
        <button
          onClick={addLocation}
          disabled={!location.trim()}
          className="mt-3 w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40"
        >
          Add location
        </button>
      </BottomSheet>

      {/* Emoji picker */}
      <BottomSheet open={sheet === "emoji"} onClose={() => setSheet(null)} title="Insert an emoji">
        <EmojiGrid onPick={pickEmoji} />
      </BottomSheet>
    </div>
  );
}
