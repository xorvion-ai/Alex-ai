"use client";

// Country flag as an IMAGE, not an emoji. Windows/Chrome does not render flag
// emoji (🇺🇸) — it shows the two regional-indicator letters ("US", "IN", "DE"),
// which is why the emoji flags looked broken. We render the Twemoji SVG from a
// free CDN instead, so real flags show on every platform. Renders nothing when
// the country isn't mapped (e.g. Global sweeps with no country).

const NAME_TO_ISO: Record<string, string> = {
  India: "IN",
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  Spain: "ES",
  Brazil: "BR",
  Mexico: "MX",
  Nigeria: "NG",
  UAE: "AE",
  "United Arab Emirates": "AE",
  Indonesia: "ID",
  Canada: "CA",
  Italy: "IT",
  Netherlands: "NL",
  Pakistan: "PK",
  Bangladesh: "BD",
  Turkey: "TR",
  "Saudi Arabia": "SA",
  Egypt: "EG",
  Malaysia: "MY",
  Argentina: "AR",
  "South Africa": "ZA",
};

function twemojiUrl(iso: string): string {
  const cps = [...iso.toUpperCase()]
    .map((ch) => (0x1f1e6 + ch.charCodeAt(0) - 65).toString(16))
    .join("-");
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cps}.svg`;
}

export function isoForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  return NAME_TO_ISO[country] ?? null;
}

export default function Flag({
  country,
  size = 14,
}: {
  country: string | null | undefined;
  size?: number;
}) {
  const iso = isoForCountry(country);
  if (!iso) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={twemojiUrl(iso)}
      alt={iso}
      title={country ?? iso}
      width={size}
      height={Math.round(size * 0.75)}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        borderRadius: 2,
        marginRight: 5,
        flex: "none",
      }}
      loading="lazy"
    />
  );
}
