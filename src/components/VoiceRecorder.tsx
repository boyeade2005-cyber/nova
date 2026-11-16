import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2, Square } from "lucide-react";

export interface VoiceNoteResult {
  durationSec: number;
  blob?: Blob;
  transcript?: string;
  transcriptLang?: string;
}

export function VoiceRecorder({
  onSend,
  compact = false,
}: {
  onSend: (result: VoiceNoteResult) => void;
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<SpeechRecognition | null>(null);
  const transcriptParts = useRef<string[]>([]);
  const wantRecord = useRef(false);

  useEffect(() => () => {
    wantRecord.current = false;
    if (timer.current) clearInterval(timer.current);
    recognition.current?.abort();
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const startTranscription = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = ""; // auto-detect
      rec.onresult = (e) => {
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        }
        if (finalText.trim()) transcriptParts.current.push(finalText.trim());
      };
      rec.onend = () => {
        // Chrome stops recognition after silence — restart while recording
        if (wantRecord.current) {
          try { rec.start(); } catch { /* already started */ }
        }
      };
      rec.onerror = () => { /* 'not-allowed' etc — recording continues without transcript */ };
      rec.start();
      recognition.current = rec;
      setTranscribing(true);
    } catch {
      recognition.current = null;
    }
  };

  const stopTranscription = () => {
    wantRecord.current = false;
    try { recognition.current?.stop(); } catch { /* noop */ }
    recognition.current = null;
    setTranscribing(false);
  };

  const start = async () => {
    wantRecord.current = true;
    transcriptParts.current = [];
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      recorder.current = new MediaRecorder(stream.current);
      recorder.current.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      recorder.current.start();
    } catch {
      // mic unavailable — still allow timed recording for UI
    }
    startTranscription();
    setRecording(true);
    setSeconds(0);
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = (send: boolean) => {
    if (timer.current) clearInterval(timer.current);
    const secs = seconds;
    const transcript = transcriptParts.current.join(" ").trim() || undefined;
    stopTranscription();
    const rec = recorder.current;
    let blob: Blob | undefined;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (send && secs > 0) onSend({ durationSec: secs, blob, transcript });
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      rec.stop();
    } else if (send && secs > 0) {
      onSend({ durationSec: secs, transcript });
    }
    recorder.current = null;
    setRecording(false);
    setSeconds(0);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!recording) {
    return (
      <button
        onClick={start}
        className={`${compact ? "w-9 h-9" : "w-10 h-10"} rounded-full bg-surface2 flex items-center justify-center text-nova-purple shrink-0 hover:bg-nova-lilac dark:hover:bg-white/10 transition-colors`}
        aria-label="Record voice note"
      >
        <Mic size={compact ? 16 : 18} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-coral/10 border border-coral/30 rounded-full pl-3 pr-1.5 py-1.5 animate-fade-in">
      <span className="w-2.5 h-2.5 rounded-full bg-coral animate-pulse shrink-0" />
      <span className="text-xs font-extrabold text-coral tabular-nums">{fmt(seconds)}</span>
      {transcribing && <span className="text-[10px] font-bold text-muted">transcribing…</span>}
      {/* Fake live waveform */}
      <div className="flex items-end gap-[3px] h-4">
        {[0.9, 0.5, 1, 0.6, 0.8, 0.4, 0.95, 0.55, 0.75, 0.45].map((h, i) => (
          <span
            key={i}
            className="w-1 bg-coral rounded-full animate-pulse"
            style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <button onClick={() => stop(false)} className="w-8 h-8 rounded-full bg-surface2 flex items-center justify-center text-muted" aria-label="Discard">
        <Trash2 size={15} />
      </button>
      <button onClick={() => stop(true)} className="w-8 h-8 rounded-full nova-gradient flex items-center justify-center text-white" aria-label="Send voice note">
        <Send size={15} />
      </button>
    </div>
  );
}

export function VoicePlay({ duration, small = false, src }: { duration: string; small?: boolean; src?: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (src) {
      if (!audioRef.current) audioRef.current = new Audio(src);
      const a = audioRef.current;
      if (playing) { a.pause(); setPlaying(false); }
      else { void a.play(); setPlaying(true); }
      a.onended = () => setPlaying(false);
      return;
    }
    // simulated playback when no real audio file
    setPlaying((p) => !p);
  };

  if (src) {
    return (
      <span className="flex items-center gap-2 min-w-[130px]">
        <button
          onClick={toggle}
          className={`rounded-full flex items-center justify-center shrink-0 ${small ? "w-7 h-7" : "w-8 h-8"} ${playing ? "bg-nova-purple text-white" : "bg-nova-purple/15 text-nova-purple"}`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Square size={small ? 11 : 13} fill="currentColor" /> : <Mic size={small ? 12 : 14} />}
        </button>
        <audio ref={(el) => { audioRef.current = el; }} src={src} className="hidden" />
        <span className="text-[11px] font-bold text-muted tabular-nums">{duration}</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 min-w-[130px]">
      <button
        onClick={toggle}
        className={`rounded-full flex items-center justify-center shrink-0 ${small ? "w-7 h-7" : "w-8 h-8"} ${playing ? "bg-nova-purple text-white" : "bg-nova-purple/15 text-nova-purple"}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Square size={small ? 11 : 13} fill="currentColor" /> : <Mic size={small ? 12 : 14} />}
      </button>
      <span className="flex-1 flex items-end gap-[2px] h-4">
        {[0.5, 0.9, 0.4, 1, 0.6, 0.8, 0.45, 0.95, 0.55].map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${playing ? "bg-nova-purple" : "bg-nova-purple/40"}`}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </span>
      <span className="text-[11px] font-bold text-muted tabular-nums">{duration}</span>
    </span>
  );
}
