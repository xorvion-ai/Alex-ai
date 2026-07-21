import { NextRequest, NextResponse } from "next/server";
import { verifyLead } from "@/lib/verify";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Manual verify: do NOT auto-flag/hide a lead when a site is found — the UI
    // asks the operator whether to delete it first.
    const result = await verifyLead(Number(id), { hideWhenFound: false });
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
