export function LogoMark({ size = 40, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`select-none ${glow ? "drop-shadow-[0_0_16px_rgba(255,106,0,0.55)]" : ""}`}
      aria-label="Nova logo"
    >
      <defs>
        <linearGradient id="nova-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6B00" />
          <stop offset="0.55" stopColor="#FF2A5F" />
          <stop offset="1" stopColor="#FFD1B3" />
        </linearGradient>
        <radialGradient id="nova-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FF6B00" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF6B00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#0D0D12" />
      <circle cx="24" cy="24" r="17" fill="url(#nova-halo)" />
      <path
        d="M24 8.5c1.9 6.8 4.7 9.5 11.5 11.5-6.8 2-9.6 4.7-11.5 11.5-1.9-6.8-4.7-9.5-11.5-11.5 6.8-2 9.6-4.7 11.5-11.5z"
        fill="url(#nova-star)"
      />
      <circle cx="35.5" cy="12.5" r="2.4" fill="#FFD1B3" />
      <circle cx="35.5" cy="12.5" r="4" fill="#FFD1B3" opacity="0.25" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  const markSize = size === "lg" ? 52 : size === "sm" ? 26 : 34;
  return (
    <span className="inline-flex items-center gap-1.5">
      <LogoMark size={markSize} />
      <span className={`font-heading font-extrabold lowercase tracking-tight ${textSize}`}>
        <span className="nova-gradient-text">nova</span>
      </span>
    </span>
  );
}
