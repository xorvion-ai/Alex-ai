// One-time seed: a single DEMO lead so every feature is visible before the
// first real sweep. Runs once ever (guarded by the 'seeded' settings key);
// archive the demo lead anytime and it never comes back.

import { eq } from "drizzle-orm";
import { activities, analyses, db, leads, settings } from "@/lib/db";

export async function ensureSeeded(): Promise<void> {
  try {
    const d = db();
    const done = await d.select().from(settings).where(eq(settings.key, "seeded"));
    if (done.length) return;
    await d.insert(settings).values({ key: "seeded", value: true });

    const inserted = await d
      .insert(leads)
      .values({
        source: "google",
        sourceId: "demo-lead-001",
        name: "Annapurna Bhojanalay",
        category: "restaurant",
        types: ["restaurant"],
        address: "14 MI Road, C-Scheme, Jaipur 302001",
        area: "C-Scheme",
        city: "Jaipur",
        country: "India",
        lat: 26.9124,
        lng: 75.7873,
        phone: "+91 141 237 8842",
        phoneIntl: "911412378842",
        rating: 4.6,
        reviewCount: 312,
        priceLevel: "$$",
        hours: "Tue–Sun 11:00–23:00",
        mapsUri:
          "https://www.google.com/maps/search/?api=1&query=Annapurna+Bhojanalay+Jaipur",
        websiteStatus: "social_only",
        verifiedNoWebsite: true,
        verifiedAt: new Date(),
        socials: ["https://facebook.com/annapurna.bhojanalay"],
        languageHint: "hi-IN",
        status: "analyzed",
        score: 91,
        isDemo: true,
      })
      .onConflictDoNothing()
      .returning({ id: leads.id });
    const leadId = inserted[0]?.id;
    if (!leadId) return;

    await d.insert(analyses).values({
      leadId,
      model: "demo-seed",
      score: 91,
      reasoning:
        "High rating (4.6) with strong review volume and consistent activity. Zero web presence beyond a Facebook page — web-verified. Customers rave about the dal baati churma — a clear, sellable need.",
      businessProfile:
        "A restaurant in C-Scheme, Jaipur with 312 Google reviews averaging 4.6★. Customers love the dal baati churma and the fast lunch service. Open Tue–Sun 11:00–23:00, price level ₹₹. No real website — customers rely on Google Maps and word of mouth.",
      sitePlan: {
        contentAngle:
          "Lead with what customers already love — the famous dal baati churma. One-page-feel site, mobile-first (their customers find them on phones via Maps), with a sticky call/WhatsApp button, a photo-forward menu, embedded Google reviews, and an 'open now' hours widget. Hindi + English toggle.",
        sellingPoints: [
          "312 reviews at 4.6★ and no website — customers literally ask for one.",
          "Competitors in C-Scheme with websites appear above them in searches.",
          "A one-time site pays for itself with 2–3 new customers.",
        ],
        suggestedPages: ["Home", "Menu", "Gallery", "Reviews", "Contact & Directions"],
      },
      outreach: {
        localLanguageLabel: "हिन्दी",
        whatsappEn:
          "Hi! I found Annapurna Bhojanalay on Google Maps — 312 reviews and people love your dal baati churma. But you have no website, so new customers can't find you online. I build simple, affordable websites for businesses like yours. Can I show you a free demo this week?",
        whatsappLocal:
          "नमस्ते! मैंने Google Maps पर Annapurna Bhojanalay देखा — 312 रिव्यू, 4.6★ रेटिंग। लेकिन आपकी कोई वेबसाइट नहीं है, इसलिए नए ग्राहक आपको ऑनलाइन नहीं ढूँढ पाते। मैं छोटे व्यवसायों के लिए सरल वेबसाइट बनाता हूँ। क्या मैं इस हफ़्ते एक फ्री डेमो दिखा सकता हूँ?",
        callScript: [
          "Namaste, am I speaking with the owner of Annapurna Bhojanalay? I'll take just one minute.",
          "I found you on Google Maps — 312 reviews, 4.6 stars. Honestly impressive, and people love your dal baati churma.",
          "One thing I noticed: you have no website, so people searching online find your competitors first.",
          "I build simple websites for local businesses — menu, photos, reviews, one-tap call button. Can I WhatsApp you a free demo?",
          "If yes → send demo + fix a follow-up. If busy → ask for a better time, log it.",
        ],
        bestCallWindow: "Tue–Sun 15:30–17:30 (between lunch & dinner)",
      },
    });

    await d.insert(activities).values({
      leadId,
      kind: "NOTE",
      note: "This is a DEMO lead so you can explore every tab. Run a sweep in Discover to find real leads — then archive me with ✓ CONTACTED.",
    });
  } catch {
    // seeding must never break the app (e.g. DB not configured yet)
  }
}
