import { useMemo, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { LANGUAGES, langName, translateText } from "../lib/translate";

/**
 * Inline "Translate" control — pick any language, see the translation.
 * `onTranslated(lang, text)` lets callers persist the result (e.g. messages.translations).
 */
export function TranslateButton({
  text,
  onTranslated,
  compact = true,
}: {
  text: string;
  onTranslated?: (lang: string, translated: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ lang: string; text: string } | null>(null);
  const [error, setError] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.includes(q)
    );
  }, [query]);

  const pick = async (code: string) => {
    setBusy(code);
    setError(false);
    try {
      const translated = await translateText(text, code);
      setResult({ lang: code, text: translated });
      onTranslated?.(code, translated);
      setOpen(false);
    } catch {
      setError(true);
    }
    setBusy(null);
  };

  return (
    <span className="inline-flex flex-col">
      <button
        onClick={() => { setResult(null); setError(false); setOpen(true); }}
        className={`${compact ? "text-[10px]" : "text-xs"} font-bold text-nova-purple flex items-center gap-1 hover:underline`}
      >
        <Languages size={compact ? 11 : 13} /> Translate
      </button>
      {result && (
        <span className="mt-1 text-sm italic text-ink/90 border-l-2 border-nova-purple/50 pl-2">
          {result.text}
          <span className="block text-[10px] not-italic text-muted mt-0.5">— {langName(result.lang)}</span>
        </span>
      )}
      {error && <span className="text-[10px] text-coral font-bold">Translation failed — try again</span>}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Translate to…">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search language…"
          className="w-full bg-surface2 rounded-2xl px-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40 mb-3"
        />
        <div className="max-h-[50vh] overflow-y-auto -mx-1">
          {list.map((l) => (
            <button
              key={l.code}
              onClick={() => void pick(l.code)}
              disabled={!!busy}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface2 text-left disabled:opacity-50"
            >
              <span>
                <span className="block text-sm font-bold">{l.name}</span>
                <span className="block text-xs text-muted">{l.native}</span>
              </span>
              {busy === l.code && <Loader2 size={16} className="animate-spin text-nova-purple" />}
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-sm text-muted py-6">No language found</p>}
        </div>
      </BottomSheet>
    </span>
  );
}
