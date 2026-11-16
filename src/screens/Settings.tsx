import { useEffect, useState, type ReactNode } from "react";
import {
  Moon, Sun, Download, Clock, Bell, Shield, Globe, KeyRound,
  Smartphone, Fingerprint, History, BadgeCheck, LifeBuoy, Info, UserPlus, Check,
  Lock, Mail, Copy, Trash2, Heart, MessageCircle, Sparkles,
} from "lucide-react";
import { BottomSheet } from "../components/BottomSheet";
import { Avatar } from "../components/Avatar";
import { useSession } from "../lib/useSession";
import { supabase } from "../lib/supabase";
import { updateProfile } from "../lib/api";
import {
  fetchSettings, saveSettings, fetchBlocked, unblockUser,
  exportUserData, deleteOwnAccount,
  type BlockedUser,
} from "../lib/profileExtra";

const REGIONS = [
  "Global", "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "Ethiopia", "Morocco",
  "United States", "Canada", "United Kingdom", "Germany", "France", "Spain", "Italy",
  "Netherlands", "Sweden", "Poland", "United Arab Emirates", "India", "Pakistan",
  "Bangladesh", "Philippines", "Indonesia", "Vietnam", "Thailand", "Japan", "South Korea",
  "China", "Australia", "New Zealand", "Brazil", "Mexico", "Argentina", "Colombia",
];

type Sheet = "password" | "sessions" | "blocked" | "privacy" | "notifications" | "help" | "about" | "delete" | null;

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${on ? "nova-gradient" : "bg-surface2 border border-line"}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

function Row({ icon: Icon, label, hint, right, onClick }: { icon: typeof Moon; label: string; hint?: string; right?: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface2 transition-colors text-left">
      <span className="w-9 h-9 rounded-xl bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple shrink-0">
        <Icon size={17} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted truncate">{hint}</span>}
      </span>
      {right}
    </button>
  );
}

function SheetRow({ icon: Icon, label, hint, right, onClick }: { icon: typeof Moon; label: string; hint?: string; right?: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-1 py-3 hover:bg-surface2/60 rounded-xl transition-colors text-left">
      <span className="w-9 h-9 rounded-xl bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple shrink-0">
        <Icon size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right}
    </button>
  );
}

const inputCls = "w-full bg-surface2 rounded-xl px-4 h-11 text-sm outline-none focus:ring-2 ring-nova-purple/40";

export function SettingsScreen({ dark, onToggleTheme, onBack }: { dark: boolean; onToggleTheme: () => void; onBack: () => void }) {
  const { profile, authUser } = useSession();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSaving, setRegionSaving] = useState(false);
  const [referCopied, setReferCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // password sheet
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // blocked sheet
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  // delete sheet
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    void fetchSettings().then(setSettings);
  }, []);

  const pickRegion = async (r: string) => {
    setRegionSaving(true);
    await updateProfile({ country: r === "Global" ? null : r, region: r === "Global" ? null : r });
    await saveSettings({ region: r });
    setRegionSaving(false);
    setRegionOpen(false);
    window.location.reload();
  };

  const pref = (k: string) => settings[k] === true;
  const setPref = (k: string, v: boolean) => {
    setSettings((s) => ({ ...s, [k]: v }));
    void saveSettings({ [k]: v });
  };

  const openSheet = (s: Sheet) => {
    setSheet(s);
    setPwMsg(null); setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setDeleteConfirm(""); setDeleteErr(null);
    if (s === "blocked") {
      setBlockedLoading(true);
      void fetchBlocked().then((b) => { setBlocked(b); setBlockedLoading(false); });
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pwNew.length < 8) { setPwMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
    if (pwNew !== pwConfirm) { setPwMsg({ ok: false, text: "New passwords don't match." }); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwBusy(false);
    if (error) {
      setPwMsg({ ok: false, text: error.message });
    } else {
      setPwMsg({ ok: true, text: "Password updated. Other sessions may need to sign in again." });
      setPwNew(""); setPwConfirm(""); setPwCurrent("");
    }
  };

  const copyReferral = async () => {
    const url = `${window.location.origin}/?ref=${profile?.handle ?? "friend"}`;
    try {
      await navigator.clipboard.writeText(url);
      setReferCopied(true);
      setTimeout(() => setReferCopied(false), 2000);
    } catch {
      window.prompt("Copy your referral link", url);
    }
  };

  const doExport = async () => {
    setExporting(true);
    setExportMsg(null);
    const data = await exportUserData();
    setExporting(false);
    if (!data) {
      setExportMsg("Couldn't gather your data — are you signed in?");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nova-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportMsg("Export downloaded.");
  };

  const doDelete = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleteBusy(true);
    setDeleteErr(null);
    const res = await deleteOwnAccount();
    if (!res.ok) {
      setDeleteBusy(false);
      setDeleteErr(res.error ?? "Deletion failed.");
      return;
    }
    await supabase.auth.signOut();
    window.location.reload();
  };

  const unblock = async (u: BlockedUser) => {
    await unblockUser(u.id);
    setBlocked((b) => b.filter((x) => x.id !== u.id));
  };

  const email = authUser?.email ?? "No email on this account";
  const lastSignIn = authUser?.last_sign_in_at
    ? new Date(authUser.last_sign_in_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-lg border-b border-line flex items-center gap-3 px-4 h-14">
        <button onClick={onBack} className="text-nova-purple font-bold text-sm">← Back</button>
        <h1 className="font-heading font-extrabold text-lg">Settings</h1>
      </header>

      <div className="max-w-lg mx-auto py-4 divide-y divide-line">
        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1">Appearance</p>
          <Row
            icon={dark ? Sun : Moon}
            label={dark ? "Dark theme" : "Light theme"}
            hint="Saved to your account — syncs across devices"
            right={<Toggle on={dark} onClick={() => { onToggleTheme(); void saveSettings({ theme: dark ? "light" : "dark" }); }} />}
          />
          <Row
            icon={Globe}
            label="Region"
            hint="Powers the Local feed, nearby lives & regional discovery"
            right={<span className="text-sm text-muted">{profile?.country ?? "Global"}</span>}
            onClick={() => setRegionOpen(true)}
          />
        </div>

        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1 pt-3">Account</p>
          <Row icon={KeyRound} label="Change password" hint="Update your sign-in password" onClick={() => openSheet("password")} />
          <Row icon={Smartphone} label="Email" hint={email} right={<span className="text-sm text-muted">{profile?.handle ? `@${profile.handle}` : ""}</span>} />
          <Row
            icon={UserPlus}
            label="Refer a friend"
            hint="Share your link — friends who join via it are attributed to you"
            right={referCopied
              ? <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><Check size={13} /> Copied</span>
              : <Copy size={16} className="text-muted" />}
            onClick={copyReferral}
          />
        </div>

        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1 pt-3">Security</p>
          <Row icon={BadgeCheck} label="Two-factor authentication" hint="Preference saved to your account" right={<Toggle on={pref("twoFactor")} onClick={() => setPref("twoFactor", !pref("twoFactor"))} />} />
          <Row icon={Fingerprint} label="App lock" hint="Require device unlock to open Nova" right={<Toggle on={pref("appLock")} onClick={() => setPref("appLock", !pref("appLock"))} />} />
          <Row icon={Bell} label="Login alerts" hint="Notify me of new sign-ins" right={<Toggle on={pref("loginAlerts")} onClick={() => setPref("loginAlerts", !pref("loginAlerts"))} />} />
          <Row icon={History} label="Active sessions" hint="This device & sign-in details" onClick={() => openSheet("sessions")} />
          <Row icon={Shield} label="Blocked accounts" hint="People you've blocked" onClick={() => openSheet("blocked")} />
        </div>

        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1 pt-3">Privacy & safety</p>
          <Row icon={Shield} label="Privacy controls" hint="Profile visibility & online status" onClick={() => openSheet("privacy")} />
          <Row icon={Download} label="Export my data" hint="Download your profile, posts & settings as JSON" onClick={doExport} right={exporting ? <span className="text-xs text-muted">…</span> : undefined} />
          {exportMsg && <p className="px-4 pb-2 text-xs font-bold text-emerald-500">{exportMsg}</p>}
        </div>

        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1 pt-3">Wellbeing</p>
          <Row icon={Clock} label="Purposeful Use reminders" hint="Gentle nudges to take breaks" right={<Toggle on={pref("purposefulUse")} onClick={() => setPref("purposefulUse", !pref("purposefulUse"))} />} />
          <Row icon={Bell} label="Notification preferences" hint="Push, email & category controls" onClick={() => openSheet("notifications")} />
        </div>

        <div>
          <p className="px-4 text-xs font-bold uppercase tracking-wide text-muted mb-1 pt-3">Support</p>
          <Row icon={LifeBuoy} label="Help center" hint="FAQs, contact & safety info" onClick={() => openSheet("help")} />
          <Row icon={Info} label="About Nova" hint="Version 0.1.0 · Your world. Your choice." onClick={() => openSheet("about")} />
        </div>

        <div className="pt-3 px-4">
          <button onClick={() => openSheet("delete")} className="w-full h-11 rounded-2xl border border-coral/40 text-coral font-bold text-sm flex items-center justify-center gap-2">
            <Trash2 size={15} /> Delete account
          </button>
          <p className="text-center text-[11px] text-muted mt-3">Nova · made with 💜 for creators everywhere</p>
        </div>
      </div>

      {/* ---------- Change password ---------- */}
      <BottomSheet open={sheet === "password"} onClose={() => setSheet(null)} title="Change password">
        <div className="space-y-3">
          <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="Current password (for your records)" className={inputCls} autoComplete="current-password" />
          <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="New password (min 8 characters)" className={inputCls} autoComplete="new-password" />
          <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Confirm new password" className={inputCls} autoComplete="new-password" />
          {pwMsg && <p className={`text-xs font-bold ${pwMsg.ok ? "text-emerald-500" : "text-coral"}`}>{pwMsg.text}</p>}
          <button onClick={changePassword} disabled={pwBusy || !pwNew} className="w-full h-11 rounded-xl nova-gradient text-white font-bold text-sm disabled:opacity-50">
            {pwBusy ? "Updating…" : "Update password"}
          </button>
          <p className="text-[11px] text-muted text-center">You'll stay signed in on this device. Re-enter your password next time you sign in.</p>
        </div>
      </BottomSheet>

      {/* ---------- Active sessions ---------- */}
      <BottomSheet open={sheet === "sessions"} onClose={() => setSheet(null)} title="Active sessions">
        <div className="space-y-3">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500"><Smartphone size={18} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">This device</p>
                <p className="text-xs text-muted truncate">{navigator.userAgent.includes("Mobile") ? "Mobile browser" : "Desktop browser"} · {window.location.host}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-500">CURRENT</span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <p className="flex justify-between"><span className="text-muted">Signed in as</span><span className="font-bold truncate">{email}</span></p>
              {lastSignIn && <p className="flex justify-between"><span className="text-muted">Last sign-in</span><span className="font-bold">{lastSignIn}</span></p>}
            </div>
          </div>
          <p className="text-[11px] text-muted text-center">Nova keeps one active session per sign-in. Changing your password or signing out elsewhere ends other sessions.</p>
        </div>
      </BottomSheet>

      {/* ---------- Blocked accounts ---------- */}
      <BottomSheet open={sheet === "blocked"} onClose={() => setSheet(null)} title="Blocked accounts">
        {blockedLoading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
        ) : blocked.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p className="text-3xl mb-2">🛡️</p>
            <p className="font-bold text-ink">No blocked accounts</p>
            <p className="text-sm mt-1">People you block won't see your profile or contact you.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {blocked.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-surface2">
                <Avatar user={{ id: u.id, name: u.display_name ?? u.username, handle: u.username, avatarColor: u.avatar_color ?? "#FF6B00", avatarEmoji: u.avatar_emoji ?? "🦊" }} size={42} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{u.display_name ?? u.username}</p>
                  <p className="text-xs text-muted truncate">@{u.username} · blocked {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => unblock(u)} className="h-9 px-4 rounded-full border border-line text-sm font-bold hover:border-nova-purple/40">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* ---------- Privacy controls ---------- */}
      <BottomSheet open={sheet === "privacy"} onClose={() => setSheet(null)} title="Privacy controls">
        <div className="space-y-1">
          <SheetRow
            icon={Lock}
            label="Private profile"
            hint="Only approved followers can see your posts & highlights"
            right={<Toggle on={pref("privateProfile")} onClick={() => setPref("privateProfile", !pref("privateProfile"))} />}
          />
          <SheetRow
            icon={Globe}
            label="Show online status"
            hint="Let mutual followers see when you're active"
            right={<Toggle on={pref("showOnline")} onClick={() => setPref("showOnline", !pref("showOnline"))} />}
          />
          <SheetRow
            icon={Bell}
            label="Message requests"
            hint="Hold DMs from people you don't follow"
            right={<Toggle on={pref("messageRequests")} onClick={() => setPref("messageRequests", !pref("messageRequests"))} />}
          />
        </div>
        <p className="text-[11px] text-muted mt-3 text-center">Preferences are saved to your account. Enforcing private profiles across the feed is rolling out.</p>
      </BottomSheet>

      {/* ---------- Notification preferences ---------- */}
      <BottomSheet open={sheet === "notifications"} onClose={() => setSheet(null)} title="Notification preferences">
        <div className="space-y-1">
          <SheetRow icon={Bell} label="Push notifications" hint="Real-time alerts on this device" right={<Toggle on={pref("notifPush")} onClick={() => setPref("notifPush", !pref("notifPush"))} />} />
          <SheetRow icon={Mail} label="Email notifications" hint="Digests & important account emails" right={<Toggle on={pref("notifEmail")} onClick={() => setPref("notifEmail", !pref("notifEmail"))} />} />
          <SheetRow icon={Heart} label="Likes & reactions" hint="When someone reacts to your posts" right={<Toggle on={pref("notifLikes")} onClick={() => setPref("notifLikes", !pref("notifLikes"))} />} />
          <SheetRow icon={MessageCircle} label="Comments & messages" hint="New comments and whispers" right={<Toggle on={pref("notifComments")} onClick={() => setPref("notifComments", !pref("notifComments"))} />} />
          <SheetRow icon={UserPlus} label="Follows & communities" hint="New followers and community activity" right={<Toggle on={pref("notifFollows")} onClick={() => setPref("notifFollows", !pref("notifFollows"))} />} />
          <SheetRow icon={Sparkles} label="Product updates" hint="News about new Nova features" right={<Toggle on={pref("notifProduct")} onClick={() => setPref("notifProduct", !pref("notifProduct"))} />} />
        </div>
        <p className="text-[11px] text-muted mt-3 text-center">Saved to your account. Delivery respects your device's OS notification settings.</p>
      </BottomSheet>

      {/* ---------- Help center ---------- */}
      <BottomSheet open={sheet === "help"} onClose={() => setSheet(null)} title="Help center">
        <div className="space-y-3 text-sm">
          <div className="card p-4">
            <p className="font-bold mb-1">📮 Contact us</p>
            <p className="text-xs text-muted">Questions, safety reports or feedback — email <a className="text-nova-purple font-bold" href="mailto:hello@nova.app">hello@nova.app</a> and we'll get back to you.</p>
          </div>
          <div className="card p-4 space-y-2">
            <p className="font-bold">❓ Frequently asked</p>
            <p className="text-xs text-muted"><b>How do badges work?</b> They're earned automatically — post often, join communities, send voice notes and grow your Gravity score.</p>
            <p className="text-xs text-muted"><b>What are NOVA credits?</b> Universal credits for gifts, tips and marketplace purchases. Top up in Wallet.</p>
            <p className="text-xs text-muted"><b>How do I stay safe?</b> Block people from their profile, report anything suspicious, and use Privacy controls to limit visibility.</p>
          </div>
        </div>
      </BottomSheet>

      {/* ---------- About ---------- */}
      <BottomSheet open={sheet === "about"} onClose={() => setSheet(null)} title="About Nova">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl nova-gradient flex items-center justify-center text-white font-heading font-extrabold text-lg">N</div>
            <div>
              <p className="font-heading font-extrabold text-lg">Nova</p>
              <p className="text-xs text-muted">Version 0.1.0 · Your world. Your choice.</p>
            </div>
          </div>
          <p className="text-xs text-muted">A global-first social platform — posts, communities, live streams, Pulse videos, whispers and a creator marketplace, all in one warm corner of the internet.</p>
          <p className="text-[11px] text-muted">Built with React, TypeScript, Tailwind & Supabase.</p>
        </div>
      </BottomSheet>

      {/* ---------- Delete account ---------- */}
      <BottomSheet open={sheet === "delete"} onClose={() => setSheet(null)} title="Delete account">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            This permanently deletes your profile, posts, comments, messages you sent, highlights, settings and wallet. <b className="text-ink">This cannot be undone.</b>
          </p>
          <p className="text-sm font-bold">Type <span className="text-coral">DELETE</span> to confirm:</p>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className={`${inputCls} border border-coral/40`}
          />
          {deleteErr && <p className="text-xs font-bold text-coral">{deleteErr}</p>}
          <button
            onClick={doDelete}
            disabled={deleteConfirm !== "DELETE" || deleteBusy}
            className="w-full h-11 rounded-xl bg-coral text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {deleteBusy ? "Deleting…" : <><Trash2 size={15} /> Permanently delete my account</>}
          </button>
        </div>
      </BottomSheet>

      {/* ---------- Region picker ---------- */}
      <BottomSheet open={regionOpen} onClose={() => setRegionOpen(false)} title="Choose your region">
        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
          {REGIONS.map((r) => {
            const active = (profile?.country ?? "Global") === r;
            return (
              <button
                key={r}
                disabled={regionSaving}
                onClick={() => pickRegion(r)}
                className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                  active ? "nova-gradient text-white border-transparent" : "border-line text-muted hover:border-nova-purple/40"
                }`}
              >
                {active && <Check size={14} />} {r}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-3 text-center">Your posts, lives and the Local tab will use this region.</p>
      </BottomSheet>
    </div>
  );
}
