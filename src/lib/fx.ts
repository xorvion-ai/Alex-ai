// Exchange rates → INR, so a lead's prices can be read in rupees.
// Source: open.er-api.com — free, no key, no card, daily updates. Cached for
// 12h in memory (≈2 calls/day) and still metered through the Quota Guardian.

import { guard, spend } from "@/lib/quota";

const URL = "https://open.er-api.com/v6/latest/INR";
const TTL_MS = 12 * 60 * 60 * 1000;

export type FxRates = {
  /** INR per 1 unit of the currency, e.g. { EUR: 95.2, USD: 88.1 } */
  inrPer: Record<string, number>;
  updatedAt: string;
};

let cache: { at: number; data: FxRates } | null = null;

export async function getRates(): Promise<FxRates | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    await guard("fx");
    const res = await fetch(URL, { cache: "no-store" });
    await spend("fx");
    if (!res.ok) return cache?.data ?? null;
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (json.result !== "success" || !json.rates) return cache?.data ?? null;
    // The feed gives "X per 1 INR"; we want INR per 1 X.
    const inrPer: Record<string, number> = {};
    for (const [code, perInr] of Object.entries(json.rates)) {
      if (perInr > 0) inrPer[code] = 1 / perInr;
    }
    const data: FxRates = {
      inrPer,
      updatedAt: json.time_last_update_utc ?? new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Guardian block or network failure — serve whatever we already have.
    return cache?.data ?? null;
  }
}
