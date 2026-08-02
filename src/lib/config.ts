// Central config — every tunable in one place.

// Sumit's pick: highest free daily request limit of the Gemini models.
// Override with GEMINI_MODEL env var if the ID ever changes.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export type Provider = "google_places" | "gemini" | "tomtom" | "tavily";

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
export type CountryDef = { name: string; iso: string; lang: string };

export const COUNTRY_TABLE: CountryDef[] = [
  { name: "United States", iso: "US", lang: "en-US" },
  { name: "Australia", iso: "AU", lang: "en-AU" },
  { name: "Brazil", iso: "BR", lang: "pt-BR" },
  { name: "Canada", iso: "CA", lang: "en-CA" },
  { name: "Switzerland", iso: "CH", lang: "de-CH" },
  { name: "Liechtenstein", iso: "LI", lang: "de-LI" },
  { name: "Czech Republic", iso: "CZ", lang: "cs-CZ" },
  { name: "Denmark", iso: "DK", lang: "da-DK" },
  { name: "Greenland", iso: "GL", lang: "da-GL" },
  { name: "Faroe Islands", iso: "FO", lang: "fo-FO" },
  { name: "Austria", iso: "AT", lang: "de-AT" },
  { name: "Belgium", iso: "BE", lang: "nl-BE" },
  { name: "Croatia", iso: "HR", lang: "hr-HR" },
  { name: "Cyprus", iso: "CY", lang: "el-CY" },
  { name: "Estonia", iso: "EE", lang: "et-EE" },
  { name: "Finland", iso: "FI", lang: "fi-FI" },
  { name: "France", iso: "FR", lang: "fr-FR" },
  { name: "Germany", iso: "DE", lang: "de-DE" },
  { name: "Greece", iso: "GR", lang: "el-GR" },
  { name: "Ireland", iso: "IE", lang: "en-IE" },
  { name: "Italy", iso: "IT", lang: "it-IT" },
  { name: "Latvia", iso: "LV", lang: "lv-LV" },
  { name: "Lithuania", iso: "LT", lang: "lt-LT" },
  { name: "Luxembourg", iso: "LU", lang: "fr-LU" },
  { name: "Malta", iso: "MT", lang: "mt-MT" },
  { name: "Netherlands", iso: "NL", lang: "nl-NL" },
  { name: "Portugal", iso: "PT", lang: "pt-PT" },
  { name: "Slovakia", iso: "SK", lang: "sk-SK" },
  { name: "Slovenia", iso: "SI", lang: "sl-SI" },
  { name: "Spain", iso: "ES", lang: "es-ES" },
  { name: "United Kingdom", iso: "GB", lang: "en-GB" },
  { name: "Hong Kong", iso: "HK", lang: "zh-HK" },
  { name: "Hungary", iso: "HU", lang: "hu-HU" },
  { name: "Israel", iso: "IL", lang: "he-IL" },
  { name: "Japan", iso: "JP", lang: "ja-JP" },
  { name: "Mexico", iso: "MX", lang: "es-MX" },
  { name: "Norway", iso: "NO", lang: "nb-NO" },
  { name: "New Zealand", iso: "NZ", lang: "en-NZ" },
  { name: "Philippines", iso: "PH", lang: "fil-PH" },
  { name: "Poland", iso: "PL", lang: "pl-PL" },
  { name: "Sweden", iso: "SE", lang: "sv-SE" },
  { name: "Singapore", iso: "SG", lang: "en-SG" },
  { name: "Thailand", iso: "TH", lang: "th-TH" },
  { name: "Taiwan", iso: "TW", lang: "zh-TW" },
  { name: "India", iso: "IN", lang: "hi-IN" },
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

export const LANGUAGE_HINTS: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.lang])),
  UAE: "ar-AE",
};
