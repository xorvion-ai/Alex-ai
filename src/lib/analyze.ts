// AI deep analysis — one structured Gemini call per lead (quota-guarded).

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { GEMINI_MODEL, QUOTA_LIMITS } from "@/lib/config";
import { analyses, db, leads } from "@/lib/db";
import { canSpend, getUsage, guard, spend } from "@/lib/quota";
import { getSettings } from "@/lib/settings";
import { googlePlaceReviews, GoogleReview } from "@/lib/leadsource/google";

// Reviews are a nice-to-have: only spend Places quota on them while usage is
// comfortably low, so sweeps always keep priority on the free tier.
async function googleReviewsAllowed(): Promise<boolean> {
  const used = await getUsage("google_places");
  return (
    used < QUOTA_LIMITS.google_places.limit * 0.7 &&
    (await canSpend("google_places"))
  );
}

const AnalysisSchema = z.object({
  score: z.number().min(0).max(100).describe("How likely this business is to buy a website (0-100)"),
  reasoning: z.string().describe("2-3 sentences: why this score, citing concrete signals"),
  businessProfile: z
    .string()
    .describe("Plain-language summary of the business and what customers say, 2-4 sentences"),
  sitePlan: z.object({
    contentAngle: z.string().describe("Content/selling angle for THEIR future website, 2-3 sentences"),
    sellingPoints: z.array(z.string()).min(2).max(5).describe("Arguments to convince the owner to buy a website"),
    suggestedPages: z.array(z.string()).min(3).max(7).describe("Page names for their website"),
  }),
  outreach: z.object({
    localLanguageLabel: z
      .string()
      .describe("The local language's own name in its own script, uppercase-ish label, e.g. हिन्दी or ESPAÑOL"),
    whatsappEn: z.string().describe("First-contact WhatsApp message in English, warm, specific, < 90 words"),
    whatsappLocal: z.string().describe("Same message in the lead's local language"),
    callScript: z.array(z.string()).min(4).max(6).describe("Numbered phone call script steps"),
    bestCallWindow: z.string().describe("Best time window to call, derived from opening hours, short"),
  }),
});

export type AnalysisResult = z.infer<typeof AnalysisSchema>;

export async function analyzeLead(leadId: number): Promise<{ score: number }> {
  const d = db();
  const rows = await d.select().from(leads).where(eq(leads.id, leadId));
  const lead = rows[0];
  if (!lead) throw new Error("Lead not found");

  await guard("gemini");

  // Pull up to 5 reviews for Google leads when Places quota comfortably allows it.
  let reviews: GoogleReview[] = [];
  if (lead.source === "google" && (await googleReviewsAllowed())) {
    try {
      reviews = await googlePlaceReviews(lead.sourceId);
    } catch {
      reviews = [];
    }
  }

  const s = await getSettings();
  const prompt = [
    "You are the analysis engine of Alex.ai, a tool that finds small businesses with no website so the operator (a solo web developer) can sell them a simple, affordable website.",
    "Analyze this business and produce the structured result.",
    "",
    "Scoring guide: high rating + many reviews + no web presence = strong (80-100). Decent but moderate signals = 60-79. Weak activity, low rating, or unlikely to see value = below 60. OSM/TomTom leads without ratings: judge from category, address completeness, phone presence; cap at 75 unless other signals are strong.",
    "Outreach rules: mention concrete details (review count, rating, what customers praise) when available; never invent numbers that are not in the data. Friendly, zero pressure, offer a free demo. The local language: infer from the country/address" + (lead.languageHint ? ` (hint: ${lead.languageHint})` : "") + `; if truly ambiguous use ${s.fallbackLanguage}.`,
    "Best call window: infer from opening hours (avoid rush hours for restaurants, mid-morning for services); if hours unknown, suggest a sensible default for the category.",
    "",
    "BUSINESS DATA:",
    JSON.stringify(
      {
        name: lead.name,
        category: lead.category ?? lead.types?.[0] ?? null,
        types: lead.types,
        address: lead.address,
        area: lead.area,
        city: lead.city,
        country: lead.country,
        phone: lead.phone,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        priceLevel: lead.priceLevel,
        openingHours: lead.hours,
        websiteStatus: lead.websiteStatus,
        verifiedNoWebsite: lead.verifiedNoWebsite,
        socials: lead.socials,
        source: lead.source,
        reviews: reviews.map((r) => ({ rating: r.rating, text: r.text.slice(0, 400), when: r.when })),
      },
      null,
      1,
    ),
  ].join("\n");

  const { object } = await generateObject({
    model: google(GEMINI_MODEL),
    schema: AnalysisSchema,
    prompt,
  });
  await spend("gemini");

  const score = Math.round(object.score);
  await d.insert(analyses).values({
    leadId,
    model: GEMINI_MODEL,
    score,
    reasoning: object.reasoning,
    businessProfile: object.businessProfile,
    sitePlan: object.sitePlan,
    outreach: object.outreach,
  });
  await d
    .update(leads)
    .set({ score, status: "analyzed" })
    .where(eq(leads.id, leadId));

  return { score };
}

/** Analyze the oldest un-analyzed lead. Returns remaining count. */
export async function analyzeNextNew(): Promise<{
  analyzed: { id: number; name: string; score: number } | null;
  remaining: number;
}> {
  const d = db();
  const next = await d
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(eq(leads.status, "new"))
    .orderBy(sql`${leads.firstSeenAt} asc`)
    .limit(1);

  if (!next.length) return { analyzed: null, remaining: 0 };

  const { score } = await analyzeLead(next[0].id);
  const remainingRows = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.status, "new"));

  return {
    analyzed: { id: next[0].id, name: next[0].name, score },
    remaining: remainingRows[0]?.n ?? 0,
  };
}
