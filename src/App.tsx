import { useState, useEffect } from "react";
import { Welcome } from "./screens/Welcome";
import { AuthScreen } from "./screens/Auth";
import { HomeScreen } from "./screens/Home";
import { DiscoverScreen } from "./screens/Discover";
import { CommunitiesScreen } from "./screens/Communities";
import { InboxScreen } from "./screens/Inbox";
import { ProfileScreen } from "./screens/Profile";
import { SettingsScreen } from "./screens/Settings";
import { PulseScreen } from "./screens/Pulse";
import { MarketScreen } from "./screens/Market";
import { SearchScreen } from "./screens/Search";
import { LiveScreen } from "./screens/Live";
import { WalletScreen } from "./screens/Wallet";
import { BottomNav, Sidebar } from "./components/Nav";
import { NovaAIButton, NovaAI } from "./components/NovaAI";
import { CreateSheet } from "./components/CreateSheet";
import { Splash } from "./components/Splash";
import { CallManager } from "./components/CallManager";
import { TopBar } from "./components/TopBar";
import { makeLocalPost, type User, type Post, type MediaItem } from "./data/mock";
import { createRemotePost, fetchNotifications, getSuggestedProfiles } from "./lib/api";
import { ensureDM, DM_EVENT, DM_STORAGE_KEY } from "./lib/profileExtra";
import { useSession } from "./lib/useSession";

export type Tab = "home" | "discover" | "pulse" | "create" | "market" | "communities" | "inbox" | "profile";

export default function App() {
  const { session, profile, loading } = useSession();
  const fallbackUser: User = { id: "me", name: "You", handle: "you", avatarColor: "#FF6B00", avatarEmoji: "🦊" };
  const me = profile ?? fallbackUser;
  const [splash, setSplash] = useState(true);
  const [authStage, setAuthStage] = useState<"welcome" | "auth">("welcome");
  const [tab, setTab] = useState<Tab>("home");
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("nova-theme");
    if (saved) return saved === "dark";
    return true; // Midnight Velvet defaults to obsidian
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("nova-theme", dark ? "dark" : "light");
  }, [dark]);
  const [aiOpen, setAiOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifCount, setNotifCount] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    void fetchNotifications().then((ns) => setNotifCount(ns.filter((n: any) => !n.read).length));
    void getSuggestedProfiles(6).then(setContacts);
  }, []);

  const handleTab = (t: Tab) => {
    if (t === "create") {
      setCreateOpen(true);
      return;
    }
    if (t === "profile") {
      setTab("profile");
      return;
    }
    setTab(t);
  };

  const messageSeller = (userId: string) => {
    void ensureDM(userId).then((convoId) => {
      if (convoId) {
        localStorage.setItem(DM_STORAGE_KEY, convoId);
        window.dispatchEvent(new CustomEvent(DM_EVENT, { detail: convoId }));
      }
      setTab("inbox");
    });
  };

  const addPost = (text: string, media?: { kind: "photo" | "video" | "audio"; url: string }[]) => {
    const mediaItems: MediaItem[] | undefined = media?.length
      ? media.map((m) => ({
          kind: m.kind, url: m.url,
          gradient: "linear-gradient(135deg,#FF6B00,#FF2A5F)",
          emoji: m.kind === "video" ? "🎬" : "📷",
        }))
      : undefined;
    void createRemotePost(text, [], media).then((id) => {
      if (!id) return;
      setPosts((ps) => ps.some((p) => p.id === id) ? ps : [makeLocalPost(me, text, id, mediaItems), ...ps]);
    });
  };

  return (
    <>
      {splash && <Splash onDone={() => setSplash(false)} />}

      {loading ? null : !session ? (
        authStage === "welcome" ? (
          <Welcome onNext={() => setAuthStage("auth")} />
        ) : (
          <AuthScreen onDone={() => setAuthStage("auth")} onBack={() => setAuthStage("welcome")} />
        )
      ) : showWallet ? (
        <WalletScreen onBack={() => setShowWallet(false)} />
      ) : showSettings ? (
        <SettingsScreen dark={dark} onToggleTheme={() => setDark((d) => !d)} onBack={() => setShowSettings(false)} />
      ) : (
        <div className="min-h-screen bg-bg text-ink">
          <TopBar
            active={tab}
            onChange={handleTab}
            onSearch={() => setSearchOpen(true)}
            onProfile={() => setTab("profile")}
            me={me}
            notifications={notifCount}
          />

          <div className="pt-14 flex">
            <Sidebar active={tab} onChange={handleTab} onGoLive={() => setGoLiveOpen(true)} me={me} onProfile={() => setTab("profile")} />

            <main className="flex-1 min-w-0">
              <div className="max-w-2xl mx-auto">
                {tab === "home" && <HomeScreen posts={posts} setPosts={setPosts} onGoLive={() => setGoLiveOpen(true)} />}
                {tab === "discover" && <DiscoverScreen onCommunities={() => setTab("communities")} />}
                {tab === "pulse" && <PulseScreen />}
                {tab === "market" && <MarketScreen onMessageSeller={messageSeller} />}
                {tab === "communities" && <CommunitiesScreen />}
                {tab === "inbox" && <InboxScreen />}
                {tab === "profile" && (
                  <ProfileScreen dark={dark} onToggleTheme={() => setDark((d) => !d)} onSettings={() => setShowSettings(true)} onCommunities={() => setTab("communities")} onWallet={() => setShowWallet(true)} />
                )}
              </div>
            </main>

            {/* Right rail — Facebook-style contacts + Nova AI */}
            <aside className="hidden xl:flex flex-col w-72 shrink-0 sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto no-scrollbar border-l border-line p-4 gap-4">
              <div className="card p-4">
                <p className="font-heading font-bold text-sm mb-3">✨ Nova AI</p>
                <p className="text-xs text-muted">Summarise threads, find communities, search your Library.</p>
                <button
                  onClick={() => setAiOpen(true)}
                  className="mt-3 w-full h-10 rounded-xl nova-gradient text-white text-sm font-bold"
                >
                  Ask Nova
                </button>
              </div>
              <div className="card p-4">
                <p className="font-heading font-bold text-sm mb-1">🔍 Global search</p>
                <p className="text-xs text-muted mb-3">Find people, chats, posts and communities.</p>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-full h-9 rounded-xl bg-surface2 text-sm font-bold text-nova-purple"
                >
                  Search Nova
                </button>
              </div>
              {contacts.length > 0 && (
                <div className="card p-4">
                  <p className="font-heading font-bold text-sm mb-3">Contacts</p>
                  <div className="space-y-0.5">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setTab("inbox")}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-surface2 transition-colors text-left"
                      >
                        <span className="relative shrink-0">
                          <span
                            className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                            style={{ background: c.avatar_color ?? "#FF6B00" }}
                          >
                            {c.avatar_emoji ?? "🦊"}
                          </span>
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface" />
                        </span>
                        <span className="text-sm font-semibold truncate">{c.display_name ?? c.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="card p-4">
                <p className="font-heading font-bold text-sm mb-2">Your feed, your rules</p>
                <p className="text-xs text-muted">Nothing hidden. Every post explains why you saw it.</p>
              </div>
            </aside>
          </div>

          <BottomNav active={tab} onChange={handleTab} onGoLive={() => setGoLiveOpen(true)} />
          {tab !== "pulse" && <NovaAIButton onClick={() => setAiOpen(true)} />}
          <NovaAI open={aiOpen} onClose={() => setAiOpen(false)} />
          <CreateSheet
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onPost={addPost}
            onGoLive={() => { setCreateOpen(false); setGoLiveOpen(true); }}
          />
          {searchOpen && <SearchScreen onClose={() => setSearchOpen(false)} />}
          {goLiveOpen && <LiveScreen host={me} onClose={() => setGoLiveOpen(false)} />}
          <CallManager />
        </div>
      )}
    </>
  );
}
