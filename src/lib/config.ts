// Central config — every tunable in one place.

// Shown in the sidebar. Read from package.json so the badge and the git tag
// can never disagree: bump the version there and this follows.
import pkg from "../../package.json";
export const APP_VERSION: string = pkg.version;

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
  // Google Maps Platform free tier is PER-SKU per month, and the FIELDS a
  // request asks for decide its SKU. Alex.ai asks for phone, website, rating and
  // opening hours, which is the TEXT SEARCH — ENTERPRISE SKU. On an India
  // billing account that SKU gets **7,000 free requests a month** (Essentials
  // 70k, Pro 35k, Enterprise 7k; IDs-only unlimited).
  //
  // Confirmed against the live account on 2026-10-05: 2,087 requests in 30 days
  // → ₹0.00 charged, ₹0.00 savings, "No credits used", and no transaction in any
  // billing period. An earlier guess of 1,000/month was simply wrong.
  //
  // All Places SKUs are pooled into this one counter and the Guardian hard-stops
  // at 90% = 6,300, leaving 700 requests of margin below the free tier — so the
  // bill stays ₹0 even with UPI autopay attached.
  // The ₹1 budget alert on the account is the tripwire: Google emails the
  // instant anything becomes billable. Nothing has, in three months.
  google_places: { limit: 7000, period: "month", label: "PLACES" },
  gemini: { limit: 1000, period: "day", label: "GEMINI" },
  tomtom: { limit: 2500, period: "day", label: "TOMTOM" },
  tavily: { limit: 1000, period: "month", label: "TAVILY" },
  // Coinbase market feed + open.er-api fallback: both free and keyless, refreshed
  // every 15 min at most, so a few thousand a month. The cap is only a leash.
  fx: { limit: 20000, period: "month", label: "FX" },
  // Cloud Monitoring READS (real Places usage from the console). Google's first
  // 1M read API calls/month are free; 5-min cache keeps this in the hundreds.
  gcp_monitoring: { limit: 5000, period: "month", label: "GCP MON" },
};

/**
 * Appended to the copied lead when asking ChatGPT for demo mockups. The chat
 * link itself is NOT in the code — it is a personal URL, so it lives in the
 * `chatgptUrl` setting (Settings screen, stored in your own database).
 */
export const CHATGPT_DEMO_LINE =
  "create an attractive demo website image for this as both pc and phone look";

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
  // Link-in-bio pages. A business whose Maps listing points at one of these has
  // a list of links, not a website — exactly the shop worth pitching. Linktree
  // is only the best known; the rest are its direct equivalents.
  "linktr.ee",
  "linktree.com",
  "beacons.ai",
  "bio.link",
  "taplink.cc",
  "lnk.bio",
  "solo.to",
  "campsite.bio",
  "heylink.me",
  "allmylinks.com",
  "milkshake.app",
  "shorby.com",
  "many.link",
  "linkpop.com",
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
  // Free page builders and auto-generated profile pages. A shop whose entire
  // web presence is one of these still needs a real site, so it stays a lead
  // and the link is kept as a social/contact channel instead.
  // ("sites.google.com" and "<name>.business.site" already match google.com.)
  "business.site",
  "wixsite.com",
  "wix.com",
  "blogspot.com",
  "wordpress.com",
  "weebly.com",
  "jimdosite.com",
  "webnode.com",
  "carrd.co",
  "mystrikingly.com",
  "square.site",
  "godaddysites.com",
  "myshopify.com",
  "glideapp.io",
  "canva.site",
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
export type CountryDef = { name: string; iso: string; lang: string; cur: string; sym: string; dial: string };

export const COUNTRY_TABLE: CountryDef[] = [
  { name: "United States", iso: "US", lang: "en-US", cur: "USD", sym: "$" , dial: "1" },
  { name: "Australia", iso: "AU", lang: "en-AU", cur: "AUD", sym: "A$" , dial: "61" },
  { name: "Brazil", iso: "BR", lang: "pt-BR", cur: "BRL", sym: "R$" , dial: "55" },
  { name: "Canada", iso: "CA", lang: "en-CA", cur: "CAD", sym: "C$" , dial: "1" },
  { name: "Switzerland", iso: "CH", lang: "de-CH", cur: "CHF", sym: "CHF" , dial: "41" },
  { name: "Liechtenstein", iso: "LI", lang: "de-LI", cur: "CHF", sym: "CHF" , dial: "423" },
  { name: "Czech Republic", iso: "CZ", lang: "cs-CZ", cur: "CZK", sym: "Kč" , dial: "420" },
  { name: "Denmark", iso: "DK", lang: "da-DK", cur: "DKK", sym: "kr" , dial: "45" },
  { name: "Greenland", iso: "GL", lang: "da-GL", cur: "DKK", sym: "kr" , dial: "299" },
  { name: "Faroe Islands", iso: "FO", lang: "fo-FO", cur: "DKK", sym: "kr" , dial: "298" },
  { name: "Austria", iso: "AT", lang: "de-AT", cur: "EUR", sym: "€" , dial: "43" },
  { name: "Belgium", iso: "BE", lang: "nl-BE", cur: "EUR", sym: "€" , dial: "32" },
  { name: "Croatia", iso: "HR", lang: "hr-HR", cur: "EUR", sym: "€" , dial: "385" },
  { name: "Cyprus", iso: "CY", lang: "el-CY", cur: "EUR", sym: "€" , dial: "357" },
  { name: "Estonia", iso: "EE", lang: "et-EE", cur: "EUR", sym: "€" , dial: "372" },
  { name: "Finland", iso: "FI", lang: "fi-FI", cur: "EUR", sym: "€" , dial: "358" },
  { name: "France", iso: "FR", lang: "fr-FR", cur: "EUR", sym: "€" , dial: "33" },
  { name: "Germany", iso: "DE", lang: "de-DE", cur: "EUR", sym: "€" , dial: "49" },
  { name: "Greece", iso: "GR", lang: "el-GR", cur: "EUR", sym: "€" , dial: "30" },
  { name: "Ireland", iso: "IE", lang: "en-IE", cur: "EUR", sym: "€" , dial: "353" },
  { name: "Italy", iso: "IT", lang: "it-IT", cur: "EUR", sym: "€" , dial: "39" },
  { name: "Latvia", iso: "LV", lang: "lv-LV", cur: "EUR", sym: "€" , dial: "371" },
  { name: "Lithuania", iso: "LT", lang: "lt-LT", cur: "EUR", sym: "€" , dial: "370" },
  { name: "Luxembourg", iso: "LU", lang: "fr-LU", cur: "EUR", sym: "€" , dial: "352" },
  { name: "Malta", iso: "MT", lang: "mt-MT", cur: "EUR", sym: "€" , dial: "356" },
  { name: "Netherlands", iso: "NL", lang: "nl-NL", cur: "EUR", sym: "€" , dial: "31" },
  { name: "Portugal", iso: "PT", lang: "pt-PT", cur: "EUR", sym: "€" , dial: "351" },
  { name: "Slovakia", iso: "SK", lang: "sk-SK", cur: "EUR", sym: "€" , dial: "421" },
  { name: "Slovenia", iso: "SI", lang: "sl-SI", cur: "EUR", sym: "€" , dial: "386" },
  { name: "Spain", iso: "ES", lang: "es-ES", cur: "EUR", sym: "€" , dial: "34" },
  { name: "United Kingdom", iso: "GB", lang: "en-GB", cur: "GBP", sym: "£" , dial: "44" },
  { name: "Hong Kong", iso: "HK", lang: "zh-HK", cur: "HKD", sym: "HK$" , dial: "852" },
  { name: "Hungary", iso: "HU", lang: "hu-HU", cur: "HUF", sym: "Ft" , dial: "36" },
  { name: "Israel", iso: "IL", lang: "he-IL", cur: "ILS", sym: "₪" , dial: "972" },
  { name: "Japan", iso: "JP", lang: "ja-JP", cur: "JPY", sym: "¥" , dial: "81" },
  { name: "Mexico", iso: "MX", lang: "es-MX", cur: "MXN", sym: "MX$" , dial: "52" },
  { name: "Norway", iso: "NO", lang: "nb-NO", cur: "NOK", sym: "kr" , dial: "47" },
  { name: "New Zealand", iso: "NZ", lang: "en-NZ", cur: "NZD", sym: "NZ$" , dial: "64" },
  { name: "Philippines", iso: "PH", lang: "fil-PH", cur: "PHP", sym: "₱" , dial: "63" },
  { name: "Poland", iso: "PL", lang: "pl-PL", cur: "PLN", sym: "zł" , dial: "48" },
  { name: "Sweden", iso: "SE", lang: "sv-SE", cur: "SEK", sym: "kr" , dial: "46" },
  { name: "Singapore", iso: "SG", lang: "en-SG", cur: "SGD", sym: "S$" , dial: "65" },
  { name: "Thailand", iso: "TH", lang: "th-TH", cur: "THB", sym: "฿" , dial: "66" },
  { name: "Taiwan", iso: "TW", lang: "zh-TW", cur: "TWD", sym: "NT$" , dial: "886" },
  { name: "India", iso: "IN", lang: "hi-IN", cur: "INR", sym: "₹" , dial: "91" },
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

/** Country name → international dialling code, e.g. "Mexico" → "52". */
export const DIAL_CODES: Record<string, string> = Object.fromEntries(
  COUNTRY_TABLE.map((c) => [c.name, c.dial]),
);

/**
 * A phone in full international form, which is the only form wa.me accepts and
 * the only one Google Places resolves.
 *
 * Sources hand back national numbers constantly — OSM almost always, Google
 * whenever it only has `nationalPhoneNumber`. `wa.me/3313463546` opens nothing;
 * `wa.me/523313463546` opens the chat. Returns the digits unchanged when they
 * already carry the country code, or when the country is unknown.
 */
/**
 * How many digits a *national* number has, per market. Only countries listed
 * here get a dialling code added, and only when the length matches exactly —
 * guessing is worse than leaving the number alone. Brazil's 8-digit landlines,
 * for instance, are missing their area code, so no prefix can save them.
 */
const NATIONAL_LEN: Record<string, number[]> = {
  "United States": [10], Canada: [10], Mexico: [10], Brazil: [10, 11],
  Spain: [9], Portugal: [9], Australia: [9], "New Zealand": [9],
  "United Kingdom": [10], India: [10], Ireland: [9], Germany: [10, 11],
  France: [9], Netherlands: [9], Belgium: [9], Italy: [9, 10],
  Poland: [9], Sweden: [9], Norway: [8], Denmark: [8], Finland: [9],
  Switzerland: [9], Austria: [10], Japan: [10], Singapore: [8],
  "Hong Kong": [8], Philippines: [10], Israel: [9], Greece: [10],
};

export function toInternational(
  digits: string | null | undefined,
  country: string | null | undefined,
): string | null {
  if (!digits) return null;
  const d = digits.replace(/\D/g, "");
  if (!d) return null;
  const code = country ? DIAL_CODES[country] : null;
  if (!code) return d;
  // already international
  if (d.startsWith(code) && d.length > code.length + 6) return d;
  // a national number often carries a trunk "0"; Italy is the exception that keeps it
  const national = country === "Italy" ? d : d.replace(/^0+/, "");
  const lengths = country ? NATIONAL_LEN[country] : undefined;
  if (!lengths?.includes(national.length)) return d; // unsure — leave it as found
  return code + national;
}

/** Does this country already speak the message's language? Then there is no
 *  "translation" to keep in step — the English box just mirrors the message. */
export function isEnglishCountry(country: string | null | undefined): boolean {
  return !!country && (LANGUAGE_HINTS[country] ?? "").startsWith("en");
}

export const LANGUAGE_HINTS: Record<string, string> = {
  ...Object.fromEntries(COUNTRY_TABLE.map((c) => [c.name, c.lang])),
  UAE: "ar-AE",
};
