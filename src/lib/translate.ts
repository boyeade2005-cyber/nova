// Voice-note & text translation — powered by the free Google Translate endpoint.
// Works for any of the ~100 supported languages; source language is auto-detected.

export interface LangOption {
  code: string;
  name: string;
  native: string;
}

export const LANGUAGES: LangOption[] = [
  { code: "en", name: "English", native: "English" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "fa", name: "Persian", native: "فارسی" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "si", name: "Sinhala", native: "සිංහල" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "tl", name: "Filipino", native: "Filipino" },
  { code: "my", name: "Burmese", native: "မြန်မာ" },
  { code: "km", name: "Khmer", native: "ខ្មែរ" },
  { code: "lo", name: "Lao", native: "ລາວ" },
  { code: "ka", name: "Georgian", native: "ქართული" },
  { code: "hy", name: "Armenian", native: "Հայերեն" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycanca" },
  { code: "kk", name: "Kazakh", native: "Қазақша" },
  { code: "uz", name: "Uzbek", native: "Oʻzbekcha" },
  { code: "sw", name: "Swahili", native: "Kiswahili" },
  { code: "am", name: "Amharic", native: "አማርኛ" },
  { code: "ha", name: "Hausa", native: "Hausa" },
  { code: "yo", name: "Yoruba", native: "Yorùbá" },
  { code: "ig", name: "Igbo", native: "Igbo" },
  { code: "zu", name: "Zulu", native: "isiZulu" },
  { code: "xh", name: "Xhosa", native: "isiXhosa" },
  { code: "af", name: "Afrikaans", native: "Afrikaans" },
  { code: "st", name: "Sesotho", native: "Sesotho" },
  { code: "sn", name: "Shona", native: "chiShona" },
  { code: "rw", name: "Kinyarwanda", native: "Kinyarwanda" },
  { code: "mg", name: "Malagasy", native: "Malagasy" },
  { code: "jw", name: "Javanese", native: "Basa Jawa" },
  { code: "su", name: "Sundanese", native: "Basa Sunda" },
  { code: "jv", name: "Javanese", native: "Basa Jawa" },
  { code: "ceb", name: "Cebuano", native: "Binisaya" },
  { code: "haw", name: "Hawaiian", native: "ʻŌlelo Hawaiʻi" },
  { code: "mi", name: "Maori", native: "Māori" },
  { code: "sm", name: "Samoan", native: "Gagana Samoa" },
  { code: "to", name: "Tongan", native: "Lea Faka-Tonga" },
  { code: "fj", name: "Fijian", native: "Vosa Vakaviti" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl ayisyen" },
  { code: "eu", name: "Basque", native: "Euskara" },
  { code: "ca", name: "Catalan", native: "Català" },
  { code: "gl", name: "Galician", native: "Galego" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "sk", name: "Slovak", native: "Slovenčina" },
  { code: "sl", name: "Slovenian", native: "Slovenščina" },
  { code: "hr", name: "Croatian", native: "Hrvatski" },
  { code: "sr", name: "Serbian", native: "Српски" },
  { code: "bg", name: "Bulgarian", native: "Български" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "et", name: "Estonian", native: "Eesti" },
  { code: "lv", name: "Latvian", native: "Latviešu" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "no", name: "Norwegian", native: "Norsk" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "is", name: "Icelandic", native: "Íslenska" },
  { code: "ga", name: "Irish", native: "Gaeilge" },
  { code: "cy", name: "Welsh", native: "Cymraeg" },
  { code: "mt", name: "Maltese", native: "Malti" },
  { code: "sq", name: "Albanian", native: "Shqip" },
  { code: "mk", name: "Macedonian", native: "Македонски" },
  { code: "bs", name: "Bosnian", native: "Bosanski" },
  { code: "be", name: "Belarusian", native: "Беларуская" },
  { code: "mn", name: "Mongolian", native: "Монгол" },
  { code: "bo", name: "Tibetan", native: "བོད་སྐད" },
  { code: "dz", name: "Dzongkha", native: "རྫོང་ཁ" },
];
const seen = new Set<string>();
export const LANGUAGE_LIST = LANGUAGES.filter((l) => (seen.has(l.code) ? false : (seen.add(l.code), true)));

export function langName(code: string): string {
  return LANGUAGE_LIST.find((l) => l.code === code)?.name ?? code;
}

/** Translate `text` into `targetLang` (ISO-639-1 code). Source is auto-detected. */
export async function translateText(text: string, targetLang: string): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    `&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate failed: ${res.status}`);
  const data = await res.json();
  const parts: string[] = (data?.[0] ?? []).map((seg: unknown[]) => String(seg?.[0] ?? ""));
  const out = parts.join("").trim();
  if (!out) throw new Error("empty translation");
  return out;
}
