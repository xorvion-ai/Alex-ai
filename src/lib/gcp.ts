// Real Places usage, read from Google Cloud Monitoring — the same number the
// console's "Requests" chart shows — so the dashboard can display Google's own
// count next to Alex.ai's local counter.
//
// Read-only and optional: without GCP_SERVICE_ACCOUNT_JSON everything here
// no-ops and the UI just shows the local counter. Monitoring READ calls are
// free (Google's first 1M read API calls/month are non-chargeable), and the
// result is cached for 5 minutes, so this stays inside the $0 rule. The Quota
// Guardian still gates on Alex.ai's own counter — a console number that can't
// be fetched must never let a call through.

import crypto from "node:crypto";
import { guard, spend } from "@/lib/quota";

type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    // .env files often keep the key with literal \n sequences.
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    return sa;
  } catch {
    return null;
  }
}

export function consoleSyncConfigured(): boolean {
  return !!serviceAccount() && !!projectId();
}

function projectId(): string | null {
  return process.env.GCP_PROJECT_ID?.trim() || serviceAccount()?.project_id || null;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let token: { value: string; exp: number } | null = null;

/** Service-account JWT → OAuth2 access token (monitoring.read), cached to expiry. */
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (token && Date.now() < token.exp - 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/monitoring.read",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = b64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  token = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return token.value;
}

export type ConsoleUsage = {
  /** Places API requests this calendar month, per Google */
  requests: number;
  since: string;
  fetchedAt: string;
};

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: ConsoleUsage } | null = null;

/**
 * Month-to-date Places request count from Cloud Monitoring
 * (`serviceruntime.googleapis.com/api/request_count`, summed over the month).
 * Returns null when console sync isn't configured or the read fails.
 */
export async function placesConsoleUsage(): Promise<ConsoleUsage | null> {
  const sa = serviceAccount();
  const project = projectId();
  if (!sa || !project) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    await guard("gcp_monitoring");
    const tok = await accessToken(sa);
    if (!tok) return cache?.data ?? null;

    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const params = new URLSearchParams({
      filter:
        'metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="places.googleapis.com"',
      "interval.startTime": start.toISOString(),
      "interval.endTime": new Date().toISOString(),
      "aggregation.alignmentPeriod": "86400s",
      "aggregation.perSeriesAligner": "ALIGN_SUM",
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
      view: "FULL",
    });
    const res = await fetch(
      `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(project)}/timeSeries?${params}`,
      { headers: { authorization: `Bearer ${tok}` }, cache: "no-store" },
    );
    await spend("gcp_monitoring");
    if (!res.ok) return cache?.data ?? null;
    const json = (await res.json()) as {
      timeSeries?: { points?: { value?: { int64Value?: string; doubleValue?: number } }[] }[];
    };
    let requests = 0;
    for (const series of json.timeSeries ?? []) {
      for (const point of series.points ?? []) {
        requests += Number(point.value?.int64Value ?? point.value?.doubleValue ?? 0);
      }
    }
    const data: ConsoleUsage = {
      requests: Math.round(requests),
      since: start.toISOString(),
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}
