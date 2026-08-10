import { NextRequest, NextResponse } from "next/server";
import { verifyLead } from "@/lib/verify";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // A found website deletes the lead right here — no confirmation step.
    const result = await verifyLead(Number(id));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
