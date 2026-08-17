import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";
import { COUNTRIES, DEFAULT_COUNTRY, DEFAULT_HARD_STOP } from "@/lib/config";

export type AppSettings = {
  hardStop: number; // 0..1 fraction of the free tier
  defaultCountry: string;
  defaultCategories: string[];
  fallbackLanguage: string; // outreach local-language fallback
  /** Google Cloud free-trial end date, "YYYY-MM-DD" ("" = no trial running) */
  trialEndsAt: string;
  /** Per-country WhatsApp templates that override DEFAULT_TEMPLATES (messages.ts) */
  messageTemplates: Record<string, string>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  hardStop: DEFAULT_HARD_STOP,
  defaultCountry: DEFAULT_COUNTRY,
  defaultCategories: ["restaurant", "salon", "tailor"],
  fallbackLanguage: "Hindi",
  // Sumit's current trial; editable in Settings, clear it once he upgrades.
  trialEndsAt: "2026-10-18",
  messageTemplates: {},
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const rows = await db().select().from(settings).where(eq(settings.key, "app"));
    const stored = (rows[0]?.value ?? {}) as Partial<AppSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // A country saved before the list changed (e.g. the old "Global") is no
    // longer selectable — fall back to the default market.
    if (!COUNTRIES.includes(merged.defaultCountry)) {
      merged.defaultCountry = DEFAULT_COUNTRY;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const merged = { ...(await getSettings()), ...patch };
  await db()
    .insert(settings)
    .values({ key: "app", value: merged })
    .onConflictDoUpdate({ target: settings.key, set: { value: merged } });
  return merged;
}
