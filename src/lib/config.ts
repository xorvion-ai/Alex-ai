// Central config — every tunable in one place.

// Sumit's pick: highest free daily request limit of the Gemini models.
// Override with GEMINI_MODEL env var if the ID ever changes.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export type Provider = "google_places" | "gemini" | "tomtom" | "tavily" | "fx" | "gcp_monitoring";

// Free-tier caps. Conservative: all Google Places SKUs share one monthly pool
// so the guardian can never be tricked by SKU mix. TomTom free tier is 2,500
// non-tile requests/day (no card); Tavily free plan is 1,000 searches/month
// (no card) — both capped below their limits.
export const QUOTA_LIMITS: Record<
  Provider,
  { limit: number; period: "month" | "day"; label: string }
> = {
  // Google Maps Platform free tier is PER-SKU per month (since Mar 2025, replaced
  // the $200 credit): Essentials 10k, Pro 5k, Enterprise 1k. Alex.ai's Text
  // Search requests rating/userRatingCount/priceLevel → the ENTERPRISE SKU →
  // 1,000 free/month. All Places SKUs are pooled into this one counter and the
  // Guardian hard-stops at 90% = 900, so the pooled total can never cross any
  // single SKU's 1,000 free tier → zero billing even with UPI autopay active.
  // Daily quota caps are NOT adjustable on this account, so this app-side cap is
  // the no-bill guarantee.
  google_places: { limit: 1000, period: "month", label: "PLACES" },
  gemini: { limit: 1000, period: "day", label: "GEMINI" },
  tomtom: { limit: 2500, period: "day", label: "TOMTOM" },
  tavily: { limit: 1000, period: "month", label: "TAVILY" },
  // open.er-api.com: free, keyless, daily rates. Cached 12h server-side, so
  // this counter should sit near 60/month.
  fx: { limit: 1000, period: "month", label: "FX" },
  // Cloud Monitoring READS (real Places usage from the console). Google's first
  // 1M read API calls/month are free; 5-min cache keeps this in the hundreds.
  gcp_monitoring: { limit: 5000, period: "month", label: "GCP MON" },
};

export const DEFAULT_HARD_STOP = 0.9; // stop at 90% of free tier

// Max result pages per Google text-search query (20 places each).
export const GOOGLE_MAX_PAGES = 3;

// Max OSM elements pulled per Overpass query.
export const OSM_MAX_ELEMENTS = 400;

// "Website" hosts that are NOT a real website — these leads still need one.
export const SOCIAL_HOSTS = [
  "facebook.com",
  "m.facebook.com",
  "fb.com",
  "instagram.com",
  "wa.me",
  "whatsapp.com",
  "api.whatsapp.com",
  "linktr.ee",
  "t.me",
  "telegram.me",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "business.site", // discontinued Google Business sites
];

// Directory profile pages that businesses sometimes list as their "website".
export const DIRECTORY_HOSTS = [
  "justdial.com",
  "zomato.com",
  "swiggy.com",
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.com",
  "foursquare.com",
  "indiamart.com",
  "sulekha.com",
  "magicpin.in",
  "nearbuy.com",
  "dineout.co.in",
  "practo.com",
  "urbanpro.com",
  "google.com",
  "g.page",
  "goo.gl",
];

// Hosts to ignore entirely when web-verifying (never count as "their website").
export const VERIFY_IGNORE_HOSTS = [
  ...SOCIAL_HOSTS,
  ...DIRECTORY_HOSTS,
  "openstreetmap.org",
  "maps.google.com",
  "wikipedia.org",
  "wikidata.org",
  "linkedin.com",
  "pinterest.com",
];

// Countries Alex.ai sells into — Sumit's payout-supported markets. One table
// feeds the dropdowns, the flags and the outreach language hints. There is no
// "Global" option: a sweep always targets one country.
export type CountryDef = { name: string; iso: string; lang: string; cur: string; sym: string };

export const COUNTRY_TABLE: CountryDef[] = [
  { name: "United States", iso: "US", lang: "en-US", cur: "USD", sym: "$" },
  { name: "Australia", iso: "AU", lang: "en-AU", cur: "AUD", sym: "A$" },
  { name: "Brazil", iso: "BR", lang: "pt-BR", cur: "BRL", sym: "R$" },
  { name: "Canada", iso: "CA", lang: "en-CA", cur: "CAD", sym: "C$" },
  { name: "Switzerland", iso: "CH", lang: "de-CH", cur: "CHF", sym: "CHF" },
  { name: "Liechtenstein", iso: "LI", lang: "de-LI", cur: "CHF", sym: "CHF" },
  { name: "Czech Republic", iso: "CZ", lang: "cs-CZ", cur: "CZK", sym: "Kč" },
  { name: "Denmark", iso: "DK", lang: "da-DK", cur: "DKK", sym: "kr" },
  { name: "Greenland", iso: "GL", lang: "da-GL", cur: "DKK", sym: "kr" },
  { name: "Faroe Islands", iso: "FO", lang: "fo-FO", cur: "DKK", sym: "kr" },
  { name: "Austria", iso: "AT", lang: "de-AT", cur: "EUR", sym: "€" },
  { name: "Belgium", iso: "BE", lang: "nl-BE", cur: "EUR", sym: "€" },
  { name: "Croatia", iso: "HR", lang: "hr-HR", cur: "EUR", sym: "€" },
  { name: "Cyprus", iso: "CY", lang: "el-CY", cur: "EUR", sym: "€" },
  { name: "Estonia", iso: "EE", lang: "et-EE", cur: "EUR", sym: "€" },
  { name: "Finland", iso: "FI", lang: "fi-FI", cur: "EUR", sym: "€" },
  { name: "France", iso: "FR", lang: "fr-FR", cur: "EUR", sym: "€" },
  { name: "Germany", iso: "DE", lang: "de-DE", cur: "EUR", sym: "€" },
  { name: "Greece", iso: "GR", lang: "el-GR", cur: "EUR", sym: "€" },
  { name: "Ireland", iso: "IE", lang: "en-IE", cur: "EUR", sym: "€" },
  { name: "Italy", iso: "IT", lang: "it-IT", cur: "EUR", sym: "€" },
  { name: "Latvia", iso: "LV", lang: "lv-LV", cur: "EUR", sym: "€" },
  { name: "Lithuania", iso: "LT", lang: "lt-LT", cur: "EUR", sym: "€" },
  { name: "Luxembourg", iso: "LU", lang: "fr-LU", cur: "EUR", sym: "€" },
  { name: "Malta", iso: "MT", lang: "mt-MT", cur: "EUR", sym: "€" },
  { name: "Netherlands", iso: "NL", lang: "nl-NL", cur: "EUR", sym: "€" },
  { name: "Portugal", iso: "PT", lang: "pt-PT", cur: "EUR", sym: "€" },
  { name: "Slovakia", iso: "SK", lang: "sk-SK", cur: "EUR", sym: "€" },
  { name: "Slovenia", iso: "SI", lang: "sl-SI", cur: "EUR", sym: "€" },
  { name: "Spain", iso: "ES", lang: "es-ES", cur: "EUR", sym: "€" },
  { name: "United Kingdom", iso: "GB", lang: "en-GB", cur: "GBP", sym: "£" },
  { name: "Hong Kong", iso: "HK", lang: "zh-HK", cur: "HKD", sym: "HK$" },
  { name: "Hungary", iso: "HU", lang: "hu-HU", cur: "HUF", sym: "Ft" },
  { name: "Israel", iso: "IL", lang: "he-IL", cur: "ILS", sym: "₪" },
  { name: "Japan", iso: "JP", lang: "ja-JP", cur: "JPY", sym: "¥" },
  { name: "Mexico", iso: "MX", lang: "es-MX", cur: "MXN", sym: "MX$" },
  { name: "Norway", iso: "NO", lang: "nb-NO", cur: "NOK", sym: "kr" },
  { name: "New Zealand", iso: "NZ", lang: "en-NZ", cur: "NZD", sym: "NZ$" },
  { name: "Philippines", iso: "PH", lang: "fil-PH", cur: "PHP", sym: "₱" },
  { name: "Poland", iso: "PL", lang: "pl-PL", cur: "PLN", sym: "zł" },
  { name: "Sweden", iso: "SE", lang: "sv-SE", cur: "SEK", sym: "kr" },
  { name: "Singapore", iso: "SG", lang: "en-SG", cur: "SGD", sym: "S$" },
  { name: "Thailand", iso: "TH", lang: "th-TH", cur: "THB", sym: "฿" },
  { name: "Taiwan", iso: "TW", lang: "zh-TW", cur: "TWD", sym: "NT$" },
  { name: "India", iso: "IN", lang: "hi-IN", cur: "INR", sym: "₹" },
];

/** Dropdown values, e.g. "🇺🇸 United States". */
export const COUNTRIES = COUNTRY_TABLE.map((c) => `${isoToFlagEmoji(c.iso)} ${c.name}`);

/** Default market for sweeps and settings. */
export const DEFAULT_COUNTRY = COUNTRIES[COUNTRY_TABLE.findIndex((c) => c.name === "India")];

/** Leads-filter-only value meaning "don't filter by country". */
export const ANY_COUNTRY = "◍ All countries";

/** Regional-indicator pair for an ISO2 code — "IN" -> 🇮🇳 */
export function isoToFlagEmoji(iso: string): string {
  return [...iso.toUpperCase()]
    .map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
    .join("");
}

/** ISO2 by country name, with aliases for older stored rows. */
export const COUNTRY_ISO: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.iso])),
  UAE: "AE",
  "United Arab Emirates": "AE",
  Indonesia: "ID",
  Nigeria: "NG",
};

/**
 * Strip the flag emoji: "🇮🇳 India" -> "India". Returns "" for the leads
 * filter's "All countries" (and any unknown value), meaning "no country bias".
 */
export function countryName(c: string): string {
  const name = c.replace(/^[^\p{L}]*/u, "").trim();
  return COUNTRY_ISO[name] ? name : "";
}

/** Currency (ISO 4217 + symbol) for a country name — INR when unknown. */
export function currencyOf(country: string | null | undefined): { cur: string; sym: string } {
  const row = country ? COUNTRY_TABLE.find((c) => c.name === country) : null;
  return row ? { cur: row.cur, sym: row.sym } : { cur: "INR", sym: "₹" };
}

export const LANGUAGE_HINTS: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.lang])),
  UAE: "ar-AE",
};
