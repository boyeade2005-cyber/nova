import { useRef } from "react";
import { Clapperboard, Home, Compass, Users, Mail, Plus, Store, Sparkles, type LucideIcon } from "lucide-react";
import type { Tab } from "../App";
import type { User } from "../data/mock";
import { Logo } from "./Logo";

const dockTabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Feed", icon: Home },
  { id: "discover", label: "Globe", icon: Compass },
  { id: "pulse", label: "Pulse", icon: Clapperboard },
  { id: "market", label: "Market", icon: Store },
  { id: "inbox", label: "Whispers", icon: Mail },
];

const sideTabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  ...dockTabs,
  { id: "communities", label: "Communities", icon: Users },
];

function NovaOrb({ onCreate, onGoLive }: { onCreate: () => void; onGoLive: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const start = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      onGoLive();
    }, 550);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const tap = () => {
    cancel();
    if (!held.current) onCreate();
    held.current = false;
  };

  return (
    <button
      onPointerDown={start}
      onPointerUp={tap}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Nova Orb — tap to create, hold for live"
      className="relative -mt-7 w-16 h-16 rounded-full nova-gradient flex items-center justify-center text-white animate-orb-pulse press select-none touch-none"
    >
      <Sparkles size={26} strokeWidth={2.2} />
    </button>
  );
}

export function BottomNav({
  active,
  onChange,
  onGoLive,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  onGoLive: () => void;
}) {
  const left = dockTabs.slice(0, 2);
  const right = dockTabs.slice(2);

  const renderTab = (t: { id: Tab; label: string; icon: LucideIcon }) => {
    const isActive = active === t.id;
    return (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className="flex flex-col items-center gap-0.5 flex-1 py-1.5"
      >
        <t.icon size={21} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-nova-purple" : "text-muted"} />
        <span className={`text-[9px] font-bold ${isActive ? "text-nova-purple" : "text-muted"}`}>
          {t.label}
        </span>
      </button>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
      <div className="glass rounded-full flex items-end justify-between px-2 shadow-2xl shadow-black/20">
        {left.map(renderTab)}
        <NovaOrb onCreate={() => onChange("create")} onGoLive={onGoLive} />
        {right.map(renderTab)}
      </div>
    </nav>
  );
}

export function Sidebar({ active, onChange, onGoLive, me, onProfile }: { active: Tab; onChange: (t: Tab) => void; onGoLive?: () => void; me?: User; onProfile?: () => void }) {
  const items = sideTabs;
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 sticky top-14 h-[calc(100dvh-3.5rem)] border-r border-line bg-surface p-4 gap-1 overflow-y-auto no-scrollbar">
      <div className="px-3 py-3">
        {me && onProfile ? (
          <button onClick={onProfile} className="flex items-center gap-3 w-full px-2 py-2 rounded-2xl hover:bg-surface2 transition-colors">
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
              style={{ background: me.avatarColor }}
            >
              {me.avatarEmoji}
            </span>
            <span className="text-left">
              <span className="block font-bold text-sm leading-tight">{me.name}</span>
              <span className="block text-[11px] text-muted">View profile</span>
            </span>
          </button>
        ) : (
          <Logo size="lg" />
        )}
      </div>
      <button
        onClick={() => onChange("create")}
        className="mx-2 mb-4 h-11 rounded-2xl nova-gradient text-white font-heading font-bold flex items-center justify-center gap-2 shadow-lg shadow-hot-pink/25 active:scale-[0.98] transition-transform"
      >
        <Plus size={20} strokeWidth={2.5} /> Create post
      </button>
      {onGoLive && (
        <button
          onClick={onGoLive}
          className="mx-2 mb-3 h-10 rounded-2xl border border-nova-purple/40 text-nova-purple font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          🔴 Go Live
        </button>
      )}
      {items.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl font-bold text-sm transition-colors ${
              isActive ? "bg-nova-lilac text-nova-purple dark:bg-white/10 dark:text-white" : "text-muted hover:bg-surface2"
            }`}
          >
            <t.icon size={20} />
            {t.label}
          </button>
        );
      })}
    </aside>
  );
}
