import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a real QR code (data URL) for the given text — e.g. a profile URL. */
export function QRCodeImage({ value, size = 64, className = "" }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#14141F", light: "#ffffff" },
    })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value, size]);

  if (!src) {
    return <div className={`skeleton ${className}`} style={{ width: size, height: size }} />;
  }
  return <img src={src} width={size} height={size} alt="QR code" className={className} />;
}
