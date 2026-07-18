import { eq } from "drizzle-orm";
import { db, settings } from "@/lib/db";
import { DEFAULT_HARD_STOP } from "@/lib/config";

export type AppSettings = {
  hardStop: number; // 0..1 fraction of the free tier
  defaultCountry: string;
  defaultCategories: string[];
  fallbackLanguage: string; // outreach local-language fallback
};

export const DEFAULT_SETTINGS: AppSettings = {
  hardStop: DEFAULT_HARD_STOP,
  defaultCountry: "🌍 Global",
  defaultCategories: ["restaurant", "salon", "tailor"],
  fallbackLanguage: "Hindi",
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const rows = await db().select().from(settings).where(eq(settings.key, "app"));
    const stored = (rows[0]?.value ?? {}) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
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
