import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="font-heading font-bold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-muted hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
