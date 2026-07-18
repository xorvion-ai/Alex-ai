// Client-side helpers shared by all pages.

export class ApiError extends Error {
  status: number;
  quotaBlocked: boolean;
  constructor(message: string, status: number, quotaBlocked = false) {
    super(message);
    this.status = status;
    this.quotaBlocked = quotaBlocked;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new ApiError("unauthorized", 401);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json.error ?? `request failed (${res.status})`, res.status, !!json.quotaBlocked);
  }
  return json as T;
}

export function scoreColor(s: number | null | undefined): string {
  if (s == null) return "var(--muted)";
  return s >= 80 ? "#4ade80" : s >= 60 ? "#d9d9a0" : "#7a828c";
}

export function scoreLabel(s: number | null | undefined): string {
  if (s == null) return "NEW";
  return s >= 80 ? "STRONG" : s >= 60 ? "MEDIUM" : "WEAK";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export type LeadDto = {
  id: number;
  source: "google" | "osm";
  sourceId: string;
  name: string;
  category: string | null;
  types: string[] | null;
  address: string | null;
  area: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  phoneIntl: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  hours: string | null;
  mapsUri: string | null;
  websiteStatus: "none" | "social_only";
  verifiedNoWebsite: boolean | null;
  verifiedAt: string | null;
  socials: string[] | null;
  languageHint: string | null;
  status: "new" | "analyzed";
  score: number | null;
  firstSeenAt: string;
  lastRefreshedAt: string;
};

export type AnalysisDto = {
  id: number;
  leadId: number;
  model: string;
  score: number;
  reasoning: string;
  businessProfile: string;
  sitePlan: { contentAngle: string; sellingPoints: string[]; suggestedPages: string[] };
  outreach: {
    localLanguageLabel: string;
    whatsappEn: string;
    whatsappLocal: string;
    callScript: string[];
    bestCallWindow: string;
  };
  createdAt: string;
};

export type ActivityDto = {
  id: number;
  leadId: number;
  kind: string;
  note: string;
  dueAt: string | null;
  done: boolean;
  createdAt: string;
};

export type QuotaDto = {
  provider: string;
  label: string;
  used: number;
  limit: number;
  period: "month" | "day";
}[];
