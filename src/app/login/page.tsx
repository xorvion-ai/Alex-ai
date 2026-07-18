"use client";

// Intro splash (3s, logo only) → Login. Per design handoff §Screens 1-2.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"boot" | "intro" | "login">("boot");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // init from sessionStorage (external system) — one-time, not a cascade
    const seen = sessionStorage.getItem("alex_intro_seen");
    if (seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("login");
      return;
    }
    setPhase("intro");
    sessionStorage.setItem("alex_intro_seen", "1");
    const t = setTimeout(() => setPhase("login"), 3100);
    return () => clearTimeout(t);
  }, []);

  async function doLogin() {
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "login failed");
      setBusy(false);
    }
  }

  if (phase === "boot") return <div style={{ height: "100vh", background: "var(--deep)" }} />;

  if (phase === "intro") {
    return (
      <div
        style={{
          height: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--deep)",
          overflow: "hidden",
        }}
      >
        <div style={{ animation: "fadeup .8s both, fadeout .5s 2.6s both" }}>
          <Logo variant="intro" />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(ellipse at 50% 42%,#12161a 0%,#0b0d0f 68%)",
      }}
    >
      <div style={{ width: 380 }} className="fadeup">
        <div style={{ marginBottom: 30 }}>
          <Logo variant="login" />
        </div>
        <div
          style={{
            background: "var(--field)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 22,
          }}
        >
          <div className="lbl" style={{ fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>
            PASSWORD
          </div>
          <input
            type="password"
            autoFocus
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doLogin();
            }}
            className="mono"
            style={{
              width: "100%",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "11px 12px",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)",
              outline: "none",
            }}
          />
          {error && (
            <div
              className="mono"
              style={{ marginTop: 10, fontSize: 10.5, color: "var(--amber)" }}
            >
              ✗ {error}
            </div>
          )}
          <div
            onClick={doLogin}
            className="btn-green"
            style={{ marginTop: 14, padding: "11px 0", fontSize: 13, letterSpacing: 1 }}
          >
            {busy ? "UNLOCKING…" : "UNLOCK →"}
          </div>
          <div
            className="mono"
            style={{
              marginTop: 14,
              fontSize: 10.5,
              color: "var(--faint)",
              textAlign: "center",
            }}
          >
            single-user · signed session cookie · no third-party auth
          </div>
        </div>
      </div>
    </div>
  );
}
