import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { jsonError } from "@/lib/api";

function maskKey(v: string | undefined): string | null {
  if (!v) return null;
  if (v.length <= 9) return v[0] + "…";
  return `${v.slice(0, 6)}${"…".repeat(1)}${v.slice(-3)}`;
}

export async function GET() {
  try {
    const s = await getSettings();
    return NextResponse.json({
      settings: s,
      keys: {
        googlePlaces: maskKey(process.env.GOOGLE_PLACES_API_KEY),
        gemini: maskKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        brave: maskKey(process.env.BRAVE_SEARCH_API_KEY),
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const patch = await req.json();
    const allowed: Record<string, unknown> = {};
    if (typeof patch.hardStop === "number" && patch.hardStop >= 0.1 && patch.hardStop <= 1)
      allowed.hardStop = patch.hardStop;
    if (typeof patch.defaultCountry === "string") allowed.defaultCountry = patch.defaultCountry;
    if (Array.isArray(patch.defaultCategories))
      allowed.defaultCategories = patch.defaultCategories.filter((c: unknown) => typeof c === "string");
    if (typeof patch.fallbackLanguage === "string") allowed.fallbackLanguage = patch.fallbackLanguage;
    const merged = await saveSettings(allowed);
    return NextResponse.json({ settings: merged });
  } catch (e) {
    return jsonError(e);
  }
}
