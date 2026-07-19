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

export const COUNTRIES = [
  "🌍 Global",
  "🇮🇳 India",
  "🇺🇸 United States",
  "🇬🇧 United Kingdom",
  "🇩🇪 Germany",
  "🇫🇷 France",
  "🇪🇸 Spain",
  "🇧🇷 Brazil",
  "🇲🇽 Mexico",
  "🇳🇬 Nigeria",
  "🇦🇪 UAE",
  "🇮🇩 Indonesia",
];

// Strip the flag emoji: "🇮🇳 India" -> "India"; "🌍 Global" -> "" (no country bias)
export function countryName(c: string): string {
  const name = c.replace(/^[^\p{L}]*/u, "").trim();
  return name === "Global" ? "" : name;
}

export const LANGUAGE_HINTS: Record<string, string> = {
  India: "hi-IN",
  "United States": "en-US",
  "United Kingdom": "en-GB",
  Germany: "de-DE",
  France: "fr-FR",
  Spain: "es-ES",
  Brazil: "pt-BR",
  Mexico: "es-MX",
  Nigeria: "en-NG",
  UAE: "ar-AE",
  Indonesia: "id-ID",
};
