"use client";

// Leads — split view: filterable list + full detail with 5 tabs. §Screen 6.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CountryDropdown from "@/components/CountryDropdown";
import { useToast } from "@/components/useToast";
import {
  ActivityDto,
  AnalysisDto,
  api,
  ApiError,
  LeadDto,
  scoreColor,
  scoreLabel,
  timeAgo,
} from "@/lib/client";
import { CATEGORIES } from "@/lib/categories";

type Detail = { lead: LeadDto; analysis: AnalysisDto | null; activities: ActivityDto[] };
type Tab = "analysis" | "data" | "plan" | "log" | "outreach";

const FILTER_CATS = CATEGORIES.map((c) => c.id).slice(0, 5);

function buildParams(f: {
  search: string;
  country: string;
  city: string;
  cats: string[];
  source: string;
  ws: { none: boolean; social_only: boolean };
  minScore: number;
  verified: boolean;
}): string {
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.country && f.country !== "🌍 Global") p.set("country", f.country);
  if (f.city) p.set("city", f.city);
  if (f.cats.length && !f.cats.includes("any")) p.set("category", f.cats.join(","));
  if (f.source !== "all") p.set("source", f.source);
  const ws = Object.entries(f.ws).filter(([, v]) => v).map(([k]) => k);
  if (ws.length === 1) p.set("ws", ws[0]);
  if (f.minScore > 0) p.set("minScore", String(f.minScore));
  if (f.verified) p.set("verified", "1");
  return p.toString();
}

function LeadsInner() {
  const searchParams = useSearchParams();
  const { flash, node: toastNode } = useToast();

  const [rows, setRows] = useState<LeadDto[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("analysis");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");
  const [noteText, setNoteText] = useState("");
  const [followOpen, setFollowOpen] = useState(false);
  const [followAt, setFollowAt] = useState("");
  const [followKind, setFollowKind] = useState("CALL");
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("🌍 Global");
  const [cityF, setCityF] = useState("");
  const [cats, setCats] = useState<string[]>(["any"]);
  const [source, setSource] = useState<"all" | "google" | "osm">("all");
  const [ws, setWs] = useState({ none: true, social_only: true });
  const [minScore, setMinScore] = useState(0);
  const [verified, setVerified] = useState(false);
  const [moreCats, setMoreCats] = useState(false);

  const filterState = { search, country, city: cityF, cats, source, ws, minScore, verified };

  const loadRows = useCallback(
    async (selectFirst = false, preferId: number | null = null) => {
      const qs = buildParams(filterState);
      const r = await api<{ leads: LeadDto[] }>(`/api/leads${qs ? `?${qs}` : ""}`);
      setRows(r.leads);
      if (preferId && r.leads.some((l) => l.id === preferId)) {
        setSelId(preferId);
      } else if (selectFirst || (selId != null && !r.leads.some((l) => l.id === selId))) {
        setSelId(r.leads[0]?.id ?? null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, country, cityF, cats, source, ws, minScore, verified, selId],
  );

  useEffect(() => {
    const want = Number(searchParams.get("sel")) || null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows(true, want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    api<Detail>(`/api/leads/${selId}`)
      .then((d) => {
        setDetail(d);
        setTab("analysis");
        setNoteText("");
        setFollowOpen(false);
      })
      .catch(() => setDetail(null));
  }, [selId]);

  // live match count while filter panel open
  useEffect(() => {
    if (!filtersOpen) return;
    const t = setTimeout(() => {
      api<{ count: number }>(`/api/leads?countOnly=1&${buildParams(filterState)}`)
        .then((r) => setMatchCount(r.count))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersOpen, search, country, cityF, cats, source, ws, minScore, verified]);

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => loadRows(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleCat(id: string) {
    setCats((prev) => {
      if (id === "any") return ["any"];
      const withoutAny = prev.filter((c) => c !== "any");
      const next = withoutAny.includes(id)
        ? withoutAny.filter((c) => c !== id)
        : [...withoutAny, id];
      return next.length ? next : ["any"];
    });
  }

  function copy(key: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    setCopied(key);
    copiedTimer.current = setTimeout(() => setCopied(""), 1500);
  }

  async function act(
    key: string,
    fn: () => Promise<void>,
    doneMsg?: string,
  ): Promise<void> {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (doneMsg) flash(doneMsg);
    } catch (e) {
      if (e instanceof ApiError && e.quotaBlocked) flash("⛨ Quota Guardian blocked this");
      else flash(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy("");
    }
  }

  const refreshDetail = async () => {
    if (selId == null) return;
    const d = await api<Detail>(`/api/leads/${selId}`);
    setDetail(d);
    setRows((rs) => rs.map((r) => (r.id === d.lead.id ? d.lead : r)));
  };

  const L = detail?.lead ?? null;
  const A = detail?.analysis ?? null;

  const analyzeAction = () =>
    act(
      "analyze",
      async () => {
        await api(`/api/leads/${selId}/analyze`, { method: "POST" });
        await refreshDetail();
      },
      "Analysis complete ✓",
    );

  const verifyAction = () =>
    act(
      "verify",
      async () => {
        const r = await api<{ verifiedNoWebsite: boolean; foundSite: string | null }>(
          `/api/leads/${selId}/verify`,
          { method: "POST" },
        );
        await refreshDetail();
        flash(
          r.verifiedNoWebsite
            ? "Verified: no website anywhere ✓"
            : `Found a site: ${r.foundSite ?? "?"}`,
        );
      },
    );

  const refreshAction = () =>
    act(
      "refresh",
      async () => {
        const r = await api<{ hasSiteNow: boolean }>(`/api/leads/${selId}/refresh`, {
          method: "POST",
        });
        await refreshDetail();
        flash(r.hasSiteNow ? "⚠ business now has a website" : "Refreshed ✓");
      },
    );

  const contactedAction = () => {
    if (!L) return;
    if (!window.confirm(`Archive & delete "${L.name}"?\n\nIt will be appended to contacted-history.csv and removed from the app permanently.`)) return;
    act(
      "contacted",
      async () => {
        await api(`/api/leads/${selId}/contacted`, { method: "POST" });
        setDetail(null);
        setSelId(null);
        await loadRows(true);
      },
      "Archived to history.csv ✓",
    );
  };

  const addActivity = async (kind: string, dueAt?: string) => {
    const note = noteText.trim();
    if (!note || selId == null) return;
    await api(`/api/leads/${selId}/activities`, {
      method: "POST",
      body: JSON.stringify({ kind, note, dueAt }),
    });
    setNoteText("");
    setFollowOpen(false);
    setFollowAt("");
    await refreshDetail();
    flash(dueAt ? "Follow-up set ⏰" : "Note added ✓");
  };

  const planCopyText = () =>
    L && A
      ? [
          `Build a simple, mobile-first website for this small business:`,
          ``,
          `BUSINESS: ${L.name}`,
          `CATEGORY: ${L.category ?? L.types?.[0] ?? "?"}`,
          `ADDRESS: ${L.address ?? "?"}${L.city ? `, ${L.city}` : ""}${L.country ? `, ${L.country}` : ""}`,
          `PHONE: ${L.phone ?? "?"}`,
          `HOURS: ${L.hours ?? "?"}`,
          L.rating ? `GOOGLE RATING: ${L.rating}★ (${L.reviewCount} reviews)` : "",
          ``,
          `PROFILE: ${A.businessProfile}`,
          ``,
          `CONTENT ANGLE: ${A.sitePlan.contentAngle}`,
          ``,
          `SELLING POINTS:`,
          ...A.sitePlan.sellingPoints.map((p) => `- ${p}`),
          ``,
          `PAGES: ${A.sitePlan.suggestedPages.join(", ")}`,
        ]
          .filter((l) => l !== "")
          .join("\n")
      : "";

  const dataPairs: [string, string][] = L
    ? [
        ["source", L.source === "google" ? "google_places" : "openstreetmap"],
        ["source_id", L.sourceId],
        ["category", L.category ?? L.types?.[0] ?? "—"],
        ["price_level", L.priceLevel ?? "—"],
        ["address", L.address ?? "—"],
        ["phone", L.phone ?? "—"],
        ["rating", L.rating ? `${L.rating} ★` : "—"],
        ["reviews", L.reviewCount != null ? String(L.reviewCount) : "—"],
        ["website_status", L.websiteStatus],
        [
          "verified_no_site",
          L.verifiedNoWebsite == null
            ? "null — not checked"
            : `${L.verifiedNoWebsite} · ${timeAgo(L.verifiedAt)}`,
        ],
        ["hours", L.hours ?? "—"],
        ["language_hint", L.languageHint ?? "—"],
        ["first_seen", L.firstSeenAt?.slice(0, 10) ?? "—"],
        ["last_refreshed", `${L.lastRefreshedAt?.slice(0, 10)} (${timeAgo(L.lastRefreshedAt)})`],
        ["socials", (L.socials ?? []).join(" · ") || "—"],
        ["map", L.mapsUri ?? "—"],
      ]
    : [];

  const segBtn = (on: boolean) =>
    ({
      flex: 1,
      textAlign: "center" as const,
      padding: "5px 0",
      borderRadius: 4,
      cursor: "pointer",
      background: on ? "var(--green-bg)" : "var(--field)",
      color: on ? "var(--green)" : "var(--sec)",
      border: `1px solid ${on ? "var(--green-border)" : "var(--border)"}`,
    });

  const railCard = (title: string, children: React.ReactNode) => (
    <div className="card" style={{ padding: "12px 13px" }}>
      <div className="lbl" style={{ fontSize: 9.5, marginBottom: 7 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
      {/* LEFT: list */}
      <div
        style={{
          width: 400,
          flex: "none",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 0, padding: "8px 10px", fontSize: 12.5 }}
              placeholder="/ search leads"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div
              className="mono"
              onClick={() => setFiltersOpen((o) => !o)}
              style={{
                background: "var(--green-bg)",
                border: "1px solid var(--green-border)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--green)",
                cursor: "pointer",
              }}
            >
              FILTERS {filtersOpen ? "▴" : "▾"}
            </div>
          </div>

          {filtersOpen && (
            <div className="card" style={{ marginTop: 10, padding: 12, borderRadius: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div className="lbl" style={{ fontSize: 9, marginBottom: 4 }}>COUNTRY</div>
                  <CountryDropdown value={country} onChange={setCountry} small inPanel />
                </div>
                <div>
                  <div className="lbl" style={{ fontSize: 9, marginBottom: 4 }}>CITY / AREA</div>
                  <input
                    className="input in-panel"
                    style={{ padding: "7px 9px", fontSize: 12, borderRadius: 5 }}
                    placeholder="any"
                    value={cityF}
                    onChange={(e) => setCityF(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>BUSINESS TYPE</div>
                <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 10, fontWeight: 500 }}>
                  {["any", ...(moreCats ? CATEGORIES.map((c) => c.id).filter((c) => c !== "any") : FILTER_CATS.filter((c) => c !== "any"))].map((id) => (
                    <span
                      key={id}
                      className={`chip in-panel${cats.includes(id) ? " on" : ""}`}
                      onClick={() => toggleCat(id)}
                    >
                      {id}
                      {cats.includes(id) && id !== "any" ? " ×" : ""}
                    </span>
                  ))}
                  <span
                    style={{ padding: "4px 9px", color: "var(--muted)", cursor: "pointer" }}
                    onClick={() => setMoreCats((m) => !m)}
                  >
                    {moreCats ? "− less" : `+ ${CATEGORIES.length - FILTER_CATS.length} more`}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <div>
                  <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>SOURCE</div>
                  <div className="mono" style={{ display: "flex", gap: 4, fontSize: 10, fontWeight: 600 }}>
                    {(["all", "google", "osm"] as const).map((k) => (
                      <span key={k} style={segBtn(source === k)} onClick={() => setSource(k)}>
                        {k.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>WEBSITE STATUS</div>
                  <div className="mono" style={{ display: "flex", gap: 4, fontSize: 10, fontWeight: 600 }}>
                    {(["none", "social_only"] as const).map((k) => (
                      <span
                        key={k}
                        style={segBtn(ws[k])}
                        onClick={() =>
                          setWs((w) => {
                            const next = { ...w, [k]: !w[k] };
                            return next.none || next.social_only ? next : w;
                          })
                        }
                      >
                        {k === "none" ? "NONE" : "SOCIAL"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="mono"
                style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, fontSize: 10.5, fontWeight: 500, color: "var(--sec)" }}
              >
                <span>
                  SCORE ≥ <span style={{ color: "var(--text)" }}>{minScore}</span>
                </span>
                <input
                  type="range"
                  className="slider"
                  style={{ flex: 1 }}
                  min={0}
                  max={100}
                  step={5}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                />
                <span
                  style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                  onClick={() => setVerified((v) => !v)}
                >
                  <span
                    style={{
                      width: 24,
                      height: 13,
                      borderRadius: 7,
                      background: verified ? "var(--green-border)" : "var(--border)",
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        [verified ? "right" : "left"]: 1,
                        top: 1,
                        width: 11,
                        height: 11,
                        borderRadius: "50%",
                        background: verified ? "var(--green)" : "var(--muted)",
                      }}
                    />
                  </span>
                  VERIFIED ✓
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <div
                  className="btn-green mono"
                  style={{ flex: 1, padding: "7px 0", fontSize: 11, borderRadius: 5 }}
                  onClick={() => {
                    loadRows(true);
                    setFiltersOpen(false);
                  }}
                >
                  APPLY{matchCount != null ? ` — ${matchCount} MATCH` : ""}
                </div>
                <div
                  className="btn-outline"
                  style={{ padding: "7px 12px", fontSize: 11, borderRadius: 5 }}
                  onClick={() => {
                    setCountry("🌍 Global");
                    setCityF("");
                    setCats(["any"]);
                    setSource("all");
                    setWs({ none: true, social_only: true });
                    setMinScore(0);
                    setVerified(false);
                  }}
                >
                  RESET
                </div>
                <a
                  className="btn-outline"
                  style={{ padding: "7px 12px", fontSize: 11, borderRadius: 5 }}
                  href={`/api/leads/export?${buildParams(filterState)}`}
                >
                  CSV ↓
                </a>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {rows.map((r) => {
            const on = r.id === selId;
            return (
              <div
                key={r.id}
                className="hover-row-light"
                onClick={() => setSelId(r.id)}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--hairline)",
                  cursor: "pointer",
                  background: on ? "var(--panel)" : undefined,
                  borderLeft: on ? "2px solid var(--green)" : "2px solid transparent",
                }}
              >
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: scoreColor(r.score), width: 30, flex: "none" }}>
                  {r.score ?? "—"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}{" "}
                    <span
                      className="mono"
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        color: r.source === "google" ? "var(--google)" : "var(--osm)",
                        border: `1px solid ${r.source === "google" ? "var(--google-bd)" : "var(--osm-bd)"}`,
                        borderRadius: 3,
                        padding: "1px 4px",
                        verticalAlign: 2,
                      }}
                    >
                      {r.source === "google" ? "G" : "OSM"}
                    </span>
                    {r.isDemo && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: "var(--amber)",
                          border: "1px solid #52452a",
                          borderRadius: 3,
                          padding: "1px 4px",
                          verticalAlign: 2,
                          marginLeft: 4,
                        }}
                      >
                        DEMO
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--sec)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[
                      r.category ?? r.types?.[0],
                      r.rating ? `★${r.rating}·${r.reviewCount}` : null,
                      r.area ?? r.city,
                      r.verifiedNoWebsite ? "verified ✓" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    color: r.websiteStatus === "social_only" ? "var(--amber)" : "var(--faint)",
                    flex: "none",
                  }}
                >
                  {r.websiteStatus === "social_only" ? "SOCIAL" : "NO_SITE"}
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="mono" style={{ padding: 20, fontSize: 11, color: "var(--faint)" }}>
              no leads match — run a sweep in Discover or reset filters
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: detail */}
      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {!L ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              select a lead — or discover new ones
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>
                    LEAD_{String(L.id).padStart(4, "0")} · {L.status.toUpperCase()} · source:{" "}
                    {L.source === "google" ? "GOOGLE" : "OSM"} · refreshed {timeAgo(L.lastRefreshedAt)} ⟳
                    {L.verifiedNoWebsite ? " · VERIFIED_NO_WEBSITE ✓" : ""}
                    {L.isDemo && <span style={{ color: "var(--amber)" }}> · DEMO_LEAD — archive me when done exploring</span>}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.3px" }}>{L.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--sec)", marginTop: 4 }}>
                    {[L.category ?? L.types?.[0], L.address, L.rating ? `★ ${L.rating} (${L.reviewCount})` : null, L.priceLevel]
                      .filter(Boolean)
                      .join(" · ")}
                    {L.mapsUri && (
                      <>
                        {" · "}
                        <a href={L.mapsUri} target="_blank" rel="noreferrer">
                          maps ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    flex: "none",
                    textAlign: "center",
                    background: "var(--panel)",
                    border: "1px solid var(--green-border)",
                    borderRadius: 8,
                    padding: "10px 18px",
                  }}
                >
                  <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: scoreColor(L.score), lineHeight: 1 }}>
                    {L.score ?? "—"}
                  </div>
                  <div className="mono" style={{ fontSize: 9, fontWeight: 600, color: "var(--sec)", marginTop: 2 }}>
                    {scoreLabel(L.score)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {L.phone && (
                  <a
                    href={`tel:${L.phone.replace(/\s/g, "")}`}
                    className="btn-green"
                    style={{ padding: "8px 16px", fontSize: 12, fontFamily: "var(--font-sg)", fontWeight: 600 }}
                  >
                    CALL {L.phone}
                  </a>
                )}
                {L.phoneIntl && (
                  <a
                    href={`https://wa.me/${L.phoneIntl}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      border: "1px solid var(--border-hover)",
                      borderRadius: 6,
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    WHATSAPP
                  </a>
                )}
                <div
                  onClick={verifyAction}
                  style={{
                    border: "1px solid var(--border-hover)",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--sec)",
                    cursor: "pointer",
                  }}
                >
                  {busy === "verify" ? "VERIFYING…" : "VERIFY ON WEB ⌕"}
                </div>
                <div
                  onClick={refreshAction}
                  style={{
                    border: "1px solid var(--border-hover)",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--sec)",
                    cursor: "pointer",
                  }}
                >
                  {busy === "refresh" ? "REFRESHING…" : "⟳ REFRESH"}
                </div>
                <div style={{ flex: 1 }} />
                <div
                  onClick={contactedAction}
                  style={{
                    border: "1px solid var(--border-hover)",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontSize: 12,
                    color: "var(--sec)",
                    cursor: "pointer",
                  }}
                >
                  ✓ CONTACTED → ARCHIVE
                </div>
              </div>

              <div style={{ display: "flex", marginTop: 18, borderBottom: "1px solid var(--border)" }}>
                {(
                  [
                    ["analysis", "ANALYSIS"],
                    ["data", "DATA"],
                    ["plan", "SITE_PLAN"],
                    ["log", `LOG·${detail?.activities.length ?? 0}`],
                    ["outreach", "OUTREACH"],
                  ] as [Tab, string][]
                ).map(([k, label]) => (
                  <div key={k} className={`tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* ANALYSIS */}
            {tab === "analysis" &&
              (A ? (
                <div style={{ display: "flex", gap: 14, padding: "16px 24px 22px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                    <div className="card">
                      <div className="card-head">LEAD_SCORE — WHY {A.score}</div>
                      <div style={{ padding: 13, fontSize: 12.5, lineHeight: 1.6, color: "var(--body)" }}>
                        {A.reasoning}{" "}
                        <span style={{ color: "var(--muted)" }}>
                          — {A.model} · {timeAgo(A.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-head">BUSINESS_PROFILE</div>
                      <div style={{ padding: 13, fontSize: 12.5, lineHeight: 1.6, color: "var(--body)" }}>
                        {A.businessProfile}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 250, flex: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                    {railCard(
                      "SIGNALS",
                      <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 500, color: "#a9b0ba" }}>
                        <div>
                          rating <span style={{ color: "var(--green)" }}>{L.rating ? `${L.rating} ★` : "n/a"}</span>
                        </div>
                        <div>
                          reviews <span style={{ color: "var(--green)" }}>{L.reviewCount ?? "n/a"}</span>
                        </div>
                        <div>
                          website <span style={{ color: "var(--amber)" }}>{L.websiteStatus}</span>
                        </div>
                        <div>
                          verified{" "}
                          <span style={{ color: L.verifiedNoWebsite ? "var(--green)" : "var(--sec)" }}>
                            {L.verifiedNoWebsite == null
                              ? "not checked"
                              : L.verifiedNoWebsite
                                ? "no_website ✓"
                                : "site found ✗"}
                          </span>
                        </div>
                      </div>,
                    )}
                    {railCard(
                      "BEST_CALL_WINDOW",
                      <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {A.outreach.bestCallWindow}
                      </div>,
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "16px 24px 22px" }}>
                  <div className="card" style={{ padding: 20, textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                      not analyzed yet — run the AI brain on this lead
                    </div>
                    <div
                      className="btn-green-tint mono"
                      style={{ display: "inline-block", padding: "9px 22px", fontSize: 11.5 }}
                      onClick={analyzeAction}
                    >
                      {busy === "analyze" ? "ANALYZING…" : "▶ ANALYZE THIS LEAD"}
                    </div>
                  </div>
                </div>
              ))}

            {/* DATA */}
            {tab === "data" && (
              <div style={{ padding: "16px 24px 22px" }}>
                <div className="card" style={{ overflow: "hidden" }}>
                  <div style={{ display: "flex", padding: "9px 13px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--sec)" }}>RAW LEAD DATA</span>
                    <div style={{ flex: 1 }} />
                    {L.source === "google" && (
                      <span className="mono" style={{ fontSize: 9.5, fontWeight: 500, color: "var(--amber)" }}>
                        google cache rule: refresh if &gt; 30d
                      </span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {dataPairs.map(([k, v]) => (
                      <div
                        key={k}
                        style={{ display: "flex", gap: 10, padding: "10px 13px", borderBottom: "1px solid var(--hairline)", fontSize: 12 }}
                      >
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", width: 120, flex: "none", paddingTop: 1 }}>
                          {k}
                        </span>
                        <span className="mono" style={{ color: "var(--body)", fontSize: 11.5, wordBreak: "break-word" }}>
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SITE_PLAN */}
            {tab === "plan" &&
              (A ? (
                <div style={{ display: "flex", gap: 14, padding: "16px 24px 22px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                    <div className="card">
                      <div className="card-head">CONTENT ANGLE</div>
                      <div style={{ padding: 13, fontSize: 12.5, lineHeight: 1.6, color: "var(--body)" }}>
                        {A.sitePlan.contentAngle}
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-head">SELLING POINTS</div>
                      <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                        {A.sitePlan.sellingPoints.map((p, i) => (
                          <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: "var(--body)" }}>
                            <span style={{ color: "var(--green)" }}>▸</span>
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 250, flex: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                    {railCard(
                      "SUGGESTED PAGES",
                      <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 10.5, fontWeight: 500 }}>
                        {A.sitePlan.suggestedPages.map((p) => (
                          <span key={p} className="chip in-panel on" style={{ cursor: "default" }}>
                            {p}
                          </span>
                        ))}
                      </div>,
                    )}
                    <div
                      className="btn-green mono"
                      style={{ padding: "10px 0", fontSize: 11.5 }}
                      onClick={() => copy("plan", planCopyText())}
                    >
                      {copied === "plan" ? "COPIED ✓" : "COPY PLAN FOR CLAUDE"}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--faint)", textAlign: "center", lineHeight: 1.5 }}>
                      paste into Claude to build their website
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mono" style={{ padding: "20px 24px", fontSize: 11, color: "var(--faint)" }}>
                  run analysis first — the site plan is generated with it
                </div>
              ))}

            {/* LOG */}
            {tab === "log" && (
              <div style={{ padding: "16px 24px 22px" }}>
                <div className="card" style={{ overflow: "hidden" }}>
                  <div className="card-head">ACTIVITY LOG</div>
                  {(detail?.activities ?? []).map((a) => (
                    <div key={a.id} style={{ display: "flex", gap: 12, padding: "11px 13px", borderBottom: "1px solid var(--hairline)", alignItems: "baseline" }}>
                      <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", width: 74, flex: "none" }}>
                        {a.kind}
                        {a.dueAt ? " ⏰" : ""}
                      </span>
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--body)", lineHeight: 1.5 }}>
                        {a.note}
                        {a.dueAt && (
                          <span className="mono" style={{ color: "var(--amber)", fontSize: 10.5 }}>
                            {" "}
                            · due {new Date(a.dueAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </span>
                      <span className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", flex: "none" }}>
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                  ))}
                  {followOpen && (
                    <div className="mono" style={{ display: "flex", gap: 8, padding: "12px 13px 0", alignItems: "center", fontSize: 10.5 }}>
                      <span style={{ color: "var(--amber)" }}>⏰ due</span>
                      <input
                        type="datetime-local"
                        className="input in-panel mono"
                        style={{ width: 200, padding: "6px 9px", fontSize: 11 }}
                        value={followAt}
                        onChange={(e) => setFollowAt(e.target.value)}
                      />
                      {["CALL", "WHATSAPP", "VISIT"].map((k) => (
                        <span key={k} className={`chip in-panel${followKind === k ? " on" : ""}`} style={{ fontSize: 9.5 }} onClick={() => setFollowKind(k)}>
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, padding: "12px 13px" }}>
                    <input
                      className="input in-panel"
                      style={{ flex: 1, fontSize: 12.5 }}
                      placeholder="add note… (e.g. owner busy, call back Tue)"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (followOpen && followAt) addActivity(followKind, new Date(followAt).toISOString());
                          else addActivity("NOTE");
                        }
                      }}
                    />
                    <div
                      className="btn-green-tint mono"
                      style={{ padding: "9px 16px", fontSize: 11 }}
                      onClick={() => {
                        if (followOpen && followAt) addActivity(followKind, new Date(followAt).toISOString());
                        else addActivity("NOTE");
                      }}
                    >
                      ADD
                    </div>
                    <div
                      className="mono"
                      style={{
                        border: `1px solid ${followOpen ? "var(--amber)" : "var(--border)"}`,
                        borderRadius: 6,
                        padding: "9px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--amber)",
                        cursor: "pointer",
                      }}
                      onClick={() => setFollowOpen((o) => !o)}
                    >
                      ⏰ FOLLOW-UP
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OUTREACH */}
            {tab === "outreach" &&
              (A ? (
                <div style={{ display: "flex", gap: 14, padding: "16px 24px 22px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="card">
                      <div style={{ display: "flex", padding: "9px 13px", borderBottom: "1px solid var(--border)" }}>
                        <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--sec)" }}>WHATSAPP · ENGLISH</span>
                        <div style={{ flex: 1 }} />
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", cursor: "pointer" }} onClick={() => copy("en", A.outreach.whatsappEn)}>
                          {copied === "en" ? "COPIED ✓" : "COPY"}
                        </span>
                      </div>
                      <div style={{ padding: 13, fontSize: 12.5, lineHeight: 1.6, color: "var(--body)" }}>{A.outreach.whatsappEn}</div>
                    </div>
                    <div className="card">
                      <div style={{ display: "flex", padding: "9px 13px", borderBottom: "1px solid var(--border)" }}>
                        <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: "var(--sec)" }}>
                          WHATSAPP · {A.outreach.localLanguageLabel}
                        </span>
                        <div style={{ flex: 1 }} />
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--green)", cursor: "pointer" }} onClick={() => copy("lo", A.outreach.whatsappLocal)}>
                          {copied === "lo" ? "COPIED ✓" : "COPY"}
                        </span>
                      </div>
                      <div style={{ padding: 13, fontSize: 12.5, lineHeight: 1.6, color: "var(--body)" }}>{A.outreach.whatsappLocal}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="card">
                      <div className="card-head">PHONE CALL SCRIPT</div>
                      <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                        {A.outreach.callScript.map((c, i) => (
                          <div key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, lineHeight: 1.5, color: "var(--body)" }}>
                            <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", flex: "none", paddingTop: 2 }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {railCard(
                      "BEST_CALL_WINDOW",
                      <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
                        {A.outreach.bestCallWindow}
                      </div>,
                    )}
                  </div>
                </div>
              ) : (
                <div className="mono" style={{ padding: "20px 24px", fontSize: 11, color: "var(--faint)" }}>
                  run analysis first — outreach drafts are generated with it
                </div>
              ))}
          </>
        )}
      </div>
      {toastNode}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div style={{ flex: 1 }} />}>
      <LeadsInner />
    </Suspense>
  );
}
