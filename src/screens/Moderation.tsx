import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, Eye, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import {
  fetchReports,
  isAdmin,
  resolveReport,
  type ContentReport,
  type ReportStatus,
} from "../lib/moderation";

type StatusFilter = ReportStatus | "all";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const STATUS_STYLES: Record<ReportStatus, string> = {
  open: "bg-coral/15 text-coral",
  reviewing: "bg-amber-500/15 text-amber-500",
  actioned: "bg-emerald-500/15 text-emerald-500",
  dismissed: "bg-surface2 text-muted",
};

function reporterName(report: ContentReport): string {
  return report.reporter?.display_name ?? report.reporter?.username ?? "Unknown reporter";
}

function reporterHandle(report: ContentReport): string {
  return report.reporter?.username ? `@${report.reporter.username}` : "Reporter unavailable";
}

export function ModerationScreen({ onBack }: { onBack: () => void }) {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    const rows = await fetchReports(status);
    setReports(rows);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    let mounted = true;
    void isAdmin().then((ok) => {
      if (!mounted) return;
      setAdmin(ok);
      if (!ok) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load, refreshKey]);

  const changeStatus = (next: StatusFilter) => {
    setStatus(next);
    setLoading(true);
  };

  const refresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const resolve = async (report: ContentReport, next: ReportStatus) => {
    setBusyId(report.id);
    setActionError(null);
    const result = await resolveReport(report.id, next);
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.error ?? "Could not update this report.");
      return;
    }
    setLoading(true);
    await load();
  };

  if (admin === false) {
    return (
      <div className="min-h-screen bg-bg">
        <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-lg border-b border-line flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="text-nova-purple font-bold text-sm">← Back</button>
          <h1 className="font-heading font-extrabold text-lg">Moderation</h1>
        </header>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <ShieldCheck size={42} className="mx-auto text-muted mb-4" />
          <h2 className="font-heading font-extrabold text-xl">Admins only</h2>
          <p className="text-sm text-muted mt-2">Your account doesn't have access to the moderation queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-lg border-b border-line">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="text-nova-purple font-bold text-sm">← Back</button>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading font-extrabold text-lg flex items-center gap-2">
              <ShieldCheck size={19} className="text-nova-purple" /> Moderation
            </h1>
          </div>
          <button
            onClick={refresh}
            className="w-9 h-9 rounded-full bg-surface2 flex items-center justify-center text-muted hover:text-ink"
            aria-label="Refresh reports"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => changeStatus(filter.id)}
              className={`h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap border transition-colors ${
                status === filter.id
                  ? "nova-gradient text-white border-transparent"
                  : "bg-surface2 text-muted border-line hover:border-nova-purple/40"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {actionError && (
          <p className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{actionError}</p>
        )}

        {loading || admin === null ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="card mt-6 p-10 text-center">
            <ShieldCheck size={40} className="mx-auto text-emerald-500 mb-3" />
            <h2 className="font-heading font-extrabold text-lg">Queue is clear</h2>
            <p className="text-sm text-muted mt-1">No {status === "all" ? "" : status} reports found.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {reports.map((report) => {
              const busy = busyId === report.id;
              return (
                <article key={report.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-nova-lilac dark:bg-white/10 flex items-center justify-center text-nova-purple font-heading font-extrabold shrink-0">
                      {(reporterName(report)[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-sm truncate">{reporterName(report)}</h2>
                        <span className="text-xs text-muted truncate">{reporterHandle(report)}</span>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full ${STATUS_STYLES[report.status]}`}>
                          {report.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="px-2 py-1 rounded-full bg-surface2 font-bold">{report.target_type}</span>
                        <span className="font-mono">{report.target_id.slice(0, 8)}…</span>
                        <span className="flex items-center gap-1">
                          <Clock3 size={12} /> {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-surface2 p-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Report</p>
                    <p className="mt-1 text-sm font-bold">{report.reason ?? "No reason provided"}</p>
                    {report.details && <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{report.details}</p>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {report.status !== "reviewing" && (
                      <button
                        onClick={() => void resolve(report, "reviewing")}
                        disabled={busy}
                        className="h-10 px-4 rounded-full bg-surface2 border border-line text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Eye size={15} /> Reviewing
                      </button>
                    )}
                    <button
                      onClick={() => void resolve(report, "actioned")}
                      disabled={busy}
                      className="h-10 px-4 rounded-full bg-emerald-500/15 text-emerald-500 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Action taken
                    </button>
                    <button
                      onClick={() => void resolve(report, "dismissed")}
                      disabled={busy}
                      className="h-10 px-4 rounded-full bg-coral/15 text-coral text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={15} /> Dismiss
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
