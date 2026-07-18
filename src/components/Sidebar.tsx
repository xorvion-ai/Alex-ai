"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { api, QuotaDto } from "@/lib/client";

const NAVS = [
  { path: "/", label: "◳ Dashboard" },
  { path: "/discover", label: "◎ Discover" },
  { path: "/leads", label: "☰ Leads" },
  { path: "/settings", label: "⚙ Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quota, setQuota] = useState<QuotaDto>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);

  useEffect(() => {
    api<{ quota: QuotaDto }>("/api/quota")
      .then((r) => setQuota(r.quota))
      .catch(() => {});
    api<{ count: number }>("/api/leads?countOnly=1")
      .then((r) => setLeadCount(r.count))
      .catch(() => {});
  }, [pathname]);

  const q = (provider: string) => quota.find((x) => x.provider === provider);
  const places = q("google_places");
  const gemini = q("gemini");
  const brave = q("brave");
  const pct = (x?: { used: number; limit: number }) =>
    x ? Math.min(100, Math.round((x.used / x.limit) * 100)) : 0;

  async function doLock() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  return (
    <div
      style={{
        width: 204,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--deep)",
        borderRight: "1px solid var(--border)",
        padding: "18px 0",
      }}
    >
      <div style={{ padding: "0 16px 20px" }}>
        <Logo variant="side" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 13 }}>
        {NAVS.map((n) => {
          const active = pathname === n.path;
          return (
            <div
              key={n.path}
              onClick={() => router.push(n.path)}
              style={{
                padding: "9px 18px",
                cursor: "pointer",
                background: active ? "var(--panel)" : undefined,
                color: active ? "var(--text)" : "var(--sec)",
                borderLeft: active ? "2px solid var(--green)" : "2px solid transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {n.label}
              {n.path === "/leads" && leadCount != null ? `  ·  ${leadCount}` : ""}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <div
        onClick={() => setQuotaOpen((o) => !o)}
        style={{
          margin: "0 12px",
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        <div
          className="mono"
          style={{ display: "flex", fontSize: 9.5, fontWeight: 600, color: "var(--sec)" }}
        >
          <span>QUOTA GUARDIAN</span>
          <span style={{ flex: 1 }} />
          <span>{quotaOpen ? "▾" : "▸"}</span>
        </div>
        <div className="bar" style={{ marginTop: 7 }}>
          <i style={{ width: `${pct(places)}%` }} />
        </div>
        <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", marginTop: 4 }}>
          PLACES {places ? `${places.used}/${places.limit}` : "—"}
        </div>
        {quotaOpen && (
          <>
            <div className="bar" style={{ marginTop: 8 }}>
              <i style={{ width: `${pct(gemini)}%` }} />
            </div>
            <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", marginTop: 4 }}>
              GEMINI {gemini ? `${gemini.used}/${gemini.limit}·day` : "—"}
            </div>
            <div className="bar" style={{ marginTop: 8 }}>
              <i style={{ width: `${pct(brave)}%` }} />
            </div>
            <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--muted)", marginTop: 4 }}>
              BRAVE {brave ? `${brave.used}/${brave.limit}` : "—"}
            </div>
            <div
              className="mono"
              style={{ fontSize: 9.5, fontWeight: 500, color: "var(--amber)", marginTop: 9, lineHeight: 1.5 }}
            >
              ⛨ hard-stop at 90% — a bill is impossible
            </div>
          </>
        )}
      </div>
      <div
        onClick={doLock}
        className="mono"
        style={{
          margin: "10px 12px 0",
          padding: "8px 12px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 10.5,
          fontWeight: 600,
          color: "var(--muted)",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        ⏻ LOCK
      </div>
    </div>
  );
}
