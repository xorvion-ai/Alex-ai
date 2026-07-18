"use client";

// Dashboard — stats, follow-ups, recent sweeps, AI batch analysis, quota. §Screen 4.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, QuotaDto, timeAgo } from "@/lib/client";
import { useToast } from "@/components/useToast";

type Dash = {
  stats: {
    live: number;
    analyzed: number;
    newCount: number;
    cities: number;
    sources: number;
    archivedThisMonth: number;
  };
  followUps: {
    id: number;
    leadId: number;
    kind: string;
    note: string;
    dueAt: string;
    leadName: string;
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
};

// Pace batch calls for the Gemini free-tier rate limit (~12/min max).
const BATCH_DELAY_MS = 5000;

export default function Dashboard() {
  const router = useRouter();
  const { flash, node: toastNode } = useToast();
  const [dash, setDash] = useState<Dash | null>(null);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchDone, setBatchDone] = useState(0);
  const [batchMsg, setBatchMsg] = useState("");
  const runningRef = useRef(false);

  const reload = useCallback(() => {
    api<Dash>("/api/dashboard").then(setDash).catch(() => {});
  }, []);
  useEffect(() => {
    reload();
    return () => {
      runningRef.current = false;
    };
  }, [reload]);

  async function runBatch() {
    if (batchRunning) {
      runningRef.current = false;
      setBatchRunning(false);
      return;
    }
    const remaining = dash?.stats.newCount ?? 0;
    if (!remaining) return;
    if (!batchTotal || batchDone >= batchTotal) {
      setBatchTotal(remaining + batchDone);
    }
    setBatchRunning(true);
    runningRef.current = true;
    while (runningRef.current) {
      try {
        const r = await api<{
          analyzed: { id: number; name: string; score: number } | null;
          remaining: number;
        }>("/api/analyze/step", { method: "POST" });
        if (!r.analyzed) {
          runningRef.current = false;
          setBatchRunning(false);
          setBatchMsg("");
          reload();
          break;
        }
        setBatchDone((d) => d + 1);
        setBatchMsg(`${r.analyzed.name} → ${r.analyzed.score}`);
        setDash((prev) =>
          prev
            ? {
                ...prev,
                stats: {
                  ...prev.stats,
                  analyzed: prev.stats.analyzed + 1,
                  newCount: Math.max(0, prev.stats.newCount - 1),
                },
              }
            : prev,
        );
        if (r.remaining === 0) {
          runningRef.current = false;
          setBatchRunning(false);
          reload();
          break;
        }
      } catch (e) {
        runningRef.current = false;
        setBatchRunning(false);
        if (e instanceof ApiError && e.quotaBlocked) {
          flash("⛨ Quota Guardian stopped the batch");
        } else {
          flash(e instanceof Error ? e.message : "batch failed");
        }
        break;
      }
      if (runningRef.current) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  }

  const s = dash?.stats;
  const newCount = s?.newCount ?? 0;
  const total = batchTotal || newCount;
  const pct = total ? Math.round((batchDone / total) * 100) : 0;

  const now = new Date();
  const dateStr = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .replace(/,/g, "")
    .toUpperCase();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDays = Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000);

  const anaText = batchRunning
    ? `Analyzing lead ${batchDone + 1} of ${total} — ${batchMsg || "scoring, profiling, drafting outreach…"}`
    : newCount === 0
      ? "All leads analyzed — nothing waiting."
      : batchDone > 0
        ? `Paused — ${newCount} leads still waiting for analysis.`
        : `${newCount} new leads are waiting for deep analysis (score, profile, site plan, outreach drafts).`;
  const anaBtn = batchRunning
    ? "■ PAUSE"
    : newCount === 0
      ? "DONE ✓"
      : batchDone > 0
        ? `▶ RESUME (${newCount} LEFT)`
        : `▶ ANALYZE ${newCount} NEW LEADS`;

  const quotaRow = (provider: string, name: string, todaySuffix = "") => {
    const x = dash?.quota.find((q) => q.provider === provider);
    if (!x) return null;
    const left = Math.max(0, x.limit - x.used);
    return (
      <div key={provider}>
        <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "var(--body)" }}>
          <span>{name}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--green)" }}>
            {left.toLocaleString()} left{todaySuffix}
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
    <div style={{ flex: 1, overflow: "auto", padding: "26px 30px" }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Dashboard</div>
        <div style={{ flex: 1 }} />
        <div className="mono" style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)" }}>
          {dateStr} · month resets in {resetDays} days
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 20 }}>
        {statCard("LIVE LEADS", s?.live ?? "—", `across ${s?.cities ?? 0} cities · ${s?.sources ?? 0} sources`)}
        {statCard("ANALYZED", s?.analyzed ?? "—", `${newCount} new awaiting analysis`, true)}
        {statCard(
          "CONTACTED → ARCHIVED",
          s?.archivedThisMonth ?? "—",
          <>
            this month · <a href="/api/archive">history.csv ↓</a>
          </>,
        )}
        {statCard("MONTHLY COST", "$0", "guardian armed · caps active", true)}
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card">
            <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--border)" }} className="mono">
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>
                FOLLOW-UPS DUE TODAY · {dash?.followUps.length ?? 0}
              </span>
            </div>
            {(dash?.followUps ?? []).map((f) => (
              <div
                key={f.id}
                className="hover-row"
                onClick={() => router.push(`/leads?sel=${f.leadId}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 15px",
                  borderBottom: "1px solid var(--hairline)",
                  cursor: "pointer",
                }}
              >
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--amber)", width: 44, flex: "none" }}>
                  {new Date(f.dueAt).toTimeString().slice(0, 5)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.leadName}</div>
                  <div style={{ fontSize: 11, color: "var(--sec)" }}>{f.note}</div>
                </div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)" }}>{f.kind}</div>
              </div>
            ))}
            {dash && dash.followUps.length === 0 && (
              <div className="mono" style={{ padding: "14px 15px", fontSize: 11, color: "var(--faint)" }}>
                nothing due — add follow-ups from a lead&apos;s LOG tab
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ padding: "11px 15px", borderBottom: "1px solid var(--border)" }} className="mono">
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)" }}>RECENT SWEEPS</span>
            </div>
            <div
              className="mono"
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr .6fr .6fr .7fr",
                gap: "0 10px",
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
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr .6fr .6fr .7fr",
                  gap: "0 10px",
                  padding: "9px 15px",
                  borderTop: "1px solid var(--hairline)",
                  fontSize: 12,
                  color: "var(--body)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600 }}>{sw.label}</span>
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
            <div
              onClick={runBatch}
              className="mono"
              style={{
                marginTop: 14,
                textAlign: "center",
                background: batchRunning ? "var(--panel)" : "var(--green-bg)",
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
              rate-limited to gemini free tier · resumes if stopped
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>
              FREE QUOTA REMAINING
            </div>
            {quotaRow("google_places", "google places")}
            {quotaRow("gemini", "gemini flash-lite", " today")}
            {quotaRow("brave", "brave search")}
            <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "var(--body)" }}>
              <span>openstreetmap</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--sec)" }}>unlimited · rate-limited</span>
            </div>
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
