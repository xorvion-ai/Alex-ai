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

// Countries Alex.ai sells into — the set PayPal India can receive business
// payments from (plus Global for an unbiased sweep). One table feeds the
// dropdowns, the flags and the outreach language hints.
export type CountryDef = { name: string; iso: string; lang: string };

export const COUNTRY_TABLE: CountryDef[] = [
  { name: "India", iso: "IN", lang: "hi-IN" },
  { name: "United States", iso: "US", lang: "en-US" },
  { name: "Canada", iso: "CA", lang: "en-CA" },
  { name: "Mexico", iso: "MX", lang: "es-MX" },
  { name: "United Kingdom", iso: "GB", lang: "en-GB" },
  { name: "Ireland", iso: "IE", lang: "en-IE" },
  { name: "Germany", iso: "DE", lang: "de-DE" },
  { name: "France", iso: "FR", lang: "fr-FR" },
  { name: "Spain", iso: "ES", lang: "es-ES" },
  { name: "Italy", iso: "IT", lang: "it-IT" },
  { name: "Netherlands", iso: "NL", lang: "nl-NL" },
  { name: "Belgium", iso: "BE", lang: "nl-BE" },
  { name: "Luxembourg", iso: "LU", lang: "fr-LU" },
  { name: "Austria", iso: "AT", lang: "de-AT" },
  { name: "Switzerland", iso: "CH", lang: "de-CH" },
  { name: "Portugal", iso: "PT", lang: "pt-PT" },
  { name: "Sweden", iso: "SE", lang: "sv-SE" },
  { name: "Norway", iso: "NO", lang: "nb-NO" },
  { name: "Denmark", iso: "DK", lang: "da-DK" },
  { name: "Finland", iso: "FI", lang: "fi-FI" },
  { name: "Poland", iso: "PL", lang: "pl-PL" },
  { name: "Czech Republic", iso: "CZ", lang: "cs-CZ" },
  { name: "Slovakia", iso: "SK", lang: "sk-SK" },
  { name: "Hungary", iso: "HU", lang: "hu-HU" },
  { name: "Romania", iso: "RO", lang: "ro-RO" },
  { name: "Bulgaria", iso: "BG", lang: "bg-BG" },
  { name: "Croatia", iso: "HR", lang: "hr-HR" },
  { name: "Slovenia", iso: "SI", lang: "sl-SI" },
  { name: "Estonia", iso: "EE", lang: "et-EE" },
  { name: "Latvia", iso: "LV", lang: "lv-LV" },
  { name: "Lithuania", iso: "LT", lang: "lt-LT" },
  { name: "Greece", iso: "GR", lang: "el-GR" },
  { name: "Malta", iso: "MT", lang: "mt-MT" },
  { name: "Cyprus", iso: "CY", lang: "el-CY" },
  { name: "Iceland", iso: "IS", lang: "is-IS" },
  { name: "Ukraine", iso: "UA", lang: "uk-UA" },
  { name: "Australia", iso: "AU", lang: "en-AU" },
  { name: "New Zealand", iso: "NZ", lang: "en-NZ" },
  { name: "Japan", iso: "JP", lang: "ja-JP" },
  { name: "Singapore", iso: "SG", lang: "en-SG" },
  { name: "Hong Kong", iso: "HK", lang: "zh-HK" },
  { name: "Taiwan", iso: "TW", lang: "zh-TW" },
  { name: "South Korea", iso: "KR", lang: "ko-KR" },
  { name: "Malaysia", iso: "MY", lang: "ms-MY" },
  { name: "Philippines", iso: "PH", lang: "fil-PH" },
  { name: "Thailand", iso: "TH", lang: "th-TH" },
  { name: "Indonesia", iso: "ID", lang: "id-ID" },
  { name: "Vietnam", iso: "VN", lang: "vi-VN" },
  { name: "China", iso: "CN", lang: "zh-CN" },
  { name: "Israel", iso: "IL", lang: "he-IL" },
  { name: "United Arab Emirates", iso: "AE", lang: "ar-AE" },
  { name: "Saudi Arabia", iso: "SA", lang: "ar-SA" },
  { name: "Qatar", iso: "QA", lang: "ar-QA" },
  { name: "Kuwait", iso: "KW", lang: "ar-KW" },
  { name: "Bahrain", iso: "BH", lang: "ar-BH" },
  { name: "Oman", iso: "OM", lang: "ar-OM" },
  { name: "Brazil", iso: "BR", lang: "pt-BR" },
  { name: "Argentina", iso: "AR", lang: "es-AR" },
  { name: "Chile", iso: "CL", lang: "es-CL" },
  { name: "Colombia", iso: "CO", lang: "es-CO" },
  { name: "Peru", iso: "PE", lang: "es-PE" },
  { name: "Uruguay", iso: "UY", lang: "es-UY" },
  { name: "Costa Rica", iso: "CR", lang: "es-CR" },
  { name: "Panama", iso: "PA", lang: "es-PA" },
  { name: "Dominican Republic", iso: "DO", lang: "es-DO" },
  { name: "Guatemala", iso: "GT", lang: "es-GT" },
  { name: "Ecuador", iso: "EC", lang: "es-EC" },
  { name: "Paraguay", iso: "PY", lang: "es-PY" },
  { name: "South Africa", iso: "ZA", lang: "en-ZA" },
  { name: "Kenya", iso: "KE", lang: "sw-KE" },
  { name: "Nigeria", iso: "NG", lang: "en-NG" },
  { name: "Egypt", iso: "EG", lang: "ar-EG" },
  { name: "Morocco", iso: "MA", lang: "ar-MA" },
  { name: "Ghana", iso: "GH", lang: "en-GH" },
  { name: "Mauritius", iso: "MU", lang: "fr-MU" },
  { name: "Botswana", iso: "BW", lang: "en-BW" },
  { name: "Namibia", iso: "NA", lang: "en-NA" },
  { name: "Uganda", iso: "UG", lang: "en-UG" },
  { name: "Tanzania", iso: "TZ", lang: "sw-TZ" },
  { name: "Zambia", iso: "ZM", lang: "en-ZM" },
  { name: "Zimbabwe", iso: "ZW", lang: "en-ZW" },
];

/** Dropdown values: "🌍 Global" first, then "🇮🇳 India" etc. */
export const COUNTRIES = [
  "🌍 Global",
  ...COUNTRY_TABLE.map((c) => `${isoToFlagEmoji(c.iso)} ${c.name}`),
];

/** Regional-indicator pair for an ISO2 code — "IN" -> 🇮🇳 */
export function isoToFlagEmoji(iso: string): string {
  return [...iso.toUpperCase()]
    .map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
    .join("");
}

/** ISO2 by country name, with a couple of aliases for older stored rows. */
export const COUNTRY_ISO: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.iso])),
  UAE: "AE",
  "Czechia": "CZ",
  Vietnam: "VN",
};

// Strip the flag emoji: "🇮🇳 India" -> "India"; "🌍 Global" -> "" (no country bias)
export function countryName(c: string): string {
  const name = c.replace(/^[^\p{L}]*/u, "").trim();
  return name === "Global" ? "" : name;
}

export const LANGUAGE_HINTS: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.lang])),
  UAE: "ar-AE",
};
