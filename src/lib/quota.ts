import { sql } from "drizzle-orm";
import { db, quotaUsage } from "@/lib/db";
import { Provider, QUOTA_LIMITS } from "@/lib/config";
import { getSettings } from "@/lib/settings";

function periodKey(provider: Provider): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (QUOTA_LIMITS[provider].period === "day") {
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return `${y}-${m}`;
}

export async function getUsage(provider: Provider): Promise<number> {
  const rows = await db()
    .select({ count: quotaUsage.count })
    .from(quotaUsage)
    .where(
      sql`${quotaUsage.provider} = ${provider} and ${quotaUsage.period} = ${periodKey(provider)}`,
    );
  return rows[0]?.count ?? 0;
}

export class QuotaExceededError extends Error {
  provider: Provider;
  constructor(provider: Provider) {
    super(
      `${provider} free-tier hard-stop reached — Quota Guardian blocked the call`,
    );
    this.provider = provider;
  }
}

/** True if `n` more calls stay under the hard-stop threshold. */
export async function canSpend(provider: Provider, n = 1): Promise<boolean> {
  const s = await getSettings();
  const cap = Math.floor(QUOTA_LIMITS[provider].limit * s.hardStop);
  const used = await getUsage(provider);
  return used + n <= cap;
}

/** Record `n` calls. Call AFTER the request is actually made. */
export async function spend(provider: Provider, n = 1): Promise<void> {
  await db()
    .insert(quotaUsage)
    .values({ provider, period: periodKey(provider), count: n })
    .onConflictDoUpdate({
      target: [quotaUsage.provider, quotaUsage.period],
      set: { count: sql`${quotaUsage.count} + ${n}` },
    });
}

/** Guardian gate: throws if the next `n` calls would cross the hard-stop. */
export async function guard(provider: Provider, n = 1): Promise<void> {
  if (!(await canSpend(provider, n))) throw new QuotaExceededError(provider);
}

export type QuotaSnapshot = {
  provider: Provider;
  label: string;
  used: number;
  limit: number;
  period: "month" | "day";
}[];

export async function getQuotaSnapshot(): Promise<QuotaSnapshot> {
  const providers = Object.keys(QUOTA_LIMITS) as Provider[];
  return Promise.all(
    providers.map(async (p) => ({
      provider: p,
      label: QUOTA_LIMITS[p].label,
      used: await getUsage(p),
      limit: QUOTA_LIMITS[p].limit,
      period: QUOTA_LIMITS[p].period,
    })),
  );
}
