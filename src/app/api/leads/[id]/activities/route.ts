import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { activities, db, leads } from "@/lib/db";
import { jsonError } from "@/lib/api";

const KINDS = ["NOTE", "CALL", "WHATSAPP", "VISIT"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    const exists = await db()
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, leadId));
    if (!exists.length) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const body = await req.json();
    const kind = KINDS.includes(body.kind) ? body.kind : "NOTE";
    const note = String(body.note ?? "").trim();
    if (!note) return NextResponse.json({ error: "empty note" }, { status: 400 });
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    const rows = await db()
      .insert(activities)
      .values({ leadId, kind, note, dueAt })
      .returning();
    return NextResponse.json({ activity: rows[0] });
  } catch (e) {
    return jsonError(e);
  }
}
