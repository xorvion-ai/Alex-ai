"use client";

// Discover — sweep any city on Earth for businesses with no website. §Screen 5.
// All sweep state + the polling loop live in the sweep-store singleton so a
// running sweep survives navigation (see src/lib/sweep-store.ts); this page just
// renders the store and forwards actions to it.

import { useEffect, useRef, useSyncExternalStore } from "react";
import CountryDropdown from "@/components/CountryDropdown";
import { useToast } from "@/components/useToast";
import { CATEGORIES } from "@/lib/categories";
import { GOOGLE_MAX_PAGES } from "@/lib/config";
import { getSnapshot, subscribe, sweep } from "@/lib/sweep-store";

const CAT_IDS = CATEGORIES.map((c) => c.id).slice(0, 9);

export default function DiscoverPage() {
  const { flash, node: toastNode } = useToast();
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Load defaults once (guarded in the store) and surface store toasts.
  useEffect(() => {
    sweep.loadSettings();
  }, []);
  const lastSeq = useRef(s.toast?.seq ?? 0);
  useEffect(() => {
    if (s.toast && s.toast.seq > lastSeq.current) {
      lastSeq.current = s.toast.seq;
      flash(s.toast.msg);
    }
  }, [s.toast, flash]);

  const cats = Object.keys(s.catSel).filter((k) => s.catSel[k]);
  const sources = Object.keys(s.srcSel).filter((k) => s.srcSel[k]);
  const estQueries = cats.length * sources.length;
  const estRequests =
    (s.srcSel.google ? cats.length * GOOGLE_MAX_PAGES : 0) + (s.srcSel.tomtom ? cats.length : 0);

  const pct = s.prog && s.prog.total ? Math.round((s.prog.cursor / s.prog.total) * 100) : 0;
  const state = s.running
    ? "● SWEEPING"
    : s.doneState === "done"
      ? `✓ COMPLETE — ${s.prog?.added ?? 0} NEW LEADS`
      : s.doneState === "stopped"
        ? "■ STOPPED"
        : "IDLE";
  const stateColor =
    s.running || s.doneState === "done"
      ? "var(--green)"
      : s.doneState === "stopped"
        ? "var(--amber)"
        : "var(--muted)";

  const visibleCats = s.moreCats ? CATEGORIES.map((c) => c.id) : CAT_IDS;

  return (
    <div className="split">
      <div className="pane-side" style={{ overflow: "auto", padding: "26px 22px" }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Discover</div>
        <div style={{ fontSize: 12, color: "var(--sec)", marginTop: 4 }}>
          Sweep any city on Earth for businesses with no website.
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>COUNTRY</div>
          <CountryDropdown value={s.country} onChange={sweep.setCountry} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>CITY / AREA</div>
          <input
            className="input"
            placeholder="e.g. Jaipur, Lagos, Berlin…"
            value={s.city}
            onChange={(e) => sweep.setCity(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 5 }}>
            KEYWORD <span style={{ color: "#3d434b" }}>(OPTIONAL)</span>
          </div>
          <input
            className="input"
            placeholder="e.g. vegetarian, 24h…"
            value={s.keyword}
            onChange={(e) => sweep.setKeyword(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 6 }}>BUSINESS TYPES</div>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 10.5, fontWeight: 500 }}>
            {visibleCats.map((id) => (
              <span key={id} className={`chip${s.catSel[id] ? " on" : ""}`} onClick={() => sweep.toggleCat(id)}>
                {id}
              </span>
            ))}
            <span
              className="chip"
              style={{ background: "transparent", border: "none", color: "var(--muted)" }}
              onClick={() => sweep.setMoreCats(!s.moreCats)}
            >
              {s.moreCats ? "− less" : `+ ${CATEGORIES.length - CAT_IDS.length} more`}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 6 }}>LEAD SOURCES</div>
          <div className="mono" style={{ display: "flex", gap: 5, fontSize: 10.5, fontWeight: 600 }}>
            {(["google", "osm", "tomtom"] as const).map((k) => {
              const noKey = k !== "osm" && !s.keyAvail[k];
              return (
                <span
                  key={k}
                  className={`chip${s.srcSel[k] ? " on" : ""}`}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "7px 0",
                    opacity: noKey ? 0.55 : 1,
                  }}
                  onClick={() => sweep.toggleSource(k)}
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
          onClick={() => sweep.toggle()}
          className="mono"
          style={{
            marginTop: 22,
            textAlign: "center",
            background: s.running ? "var(--panel)" : "var(--green)",
            color: s.running ? "var(--green)" : "var(--deep)",
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
          {s.running ? "■ STOP SWEEP" : s.doneState !== "idle" ? "▶ START NEW SWEEP" : "▶ START SWEEP"}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 10, textAlign: "center" }}>
          estimate: ~{estQueries} queries · ~{estRequests} enterprise requests
        </div>
      </div>

      <div className="pane-main">
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", background: "#0e1013" }}>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", fontSize: 11, fontWeight: 500, color: "var(--sec)", gap: "6px 22px" }}>
            <span>
              query <span style={{ color: "var(--text)" }}>{s.prog?.cursor ?? 0}/{s.prog?.total ?? estQueries}</span>
            </span>
            <span>
              requests <span style={{ color: "var(--text)" }}>{s.prog?.requests ?? 0}</span>
            </span>
            <span>
              scanned <span style={{ color: "var(--text)" }}>{s.prog?.scanned ?? 0}</span>
            </span>
            <span>
              no-website <span style={{ color: "var(--green)" }}>{s.prog?.added ?? 0}</span>
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ color: stateColor }}>{state}</span>
          </div>
          <div className="bar" style={{ marginTop: 10 }}>
            <i style={{ width: `${pct}%`, transition: "width .4s" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {s.feed.length === 0 ? (
            <div style={{ height: "100%", minHeight: 260, display: "grid", placeItems: "center" }}>
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
                  {s.running ? "sweeping — first results incoming…" : "radar idle — configure a sweep and hit START"}
                </div>
              </div>
            </div>
          ) : (
            s.feed.map((f, i) => (
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
