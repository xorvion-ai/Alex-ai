// The never-again list.
//
// A sweep of the same city returns the same businesses every time, so a lead you
// contacted or deleted would simply come back on the next run. Every one of
// those exits records the business here by its source id, and the sweep's
// insert checks this list first (see insertLead in sweep.ts).

import { and, eq, sql } from "drizzle-orm";
import { db, leads, skipped } from "@/lib/db";

export type SkipReason = "contacted" | "deleted" | "has_website" | "closed";

type LeadRow = typeof leads.$inferSelect;

/** Never scan this business again. Never throws — it must not block the exit. */
export async function skipLead(
  lead: Pick<LeadRow, "source" | "sourceId" | "name" | "phone" | "country" | "category">,
  reason: SkipReason,
): Promise<void> {
  try {
    await db()
      .insert(skipped)
      .values({
        source: lead.source,
        sourceId: lead.sourceId,
        name: lead.name,
        phone: lead.phone,
        country: lead.country,
        category: lead.category,
        reason,
      })
      .onConflictDoNothing({ target: [skipped.source, skipped.sourceId] });
  } catch {
    // the contact / delete itself matters more than the bookkeeping
  }
}

/** Last 9 digits of a phone — the same number written +1 416…, 416… or (416)…. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-9) : null;
}

/**
 * Has this business been contacted or deleted before? Matched by the source's
 * own id, and by phone as well — the same shop comes back under a different id
 * from a different source, and the phone is what proves it is the same business.
 */
export async function isSkipped(
  source: string,
  sourceId: string,
  phone?: string | null,
): Promise<boolean> {
  const rows = await db()
    .select({ id: skipped.id })
    .from(skipped)
    .where(and(eq(skipped.source, source), eq(skipped.sourceId, sourceId)))
    .limit(1);
  if (rows.length) return true;

  const key = phoneKey(phone);
  if (!key) return false;
  const byPhone = await db()
    .select({ id: skipped.id })
    .from(skipped)
    .where(sql`right(regexp_replace(coalesce(${skipped.phone}, ''), '[^0-9]', '', 'g'), 9) = ${key}`)
    .limit(1);
  return byPhone.length > 0;
}

/** Restoring from the trash undoes the skip, or it could never be found again. */
export async function unskip(source: string, sourceId: string): Promise<void> {
  try {
    await db()
      .delete(skipped)
      .where(and(eq(skipped.source, source), eq(skipped.sourceId, sourceId)));
  } catch {
    // best effort
  }
}
