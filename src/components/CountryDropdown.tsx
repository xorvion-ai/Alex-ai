"use client";

import { useEffect, useRef, useState } from "react";
import { ANY_COUNTRY, COUNTRIES, countryName } from "@/lib/config";
import Flag from "@/components/Flag";

// Flag image + plain name (emoji flags don't render on Windows).
function CountryLabel({ value }: { value: string }) {
  const nm = countryName(value);
  if (!nm) return <>{ANY_COUNTRY}</>;
  return (
    <>
      <Flag country={nm} /> {nm}
    </>
  );
}

export default function CountryDropdown({
  value,
  onChange,
  small,
  inPanel,
  anyOption,
}: {
  value: string;
  onChange: (c: string) => void;
  small?: boolean;
  inPanel?: boolean;
  /** show "All countries" (leads filter) — sweeps always target one country */
  anyOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 80 countries is too many to scroll — type to narrow the list.
  const [q, setQ] = useState("");
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
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
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
        <span><CountryLabel value={value} /></span> <span style={{ color: "var(--muted)" }}>{open ? "▴" : "▾"}</span>
      </div>
      {open && (
        <div className="dd-panel">
          <input
            className="input in-panel mono"
            autoFocus
            placeholder="/ type to filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: "6px 9px", fontSize: 11.5, borderRadius: 0, borderWidth: "0 0 1px 0" }}
          />
          {(anyOption ? [ANY_COUNTRY, ...COUNTRIES] : COUNTRIES).filter((c) =>
            countryName(c).toLowerCase().includes(q.trim().toLowerCase()) ||
            (!countryName(c) && "all countries".includes(q.trim().toLowerCase())),
          ).map((c) => (
            <div
              key={c}
              className={`dd-opt${c === value ? " on" : ""}`}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              <CountryLabel value={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
