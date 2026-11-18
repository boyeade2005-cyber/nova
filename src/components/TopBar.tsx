import { useEffect, useRef, useState } from "react";
import { Home, Clapperboard, Store, Users, Mail, Search, Bell, X, type LucideIcon } from "lucide-react";
import type { Tab } from "../App";
import type { User } from "../data/mock";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { fetchNotifications, markNotificationsRead } from "../lib/api";
import { NAV_EVENT, PROFILE_EVENT } from "../lib/profiles";

const topTabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Feed", icon: Home },
  { id: "pulse", label: "Pulse", icon: Clapperboard },
  { id: "market", label: "Market", icon: Store },
  { id: "communities", label: "Groups", icon: Users },
  { id: "inbox", label: "Whispers", icon: Mail },
];

export function TopBar({
  active,
  onChange,
  onSearch,
  onProfile,
  me,
  notifications = 0,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  onSearch: () => void;
  onProfile: () => void;
  me: User;
  notifications?: number;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notifOpen) return;
    void fetchNotifications().then(setNotifs);
    const close = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notifOpen]);

  const openNotifs = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) void markNotificationsRead();
  };

  // Deep-link a notification: post → Home scrolled to it, actor → their
  // profile, community → Groups, message → Whispers.
  const openNotif = (n: any) => {
    setNotifOpen(false);
    const actorId = n.actor?.id ?? n.actor_id;
    if (n.post_id) {
      window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { tab: "home", postId: n.post_id } }));
    } else if (actorId) {
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { userId: actorId } }));
    } else if (n.community_id) {
      window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { tab: "communities" } }));
    } else if (n.type === "message") {
      window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { tab: "inbox" } }));
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 glass border-b border-line">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 max-w-[1400px] mx-auto">
        {/* Logo */}
        <button onClick={() => onChange("home")} className="shrink-0" aria-label="Nova home">
          <Logo size="sm" />
        </button>

        {/* Center icon tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {topTabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                title={t.label}
                className="relative flex items-center justify-center w-16 h-12 rounded-xl transition-colors"
              >
                <t.icon
                  size={24}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={isActive ? "text-nova-purple" : "text-muted"}
                />
                {isActive && (
                  <span className="absolute bottom-0 inset-x-4 h-[3px] rounded-full nova-gradient" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSearch}
            className="w-10 h-10 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
            aria-label="Search"
          >
            <Search size={19} />
          </button>
          <button
            onClick={() => onChange("inbox")}
            className="relative w-10 h-10 rounded-full hover:bg-surface2 flex items-center justify-center text-muted md:hidden"
            aria-label="Messages"
          >
            <Mail size={19} />
          </button>
          <div className="relative" ref={notifRef}>
            <button
              onClick={openNotifs}
              className="relative w-10 h-10 rounded-full hover:bg-surface2 flex items-center justify-center text-muted"
              aria-label="Notifications"
            >
              <Bell size={19} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full nova-gradient text-white text-[10px] font-bold flex items-center justify-center">
                  {notifications > 9 ? "9+" : notifications}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 card !rounded-2xl overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <p className="font-heading font-bold text-sm">Notifications</p>
                  <button onClick={() => setNotifOpen(false)} className="text-muted" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <p className="text-center text-sm text-muted py-10">You're all caught up ✨</p>
                  ) : (
                    notifs.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => openNotif(n)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface2/60 text-left"
                      >
                        <Avatar
                          user={{
                            id: n.actor?.id ?? "sys", name: n.actor?.display_name ?? n.actor?.username ?? "Nova",
                            handle: n.actor?.username ?? "nova", avatarColor: n.actor?.avatar_color ?? "#FF6B00",
                            avatarEmoji: n.actor?.avatar_emoji ?? "✨",
                          }}
                          size={40}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            <b>{n.actor?.display_name ?? n.actor?.username ?? "Someone"}</b>{" "}
                            <span className="text-muted">{n.message ?? n.type}</span>
                          </p>
                          <p className="text-[11px] text-muted mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                        {!n.read && <span className="w-2.5 h-2.5 rounded-full nova-gradient mt-2 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={onProfile} aria-label="Your profile" className="ml-1">
            <Avatar user={me} size={34} />
          </button>
        </div>
      </div>
    </header>
  );
}
