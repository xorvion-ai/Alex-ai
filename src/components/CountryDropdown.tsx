"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/config";

export default function CountryDropdown({
  value,
  onChange,
  small,
  inPanel,
}: {
  value: string;
  onChange: (c: string) => void;
  small?: boolean;
  inPanel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          background: inPanel ? "var(--field)" : "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: small ? 5 : 6,
          padding: small ? "7px 9px" : "9px 11px",
          fontSize: small ? 12 : 13,
          cursor: "pointer",
        }}
      >
        {value} <span style={{ color: "var(--muted)" }}>{open ? "▴" : "▾"}</span>
      </div>
      {open && (
        <div className="dd-panel">
          {COUNTRIES.map((c) => (
            <div
              key={c}
              className={`dd-opt${c === value ? " on" : ""}`}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
