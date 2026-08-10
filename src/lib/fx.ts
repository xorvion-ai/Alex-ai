// Exchange rates → INR, so a lead's prices can be read in rupees.
//
// Primary source: Coinbase's public exchange-rates feed — free, no key, and it
// tracks the live market (it moves through the day, unlike the once-a-day
// central-bank feeds). Fallback: open.er-api.com (daily) for any currency
// Coinbase doesn't quote. Cached 15 minutes and metered through the Quota
// Guardian; both endpoints are free, so the cap is only a sanity leash.

import { COUNTRY_TABLE } from "@/lib/config";
import { guard, spend } from "@/lib/quota";

const COINBASE = "https://api.coinbase.com/v2/exchange-rates?currency=INR";
const DAILY = "https://open.er-api.com/v6/latest/INR";
const TTL_MS = 15 * 60 * 1000;

export type FxRates = {
  /** INR per 1 unit of the currency, e.g. { EUR: 109.9, USD: 95.3 } */
  inrPer: Record<string, number>;
  /** when these numbers were fetched */
  updatedAt: string;
  source: "market" | "daily" | "mixed";
};

/** Currencies the app actually needs — the 45 markets' own currencies. */
const NEEDED = [...new Set(COUNTRY_TABLE.map((c) => c.cur))];

let cache: { at: number; data: FxRates } | null = null;

/** X-per-1-INR → INR-per-1-X, keeping only sane positive numbers. */
function invert(rates: Record<string, string | number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, v] of Object.entries(rates)) {
    const perInr = Number(v);
    if (Number.isFinite(perInr) && perInr > 0) out[code.toUpperCase()] = 1 / perInr;
  }
  return out;
}

export async function getRates(): Promise<FxRates | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  let inrPer: Record<string, number> = {};
  let source: FxRates["source"] = "market";
  try {
    await guard("fx");
    const res = await fetch(COINBASE, { cache: "no-store" });
    await spend("fx");
    if (res.ok) {
      const json = (await res.json()) as { data?: { rates?: Record<string, string> } };
      inrPer = invert(json.data?.rates ?? {});
    }
  } catch {
    // fall through to the daily feed
  }

  // Anything the market feed didn't quote comes from the daily feed.
  const missing = NEEDED.filter((c) => c !== "INR" && !inrPer[c]);
  if (missing.length) {
    const had = Object.keys(inrPer).length > 0;
    try {
      await guard("fx");
      const res = await fetch(DAILY, { cache: "no-store" });
      await spend("fx");
      if (res.ok) {
        const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
        if (json.result === "success" && json.rates) {
          const daily = invert(json.rates);
          for (const code of Object.keys(daily)) {
            if (!inrPer[code]) inrPer[code] = daily[code];
          }
          source = had ? "mixed" : "daily";
        }
      }
    } catch {
      // keep whatever we have
    }
  }

  if (!Object.keys(inrPer).length) return cache?.data ?? null;
  inrPer.INR = 1;
  const data: FxRates = { inrPer, updatedAt: new Date().toISOString(), source };
  cache = { at: Date.now(), data };
  return data;
}
