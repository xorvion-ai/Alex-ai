// A one-hour holding bay for deleted leads.
//
// Every delete path — the DELETE button and the automatic drops when a web check
// finds the business already has a website — copies the row here first. The
// dashboard's DELETED LIST reads it, a lead can be restored from it, and rows
// older than an hour are purged permanently (lazily, on every read and write, so
// no cron job is needed).
//
// It reuses the old `contacted_archive` table, which already had exactly the
// right shape (lead_name + snapshot jsonb + archived_at) and was otherwise dead.

import { lt, sql } from "drizzle-orm";
import { contactedArchive, db, leads } from "@/lib/db";

export const TRASH_TTL_MS = 60 * 60 * 1000;

export type TrashReason = "deleted" | "has_website";

type LeadRow = typeof leads.$inferSelect;

/** Copy a lead into the trash. Never throws — a failed copy must not block a delete. */
export async function trashLead(
  lead: LeadRow,
  reason: TrashReason,
  foundSite?: string | null,
): Promise<void> {
  try {
    await db()
      .insert(contactedArchive)
      .values({
        leadName: lead.name,
        snapshot: { lead, reason, foundSite: foundSite ?? null },
      });
    await purgeExpired();
  } catch {
    // the delete itself matters more than the safety copy
  }
}

/** Drop everything older than the TTL — permanently. */
export async function purgeExpired(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_TTL_MS);
  const gone = await db()
    .delete(contactedArchive)
    .where(lt(contactedArchive.archivedAt, cutoff))
    .returning({ id: contactedArchive.id });
  return gone.length;
}

export type TrashRow = {
  id: number;
  name: string;
  phone: string | null;
  country: string | null;
  category: string | null;
  score: number | null;
  reason: TrashReason;
  foundSite: string | null;
  deletedAt: string;
  /** ms left before it is purged for good */
  expiresInMs: number;
};

export async function listTrash(): Promise<TrashRow[]> {
  await purgeExpired();
  const rows = await db()
    .select()
    .from(contactedArchive)
    .orderBy(sql`${contactedArchive.archivedAt} desc`)
    .limit(200);
  return rows.map((r) => {
    const snap = r.snapshot as { lead?: Partial<LeadRow>; reason?: TrashReason; foundSite?: string | null };
    const lead = snap.lead ?? {};
    const at = new Date(r.archivedAt).getTime();
    return {
      id: r.id,
      name: lead.name ?? r.leadName,
      phone: lead.phone ?? null,
      country: lead.country ?? null,
      category: lead.category ?? null,
      score: lead.score ?? null,
      reason: snap.reason ?? "deleted",
      foundSite: snap.foundSite ?? null,
      deletedAt: new Date(r.archivedAt).toISOString(),
      expiresInMs: Math.max(0, at + TRASH_TTL_MS - Date.now()),
    };
  });
}

/** Put a trashed lead back in the list. The analysis is not recoverable. */
export async function restoreFromTrash(trashId: number): Promise<{ restored: boolean; name?: string }> {
  const d = db();
  const rows = await d.select().from(contactedArchive).where(sql`${contactedArchive.id} = ${trashId}`);
  const row = rows[0];
  if (!row) return { restored: false };
  const snap = row.snapshot as { lead?: Partial<LeadRow> };
  const lead = snap.lead;
  if (!lead?.source || !lead?.sourceId || !lead?.name) return { restored: false };

  // Re-insert without the old id (it may be taken) and without the verify
  // verdict that got it deleted, so it comes back as an unchecked lead.
  await d
    .insert(leads)
    .values({
      source: lead.source,
      sourceId: lead.sourceId,
      name: lead.name,
      category: lead.category ?? null,
      types: lead.types ?? [],
      address: lead.address ?? null,
      area: lead.area ?? null,
      city: lead.city ?? null,
      country: lead.country ?? null,
      lat: lead.lat ?? null,
      lng: lead.lng ?? null,
      phone: lead.phone ?? null,
      phoneIntl: lead.phoneIntl ?? null,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      priceLevel: lead.priceLevel ?? null,
      hours: lead.hours ?? null,
      mapsUri: lead.mapsUri ?? null,
      websiteStatus: (lead.websiteStatus as "none" | "social_only") ?? "none",
      socials: lead.socials ?? [],
      languageHint: lead.languageHint ?? null,
      score: lead.score ?? null,
      status: "analyzed",
      isDemo: lead.isDemo ?? false,
    })
    .onConflictDoNothing({ target: [leads.source, leads.sourceId] });

  await d.delete(contactedArchive).where(sql`${contactedArchive.id} = ${trashId}`);
  return { restored: true, name: lead.name };
}
