"use client";

// Dashboard — stats, follow-ups, recent sweeps, AI batch analysis, quota. §Screen 4.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api, QuotaDto, timeAgo } from "@/lib/client";
import { useToast } from "@/components/useToast";
import { batch, getSnapshot, subscribe } from "@/lib/analyze-store";
import Flag from "@/components/Flag";

type Dash = {
  stats: {
    live: number;
    inList: number;
    logged: number;
    analyzed: number;
    newCount: number;
    cities: number;
    sources: number;
    archivedThisMonth: number;
  };
  contactedTotal: number;
  contacted: {
    id: number;
    leadId: number;
    kind: string;
    note: string;
    createdAt: string;
    leadName: string;
    country: string | null;
    dueAt?: string | null;
  }[];
  sweeps: {
    id: number;
    label: string;
    when: string;
    found: number;
    added: number;
    requests: number;
    status: string;
  }[];
  quota: QuotaDto;
  /** Google Cloud free-trial end date, "YYYY-MM-DD" (null = none set) */
  trialEndsAt: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const { flash, node: toastNode } = useToast();
  const [dash, setDash] = useState<Dash | null>(null);

  // CONTACTED LIST — leads you have contacted, searchable and paged (the
  // dashboard payload only carries the first page).
  // Google's own Places count (Cloud Monitoring), when console sync is set up.
  const [gconsole, setGconsole] = useState<{ configured: boolean; places: number | null } | null>(null);

  const [logRows, setLogRows] = useState<Dash["contacted"] | null>(null);
  const [logTotal, setLogTotal] = useState(0);
  // Batch scope: which country / business type the ANALYZE button works through.
  const [scopeCountry, setScopeCountry] = useState("");
  const [scopeCategory, setScopeCategory] = useState("");
  const [queue, setQueue] = useState<{
    total: number;
    byCountry: { country: string; n: number }[];
    byCategory: { category: string; n: number }[];
  } | null>(null);

  const loadQueue = useCallback(() => {
    const q = new URLSearchParams();
    if (scopeCountry) q.set("country", scopeCountry);
    if (scopeCategory) q.set("category", scopeCategory);
    api<{
      total: number;
      byCountry: { country: string; n: number }[];
      byCategory: { category: string; n: number }[];
    }>(`/api/analyze/queue?${q}`)
      .then(setQueue)
      .catch(() => {});
  }, [scopeCountry, scopeCategory]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const [logSearch, setLogSearch] = useState("");
  const [logLimit, setLogLimit] = useState(10);

  // TRASH - leads deleted in the last hour (manually, or automatically
  // when a web check found a website). Purged for good after that.
  type Deleted = {
    id: number;
    name: string;
    phone: string | null;
    country: string | null;
    category: string | null;
    reason: "deleted" | "has_website";
    foundSite: string | null;
    expiresInMs: number;
  };
  const [deleted, setDeleted] = useState<Deleted[] | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [restoring, setRestoring] = useState(0);

  const loadDeleted = useCallback(() => {
    api<{ deleted: Deleted[] }>("/api/trash")
      .then((r) => setDeleted(r.deleted))
      .catch(() => {});
  }, []);

  // The batch lives in a module store so it keeps running when you leave this
  // page (see analyze-store.ts).
  const b = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const lastToast = useRef(b.toast?.seq ?? 0);

  const reload = useCallback(() => {
    api<Dash>("/api/dashboard").then(setDash).catch(() => {});
  }, []);
  useEffect(() => {
    loadDeleted();
    const t = setInterval(loadDeleted, 60000);
    return () => clearInterval(t);
  }, [loadDeleted]);

  useEffect(() => {
    reload();
    api<{ configured: boolean; places: number | null }>("/api/quota/console")
      .then(setGconsole)
      .catch(() => {});
  }, [reload]);

  // surface store toasts, and refresh the counters when a batch finishes
  useEffect(() => {
    if (b.toast && b.toast.seq > lastToast.current) {
      lastToast.current = b.toast.seq;
      flash(b.toast.msg);
    }
  }, [b.toast, flash]);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !b.running) {
      reload();
      loadQueue();
    }
    wasRunning.current = b.running;
  }, [b.running, reload, loadQueue]);

  useEffect(() => {
    const q = new URLSearchParams({ limit: String(logLimit) });
    if (logSearch.trim()) q.set("search", logSearch.trim());
    const t = setTimeout(() => {
      api<{ activities: Dash["contacted"]; total: number }>(`/api/activities?${q}`)
        .then((r) => {
          setLogRows(r.activities);
          setLogTotal(r.total);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [logSearch, logLimit]);

  const s = dash?.stats;
  // While a batch runs, the server's own "remaining" count is fresher than the
  // dashboard payload (which was fetched before the batch started).
  const scoped = queue?.total ?? s?.newCount ?? 0;
  const newCount = b.running ? (b.remaining ?? scoped) : scoped;
  const total = b.total || newCount;
  const pct = total ? Math.round((b.done / total) * 100) : 0;

  const now = new Date();
  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .replace(/,/g, "")
    .toUpperCase();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDays = Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000);

  const scopeLabel = [scopeCategory || null, scopeCountry ? `leads in ${scopeCountry}` : "new leads"]
    .filter(Boolean)
    .join(" ")
    .replace("new leads", scopeCategory ? "leads" : "new leads");

  const anaText = b.running
    ? `Analyzing lead ${b.done + 1} of ${total} — ${b.msg || "scoring, profiling, drafting outreach…"} · keeps running while you browse`
    : newCount === 0
      ? "All leads analyzed — nothing waiting."
      : b.done > 0
        ? `Paused — ${newCount} leads still waiting for analysis.`
        : `${newCount} ${scopeLabel} waiting for deep analysis (score, profile, site plan, outreach drafts).`;
  const anaBtn = b.running
    ? "■ PAUSE"
    : newCount === 0
      ? "DONE ✓"
      : b.done > 0
        ? `▶ RESUME (${newCount} LEFT)`
        : `▶ ANALYZE ${newCount} NEW LEADS`;

  // Google Cloud free trial: show the end date and days left, amber in the last
  // week. Editable in Settings (clear it after upgrading).
  // Whole calendar days between today and the end date — counting from local
  // midnight so a partial day never rounds the number up.
  const trialDaysLeft = (() => {
    if (!dash?.trialEndsAt) return null;
    const [y, m, d] = dash.trialEndsAt.split("-").map(Number);
    if (!y || !m || !d) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((new Date(y, m - 1, d).getTime() - today) / 86400000);
  })();
  const trialSub =
    trialDaysLeft == null ? (
      "guardian armed · caps active"
    ) : (
      <>
        guardian armed · caps active
        <br />
        <span
          className="mono"
          style={{ fontSize: 10.5, color: trialDaysLeft <= 7 ? "var(--amber)" : "var(--sec)" }}
        >
          {(() => {
            const when = new Date(dash!.trialEndsAt!).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            if (trialDaysLeft < 0) return `gcp trial ended ${when}`;
            if (trialDaysLeft === 0) return `gcp trial ends today (${when})`;
            return `gcp trial ends ${when} · ${trialDaysLeft}d left`;
          })()}
        </span>
      </>
    );

  const quotaRow = (provider: string, name: string) => {
    const x = dash?.quota.find((q) => q.provider === provider);
    if (!x) return null;
    const left = Math.max(0, x.limit - x.used);
    const window = x.period === "day" ? "today" : "this month";
    return (
      <div key={provider}>
        <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "var(--body)" }}>
          <span>{name}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--green)" }}>
            {left.toLocaleString()} left {window}
          </span>
        </div>
        <div className="bar" style={{ margin: "6px 0 12px" }}>
          <i style={{ width: `${Math.min(100, Math.round((x.used / x.limit) * 100))}%` }} />
        </div>
      </div>
    );
  };

  const statCard = (label: string, value: React.ReactNode, sub: React.ReactNode, green = false) => (
    <div className="card" style={{ padding: 16 }}>
      <div className="lbl" style={{ fontSize: 9.5 }}>{label}</div>
      <div
        className="mono"
        style={{ fontSize: 34, fontWeight: 700, marginTop: 6, color: green ? "var(--green)" : "var(--text)" }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--sec)", marginTop: 4 }}>{sub}</div>
    </div>
  );

  return (
    <div className="pg">
      <div className="pg-head" style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Dashboard</div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>
          {dateStr} · month resets in {resetDays} days
        </div>
      </div>

      <div className="grid3" style={{ marginTop: 20 }}>
        {statCard(
          "LIVE LEADS",
          s?.live ?? "—",
          <>
            {s?.inList ?? 0} in the list · {s?.logged ?? 0} contacted
            <br />
            <span style={{ color: "var(--muted)" }}>
              across {s?.cities ?? 0} cities · {s?.sources ?? 0} sources
            </span>
          </>,
        )}
        {statCard("ANALYZED", s?.analyzed ?? "—", `${newCount} new awaiting analysis`, true)}
        {statCard("MONTHLY COST", "$0", trialSub, true)}
      </div>

      <div className="cols" style={{ marginTop: 14 }}>
        <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card">
            <div
              className="mono hover-row"
              onClick={() => {
                setShowDeleted((v) => !v);
                loadDeleted();
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", cursor: "pointer" }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>
                TRASH · {deleted?.length ?? 0}
              </span>
              <span style={{ fontSize: 9.5, color: "var(--faint)" }}>kept 1 hour, then gone for good</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{showDeleted ? "\u25be" : "\u25b8"}</span>
            </div>
            {showDeleted &&
              (deleted?.length ? (
                deleted.map((x) => (
                  <div
                    key={x.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 15px",
                      borderTop: "1px solid var(--hairline)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
                        <Flag country={x.country} size={15} />
                        {x.name}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--sec)" }}>
                        {[x.phone, x.category].filter(Boolean).join(" \u00b7 ")}
                        {x.reason === "has_website" ? " \u00b7 auto-deleted: has a website" : " \u00b7 deleted by you"}
                        {x.foundSite ? " (" + x.foundSite + ")" : ""}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--amber)", flex: "none" }}>
                      {Math.max(1, Math.round(x.expiresInMs / 60000))}m left
                    </span>
                    <span
                      className="mono"
                      onClick={async () => {
                        if (restoring) return;
                        setRestoring(x.id);
                        try {
                          await api("/api/trash/" + x.id + "/restore", { method: "POST" });
                          flash(x.name + " restored to your leads");
                          loadDeleted();
                          reload();
                        } catch (e) {
                          flash(e instanceof Error ? e.message : "restore failed");
                        } finally {
                          setRestoring(0);
                        }
                      }}
                      style={{
                        flex: "none",
                        border: "1px solid var(--green-border)",
                        background: "var(--green-bg)",
                        color: "var(--green)",
                        borderRadius: 5,
                        padding: "4px 10px",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {restoring === x.id ? "\u2026" : "RESTORE"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="mono" style={{ padding: "12px 15px", borderTop: "1px solid var(--hairline)", fontSize: 11, color: "var(--faint)" }}>
                  nothing deleted in the last hour
                </div>
              ))}
          </div>

          <div className="card">
            <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--border)" }} className="mono">
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>
                CONTACTED LIST · {logTotal}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 15px", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
              <input
                className="input in-panel mono"
                style={{ flex: 1, minWidth: 150, padding: "6px 9px", fontSize: 11.5 }}
                placeholder="/ search contacted lead or phone"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setLogLimit(10);
                }}
              />
            </div>
            {(logRows ?? dash?.contacted ?? []).map((a) => (
              <div
                key={a.id}
                className="hover-row"
                onClick={() => router.push(`/leads?sel=${a.leadId}`)}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "11px 15px",
                  borderBottom: "1px solid var(--hairline)",
                  alignItems: "baseline",
                  cursor: "pointer",
                }}
              >
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", width: 74, flex: "none" }}>
                  {a.kind}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
                    <Flag country={a.country} size={15} />
                    {a.leadName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--sec)" }}>
                    {a.note}
                    {a.dueAt && (
                      <span className="mono" style={{ color: "var(--amber)", fontSize: 10.5 }}>
                        {" "}
                        · due {new Date(a.dueAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", flex: "none" }}>
                  {timeAgo(a.createdAt)}
                </span>
              </div>
            ))}
            {logRows && logRows.length === 0 && (
              <div className="mono" style={{ padding: "14px 15px", fontSize: 11, color: "var(--faint)" }}>
                {logSearch
                  ? "nothing matches this search"
                  : "nothing here yet — press ✓ CONTACTED on a lead"}
              </div>
            )}
            {logRows && logRows.length < logTotal && (
              <div
                className="mono"
                onClick={() => setLogLimit((n) => n + 25)}
                style={{ padding: "11px 15px", fontSize: 10.5, fontWeight: 600, color: "var(--green)", cursor: "pointer", textAlign: "center" }}
              >
                SHOW MORE ▾ ({logTotal - logRows.length} more)
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--green-border)", borderRadius: 8, padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>AI BATCH ANALYSIS</div>
            <div style={{ fontSize: 12.5, color: "var(--body)", marginTop: 8, lineHeight: 1.5 }}>{anaText}</div>
            <div style={{ height: 5, background: "var(--border)", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "var(--green)",
                  borderRadius: 3,
                  transition: "width .25s",
                }}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <select
                className="input in-panel mono"
                value={scopeCountry}
                onChange={(e) => setScopeCountry(e.target.value)}
                disabled={b.running}
                style={{ flex: 1, minWidth: 130, padding: "6px 8px", fontSize: 11 }}
              >
                <option value="">all countries</option>
                {(queue?.byCountry ?? []).map((c) => (
                  <option key={c.country} value={c.country === "\u2014" ? "" : c.country}>
                    {c.country} ({c.n})
                  </option>
                ))}
              </select>
              <select
                className="input in-panel mono"
                value={scopeCategory}
                onChange={(e) => setScopeCategory(e.target.value)}
                disabled={b.running}
                style={{ flex: 1, minWidth: 130, padding: "6px 8px", fontSize: 11 }}
              >
                <option value="">all business types</option>
                {(queue?.byCategory ?? []).map((c) => (
                  <option key={c.category} value={c.category === "\u2014" ? "" : c.category}>
                    {c.category} ({c.n})
                  </option>
                ))}
              </select>
            </div>
            <div
              onClick={() => batch.toggle(newCount, { country: scopeCountry, category: scopeCategory })}
              className="mono"
              style={{
                marginTop: 14,
                textAlign: "center",
                background: b.running ? "var(--panel)" : "var(--green-bg)",
                color: "var(--green)",
                border: "1px solid var(--green-border)",
                borderRadius: 6,
                padding: "9px 0",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: ".5px",
              }}
            >
              {anaBtn}
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 10 }}>
              rate-limited to gemini free tier · runs in the background · resumes if stopped
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>
              FREE QUOTA REMAINING
            </div>
            {quotaRow("google_places", "google places")}
            <div
              className="mono"
              style={{ display: "flex", fontSize: 9.5, fontWeight: 500, color: "var(--faint)", margin: "-6px 0 12px" }}
            >
              <span>google console</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: gconsole?.places != null ? "var(--sec)" : "var(--faint)" }}>
                {gconsole?.places != null
                  ? `${gconsole.places.toLocaleString()} requests this month · live`
                  : gconsole?.configured
                    ? "unavailable"
                    : "not connected — see .env.example"}
              </span>
            </div>
            {quotaRow("gemini", "gemini flash-lite")}
            {quotaRow("tomtom", "tomtom")}
            {quotaRow("tavily", "tavily verify")}
            {quotaRow("fx", "currency rates")}
            {quotaRow("gcp_monitoring", "console sync")}
            <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "var(--body)" }}>
              <span>openstreetmap</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--sec)" }}>unlimited · rate-limited</span>
            </div>
          </div>

          <div className="card">
            <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--border)" }} className="mono">
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>RECENT SWEEPS</span>
            </div>
            <div
              className="mono sweeps-grid"
              style={{
                padding: "8px 15px 4px",
                fontSize: 9,
                fontWeight: 600,
                color: "var(--faint)",
              }}
            >
              <span>QUERY</span>
              <span>WHEN</span>
              <span>FOUND</span>
              <span>NEW</span>
              <span>REQUESTS</span>
            </div>
            {(dash?.sweeps ?? []).map((sw) => (
              <div
                key={sw.id}
                className="sweeps-grid"
                style={{
                  padding: "9px 15px",
                  borderTop: "1px solid var(--hairline)",
                  fontSize: 12,
                  color: "var(--body)",
                  alignItems: "center",
                }}
              >
                <span className="sweep-q" style={{ fontWeight: 600 }}>{sw.label}</span>
                <span style={{ color: "var(--sec)", fontSize: 11 }}>{timeAgo(sw.when)}</span>
                <span className="mono">{sw.found}</span>
                <span className="mono" style={{ color: "var(--green)" }}>{sw.added}</span>
                <span className="mono" style={{ color: "var(--sec)" }}>{sw.requests}</span>
              </div>
            ))}
            {dash && dash.sweeps.length === 0 && (
              <div className="mono" style={{ padding: "14px 15px", fontSize: 11, color: "var(--faint)" }}>
                no sweeps yet — run one from Discover
              </div>
            )}
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
