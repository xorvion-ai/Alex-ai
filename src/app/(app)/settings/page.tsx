"use client";

// Settings — API keys (env, read-only), Quota Guardian, discovery defaults, outreach. §Screen 7.

import { useEffect, useRef, useState } from "react";
import CountryDropdown from "@/components/CountryDropdown";
import { useToast } from "@/components/useToast";
import { api } from "@/lib/client";
import { CATEGORIES } from "@/lib/categories";

const LANGS = ["Hindi", "Spanish", "Portuguese", "French", "German"];
const DEFAULT_CAT_CHOICES = CATEGORIES.map((c) => c.id).filter((c) => c !== "any");

export default function SettingsPage() {
  const { flash, node: toastNode } = useToast();
  const [hardStop, setHardStop] = useState(90);
  const [defaultCountry, setDefaultCountry] = useState("🌍 Global");
  const [defaultCategories, setDefaultCategories] = useState<string[]>([]);
  const [fallbackLanguage, setFallbackLanguage] = useState("Hindi");
  const [keys, setKeys] = useState<{ googlePlaces: string | null; gemini: string | null; brave: string | null }>({
    googlePlaces: null,
    gemini: null,
    brave: null,
  });
  const [langOpen, setLangOpen] = useState(false);
  const [moreCats, setMoreCats] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{
      settings: { hardStop: number; defaultCountry: string; defaultCategories: string[]; fallbackLanguage: string };
      keys: { googlePlaces: string | null; gemini: string | null; brave: string | null };
    }>("/api/settings")
      .then((r) => {
        setHardStop(Math.round(r.settings.hardStop * 100));
        setDefaultCountry(r.settings.defaultCountry);
        setDefaultCategories(r.settings.defaultCategories);
        setFallbackLanguage(r.settings.fallbackLanguage);
        setKeys(r.keys);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function save() {
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          hardStop: hardStop / 100,
          defaultCountry,
          defaultCategories,
          fallbackLanguage,
        }),
      });
      flash("Settings saved ✓");
    } catch (e) {
      flash(e instanceof Error ? e.message : "save failed");
    }
  }

  const keyInput = (label: string, value: string | null) => (
    <>
      <div className="lbl" style={{ fontSize: 9, margin: "10px 0 4px" }}>{label}</div>
      <input
        readOnly
        className="mono"
        value={value ?? ""}
        placeholder="not set — add to .env and restart"
        style={{
          width: "100%",
          background: "var(--field)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "9px 11px",
          fontSize: 12,
          fontWeight: 500,
          color: value ? "var(--sec)" : "var(--faint)",
          outline: "none",
        }}
      />
    </>
  );

  const capRow = (name: string, value: string, mutedValue = false) => (
    <div className="mono" style={{ display: "flex", fontSize: 11, fontWeight: 500, color: "#a9b0ba" }}>
      <span>{name}</span>
      <span style={{ flex: 1 }} />
      <span style={{ color: mutedValue ? "var(--sec)" : "var(--text)" }}>{value}</span>
    </div>
  );

  const visibleCats = moreCats ? DEFAULT_CAT_CHOICES : DEFAULT_CAT_CHOICES.slice(0, 8);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "26px 30px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px" }}>Settings</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20, maxWidth: 980 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>API KEYS</div>
          {keyInput("GOOGLE PLACES (NEW)", keys.googlePlaces)}
          {keyInput("GOOGLE AI STUDIO (GEMINI)", keys.gemini)}
          {keyInput("BRAVE SEARCH", keys.brave)}
          <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 10, lineHeight: 1.5 }}>
            keys live in env vars — never in the database
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>QUOTA GUARDIAN</div>
          <div className="mono" style={{ display: "flex", fontSize: 11.5, fontWeight: 500, color: "var(--body)" }}>
            <span>hard-stop threshold</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: "var(--green)" }}>{hardStop}%</span>
          </div>
          <input
            type="range"
            className="slider"
            style={{ marginTop: 10 }}
            min={50}
            max={100}
            step={5}
            value={hardStop}
            onChange={(e) => setHardStop(Number(e.target.value))}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {capRow("google places cap", "1,000 / month")}
            {capRow("gemini cap", "1,000 / day")}
            {capRow("brave cap", "2,000 / month")}
            {capRow("osm", "polite rate-limit only", true)}
          </div>
          <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--amber)", marginTop: 12, lineHeight: 1.5 }}>
            ⛨ also set console-side caps + $1 budget alert (see setup docs)
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>DISCOVERY DEFAULTS</div>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 4 }}>DEFAULT COUNTRY</div>
          <CountryDropdown value={defaultCountry} onChange={setDefaultCountry} inPanel />
          <div className="lbl" style={{ fontSize: 9, margin: "12px 0 6px" }}>DEFAULT CATEGORIES</div>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 5, fontSize: 10, fontWeight: 500 }}>
            {visibleCats.map((id) => (
              <span
                key={id}
                className={`chip in-panel${defaultCategories.includes(id) ? " on" : ""}`}
                onClick={() =>
                  setDefaultCategories((prev) =>
                    prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
                  )
                }
              >
                {id}
              </span>
            ))}
            <span className="chip in-panel" onClick={() => setMoreCats((m) => !m)}>
              {moreCats ? "− less" : "+ edit"}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column" }}>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, color: "var(--sec)", marginBottom: 12 }}>OUTREACH</div>
          <div className="lbl" style={{ fontSize: 9, marginBottom: 4 }}>
            SECOND LANGUAGE (auto-detected per lead, this is the fallback)
          </div>
          <div ref={langRef} style={{ position: "relative" }}>
            <div
              onClick={() => setLangOpen((o) => !o)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "var(--field)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "9px 11px",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {fallbackLanguage} <span style={{ color: "var(--muted)" }}>{langOpen ? "▴" : "▾"}</span>
            </div>
            {langOpen && (
              <div className="dd-panel">
                {LANGS.map((l) => (
                  <div
                    key={l}
                    className={`dd-opt${l === fallbackLanguage ? " on" : ""}`}
                    onClick={() => {
                      setFallbackLanguage(l);
                      setLangOpen(false);
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 10, lineHeight: 1.5 }}>
            drafts are always generated in english + the lead&apos;s local language
          </div>
          <div style={{ flex: 1 }} />
          <div className="btn-green mono" style={{ marginTop: 16, padding: "10px 0", fontSize: 12, letterSpacing: ".5px" }} onClick={save}>
            SAVE SETTINGS
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
