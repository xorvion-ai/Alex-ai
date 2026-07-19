"use client";

// Discover — sweep any city on Earth for businesses with no website. §Screen 5.

import { useEffect, useRef, useState } from "react";
import CountryDropdown from "@/components/CountryDropdown";
import { useToast } from "@/components/useToast";
import { api, ApiError } from "@/lib/client";
import { CATEGORIES } from "@/lib/categories";
import { GOOGLE_MAX_PAGES } from "@/lib/config";

type FeedItem = {
  name: string;
  src: "G" | "OSM" | "TT";
  meta: string;
  tag: "NO_SITE" | "SOCIAL";
};

type Progress = {
  status: "running" | "stopped" | "complete";
  cursor: number;
  total: number;
  requests: number;
  scanned: number;
  added: number;
  quotaBlocked?: boolean;
  error?: string;
};

const CAT_IDS = CATEGORIES.map((c) => c.id).slice(0, 9);

export default function DiscoverPage() {
  const { flash, node: toastNode } = useToast();
  const [country, setCountry] = useState("🌍 Global");
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [catSel, setCatSel] = useState<Record<string, boolean>>({ restaurant: true, salon: true });
  const [srcSel, setSrcSel] = useState<Record<string, boolean>>({ google: true, osm: true, tomtom: true });
  const [keyAvail, setKeyAvail] = useState<Record<string, boolean>>({ google: true, tomtom: true });
  const [moreCats, setMoreCats] = useState(false);

  const [running, setRunning] = useState(false);
  const [doneState, setDoneState] = useState<"idle" | "done" | "stopped">("idle");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [prog, setProg] = useState<Progress | null>(null);
  const runningRef = useRef(false);
  const searchIdRef = useRef<number | null>(null);

  useEffect(() => {
    api<{
      settings: { defaultCountry: string; defaultCategories: string[] };
      keys: { googlePlaces: string | null; tomtom: string | null };
    }>("/api/settings")
      .then((r) => {
        setCountry(r.settings.defaultCountry);
        const sel: Record<string, boolean> = {};
        for (const c of r.settings.defaultCategories) sel[c] = true;
        if (Object.keys(sel).length) setCatSel(sel);
        // Card-free mode: sources without a key get disabled (OSM never needs one)
        const avail = { google: !!r.keys.googlePlaces, tomtom: !!r.keys.tomtom };
        setKeyAvail(avail);
        setSrcSel({ google: avail.google, osm: true, tomtom: avail.tomtom });
      })
      .catch(() => {});
    return () => {
      runningRef.current = false;
    };
  }, []);

  function toggleCat(id: string) {
    setCatSel((prev) => {
      if (id === "any") return { any: true };
      const next = { ...prev, [id]: !prev[id] };
      delete next.any;
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  }

  const cats = Object.keys(catSel).filter((k) => catSel[k]);
  const sources = Object.keys(srcSel).filter((k) => srcSel[k]);
  const estQueries = cats.length * sources.length;
  const estRequests =
    (srcSel.google ? cats.length * GOOGLE_MAX_PAGES : 0) +
    (srcSel.tomtom ? cats.length : 0);

  async function toggleSweep() {
    if (running) {
      runningRef.current = false;
      setRunning(false);
      setDoneState("stopped");
      if (searchIdRef.current) {
        api("/api/sweep/stop", {
          method: "POST",
          body: JSON.stringify({ searchId: searchIdRef.current }),
        }).catch(() => {});
      }
      return;
    }
    if (!city.trim()) {
      flash("enter a city / area first");
      return;
    }
    if (!sources.length) {
      flash("pick at least one lead source");
      return;
    }
    setFeed([]);
    setProg(null);
    setDoneState("idle");
    setRunning(true);
    runningRef.current = true;
    try {
      const start = await api<{ id: number; total: number; warning?: string }>("/api/sweep", {
        method: "POST",
        body: JSON.stringify({ country, city, keyword, categories: cats, sources }),
      });
      if (start.warning) flash(start.warning);
      searchIdRef.current = start.id;
      while (runningRef.current) {
        const r = await api<{ progress: Progress; newLeads: FeedItem[] }>("/api/sweep/step", {
          method: "POST",
          body: JSON.stringify({ searchId: start.id }),
        });
        setProg(r.progress);
        if (r.newLeads.length) setFeed((f) => [...r.newLeads.slice().reverse(), ...f].slice(0, 200));
        if (r.progress.error) flash(r.progress.error);
        if (r.progress.status !== "running") {
          runningRef.current = false;
          setRunning(false);
          setDoneState(r.progress.status === "complete" ? "done" : "stopped");
          if (r.progress.quotaBlocked) flash("⛨ Quota Guardian stopped the sweep");
          break;
        }
        await new Promise((res) => setTimeout(res, 350));
      }
    } catch (e) {
      runningRef.current = false;
      setRunning(false);
      setDoneState("stopped");
      if (e instanceof ApiError && e.quotaBlocked) flash("⛨ Quota Guardian stopped the sweep");
      else flash(e instanceof Error ? e.message : "sweep failed");
    }
  }

  const pct = prog && prog.total ? Math.round((prog.cursor / prog.total) * 100) : 0;
  const state = running
    ? "● SWEEPING"
    : doneState === "done"
      ? `✓ COMPLETE — ${prog?.added ?? 0} NEW LEADS`
      : doneState === "stopped"
        ? "■ STOPPED"
        : "IDLE";
  const stateColor = running || doneState === "done" ? "var(--green)" : doneState === "stopped" ? "var(--amber)" : "var(--muted)";

  const visibleCats = moreCats ? CATEGORIES.map((c) => c.id) : CAT_IDS;

  return (
    <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
      <div
        style={{
          width: 400,
          flex: "none",
          borderRight: "1px solid var(--border)",
          overflow: "auto",
          padding: "26px 22px",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Discover</div>
        <div style={{ fontSize: 12, color: "var(--sec)", marginTop: 4 }}>
          Sweep any city on Earth for businesses with no website.
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>COUNTRY</div>
          <CountryDropdown value={country} onChange={setCountry} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>CITY / AREA</div>
          <input
            className="input"
            placeholder="e.g. Jaipur, Lagos, Berlin…"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>
            KEYWORD <span style={{ color: "#3d434b" }}>(OPTIONAL)</span>
          </div>
          <input
            className="input"
            placeholder="e.g. vegetarian, 24h…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 6 }}>BUSINESS TYPES</div>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 10.5, fontWeight: 500 }}>
            {visibleCats.map((id) => (
              <span key={id} className={`chip${catSel[id] ? " on" : ""}`} onClick={() => toggleCat(id)}>
                {id}
              </span>
            ))}
            <span
              className="chip"
              style={{ background: "transparent", border: "none", color: "var(--muted)" }}
              onClick={() => setMoreCats((m) => !m)}
            >
              {moreCats ? "− less" : `+ ${CATEGORIES.length - CAT_IDS.length} more`}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 6 }}>LEAD SOURCES</div>
          <div className="mono" style={{ display: "flex", gap: 5, fontSize: 10.5, fontWeight: 600 }}>
            {(["google", "osm", "tomtom"] as const).map((k) => {
              const noKey = k !== "osm" && !keyAvail[k];
              return (
                <span
                  key={k}
                  className={`chip${srcSel[k] ? " on" : ""}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "7px 0",
                    opacity: noKey ? 0.55 : 1,
                  }}
                  onClick={() => {
                    if (noKey) {
                      flash(`${k} needs an API key — add it to .env (see .env.example)`);
                      return;
                    }
                    setSrcSel((s) => ({ ...s, [k]: !s[k] }));
                  }}
                >
                  {k === "google"
                    ? noKey
                      ? "GOOGLE · NO KEY"
                      : "GOOGLE"
                    : k === "osm"
                      ? "OSM"
                      : noKey
                        ? "TOMTOM · NO KEY"
                        : "TOMTOM"}
                </span>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 6 }}>
            google = richest data, quota-limited · osm &amp; tomtom = card-free, huge limits
          </div>
        </div>

        <div
          onClick={toggleSweep}
          className="mono"
          style={{
            marginTop: 22,
            textAlign: "center",
            background: running ? "var(--panel)" : "var(--green)",
            color: running ? "var(--green)" : "var(--deep)",
            border: "1px solid var(--green-border)",
            borderRadius: 6,
            padding: "12px 0",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 1,
            boxShadow: "0 0 24px rgba(74,222,128,.12)",
          }}
        >
          {running ? "■ STOP SWEEP" : doneState !== "idle" ? "▶ START NEW SWEEP" : "▶ START SWEEP"}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 10, textAlign: "center" }}>
          estimate: ~{estQueries} queries · ~{estRequests} enterprise requests
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "#0e1013" }}>
          <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "var(--sec)", gap: 22 }}>
            <span>
              query <span style={{ color: "var(--text)" }}>{prog?.cursor ?? 0}/{prog?.total ?? estQueries}</span>
            </span>
            <span>
              requests <span style={{ color: "var(--text)" }}>{prog?.requests ?? 0}</span>
            </span>
            <span>
              scanned <span style={{ color: "var(--text)" }}>{prog?.scanned ?? 0}</span>
            </span>
            <span>
              no-website <span style={{ color: "var(--green)" }}>{prog?.added ?? 0}</span>
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: stateColor }}>{state}</span>
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <i style={{ width: `${pct}%`, transition: "width .4s" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {feed.length === 0 ? (
            <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto" }}>
                  <div style={{ position: "absolute", inset: 0, border: "1.5px solid var(--border)", borderRadius: "50%" }} />
                  <div style={{ position: "absolute", inset: 18, border: "1px solid var(--hairline)", borderRadius: "50%" }} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 2,
                      borderRadius: "50%",
                      background: "conic-gradient(rgba(74,222,128,.3),transparent 70deg,transparent)",
                      animation: "spin 3s linear infinite",
                    }}
                  />
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginTop: 18 }}>
                  {running ? "sweeping — first results incoming…" : "radar idle — configure a sweep and hit START"}
                </div>
              </div>
            </div>
          ) : (
            feed.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="feedin"
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 22px",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--green)",
                    flex: "none",
                    boxShadow: "0 0 8px rgba(74,222,128,.6)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{f.name}</span>{" "}
                  <span
                    className="mono"
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: f.src === "G" ? "var(--google)" : f.src === "OSM" ? "var(--osm)" : "var(--tomtom)",
                      border: `1px solid ${f.src === "G" ? "var(--google-bd)" : f.src === "OSM" ? "var(--osm-bd)" : "var(--tomtom-bd)"}`,
                      borderRadius: 3,
                      padding: "1px 4px",
                      verticalAlign: 2,
                    }}
                  >
                    {f.src}
                  </span>
                  <div style={{ fontSize: 11, color: "var(--sec)" }}>{f.meta}</div>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 9, fontWeight: 500, color: f.tag === "SOCIAL" ? "var(--amber)" : "var(--faint)" }}
                >
                  {f.tag}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {toastNode}
    </div>
  );
}
