import { useRef, useState } from "react";
import { Image, Film, SmilePlus, Radio, Loader2, Check, CalendarClock, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { BottomSheet } from "./BottomSheet";
import { EmojiGrid } from "./EmojiPicker";
import { VoiceRecorder } from "./VoiceRecorder";
import { useSession } from "../lib/useSession";
import { createPulseVideo, uploadMedia, startLiveStream } from "../lib/api";

const fallbackUser = { id: "me", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };

interface Attachment {
  kind: "photo" | "video" | "audio";
  url: string;
  preview: string;
  label?: string;
}

export function CreateSheet({ open, onClose, onPost, onGoLive }: { open: boolean; onClose: () => void; onPost: (text: string, media?: { kind: "photo" | "video" | "audio"; url: string }[]) => void; onGoLive: () => void }) {
  const { profile } = useSession();
  const me = profile ?? fallbackUser;
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"post" | "pulse" | "live">("post");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  const pickVideo = () => fileRef.current?.click();
  const pickMedia = () => mediaRef.current?.click();

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadMedia(file);
    setUploading(false);
    if (url) {
      setVideoUrl(url);
      setVideoName(file.name);
    }
  };

  const onMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadMedia(file);
    setUploading(false);
    if (url) {
      setAttachments((a) => [...a, {
        kind: file.type.startsWith("video") ? "video" : "photo",
        url,
        preview: URL.createObjectURL(file),
      }]);
    }
  };

  const onVoice = async ({ durationSec: secs, blob }: { durationSec: number; blob?: Blob }) => {
    if (!blob) return;
    setUploading(true);
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
    const url = await uploadMedia(file);
    setUploading(false);
    if (url) {
      const mins = Math.floor(secs / 60);
      setAttachments((a) => [...a, {
        kind: "audio",
        url,
        preview: url,
        label: `Voice note · ${mins}:${String(secs % 60).padStart(2, "0")}`,
      }]);
    }
  };

  const submit = async () => {
    if (mode === "live") {
      if (scheduling) {
        if (!scheduledAt) return;
        setPublishing(true);
        await startLiveStream(text.trim() || "Scheduled live 🔴", "just-chatting", {
          scheduledAt: new Date(scheduledAt).toISOString(),
          country: profile?.country,
        });
        setPublishing(false);
        setPublished(true);
        setTimeout(() => { setPublished(false); setText(""); setScheduling(false); setScheduledAt(""); setMode("post"); onClose(); }, 900);
        return;
      }
      onGoLive();
      return;
    }
    if (mode === "pulse") {
      if (!videoUrl || publishing) return;
      setPublishing(true);
      await createPulseVideo(text.trim() || "New Pulse ⚡", videoUrl, "🎬");
      setPublishing(false);
      setPublished(true);
      setTimeout(() => {
        setPublished(false);
        setVideoUrl(null);
        setVideoName("");
        setText("");
        setMode("post");
        onClose();
      }, 900);
      return;
    }
    if (!text.trim() && attachments.length === 0) return;
    onPost(text.trim(), attachments.length ? attachments.map(({ kind, url }) => ({ kind, url })) : undefined);
    setText("");
    setAttachments([]);
    setMode("post");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={mode === "live" ? "Go Live" : mode === "pulse" ? "Create a Pulse" : "Create post"}>
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onVideo} />
      <input ref={mediaRef} type="file" accept="image/*,video/*" className="hidden" onChange={onMedia} />
      <div className="flex gap-3">
        <Avatar user={me} size={44} />
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "pulse" ? "Add a caption for your Pulse…" : mode === "live" ? "What are you going live for? (optional)" : "What's happening? Combine text, photos, video & audio"}
          rows={4}
          className="flex-1 bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40 resize-none"
        />
      </div>

      {/* Type toggle */}
      <div className="flex gap-2 mt-4">
        {([["post", "Post"], ["pulse", "⚡ Pulse"], ["live", "📡 Live"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 h-10 rounded-2xl text-sm font-bold border transition-colors ${mode === id ? "nova-gradient text-white border-transparent" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "live" && (
        <>
          <button className="mt-3 w-full h-28 rounded-2xl border-2 border-dashed border-coral/50 flex flex-col items-center justify-center text-muted gap-1">
            <Radio size={26} className="text-coral" />
            <span className="text-sm font-bold">Camera preview starts when you go live</span>
            <span className="text-[11px]">Viewers watch your camera, chat & send gifts in real time</span>
          </button>
          <button
            onClick={() => setScheduling((s) => !s)}
            className={`mt-3 w-full h-11 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border transition-colors ${scheduling ? "nova-gradient text-white border-transparent" : "border-line text-nova-purple"}`}
          >
            <CalendarClock size={16} /> {scheduling ? "Scheduling… pick a time below" : "Schedule for later instead"}
          </button>
          {scheduling && (
            <div className="mt-3">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-surface2 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-nova-purple/40"
              />
              <p className="text-[11px] text-muted mt-1.5">Viewers see a countdown and chat opens before you start.</p>
            </div>
          )}
        </>
      )}

      {mode === "pulse" && (
        <button
          onClick={pickVideo}
          disabled={uploading}
          className="mt-3 w-full h-28 rounded-2xl border-2 border-dashed border-nova-purple/40 flex flex-col items-center justify-center text-muted gap-1"
        >
          {uploading ? <Loader2 size={26} className="text-nova-purple animate-spin" /> : videoUrl ? <Check size={26} className="text-emerald-500" /> : <Film size={26} className="text-nova-purple" />}
          <span className="text-sm font-bold">
            {uploading ? "Uploading…" : videoUrl ? `✓ ${videoName || "Video ready"}` : "Tap to upload a video · vertical 9:16"}
          </span>
        </button>
      )}

      {mode === "post" && (
        <>
          {/* Media attachments */}
          {attachments.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {attachments.map((a, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface2 flex items-center justify-center">
                  {a.kind === "audio" ? (
                    <span className="text-xl">🎙️</span>
                  ) : (
                    <img src={a.preview} alt="" className="w-full h-full object-cover" />
                  )}
                  {a.label && (
                    <span className="absolute bottom-0 inset-x-0 text-[8px] font-bold text-white bg-black/50 text-center truncate px-0.5">
                      {a.label}
                    </span>
                  )}
                  <button
                    onClick={() => setAttachments((aa) => aa.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-nova-purple">
              <Loader2 size={14} className="animate-spin" /> Uploading…
            </div>
          )}

          <div className="flex items-center gap-1 mt-4">
            <button
              onClick={pickMedia}
              className="w-10 h-10 rounded-full hover:bg-surface2 flex items-center justify-center text-nova-purple"
              aria-label="Add photo or video"
            >
              <Image size={19} />
            </button>
            <VoiceRecorder compact onSend={(r) => void onVoice(r)} />
            <button
              onClick={() => setShowEmojis((s) => !s)}
              className={`w-10 h-10 rounded-full flex items-center justify-center ${showEmojis ? "bg-nova-lilac dark:bg-white/10 text-nova-purple" : "hover:bg-surface2 text-nova-purple"}`}
              aria-label="Insert emoji"
            >
              <SmilePlus size={19} />
            </button>
          </div>

          {showEmojis && (
            <div className="mt-3">
              <EmojiGrid onPick={(e) => { setText((t) => t + e); setShowEmojis(false); }} />
            </div>
          )}
        </>
      )}

      <button
        onClick={() => void submit()}
        disabled={(mode === "pulse" && (!videoUrl || publishing)) || (mode === "post" && !text.trim() && attachments.length === 0) || (mode === "live" && scheduling && !scheduledAt) || published}
        className="mt-4 w-full h-11 rounded-2xl nova-gradient text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform"
      >
        {published ? "Scheduled! 🎉" : publishing ? "Scheduling…" : mode === "live" ? (scheduling ? "Schedule live" : "🔴 Go live now") : mode === "pulse" ? "Share to Pulse" : "Share post"}
      </button>
    </BottomSheet>
  );
}
