import { NextRequest, NextResponse } from "next/server";
import { resumeSweep } from "@/lib/sweep";
import { jsonError } from "@/lib/api";

// Re-arm a stopped sweep so stepping carries on from its cursor, instead of
// START creating a new sweep and paying again for every query already done.
export async function POST(req: NextRequest) {
  try {
    const { searchId } = await req.json();
    await resumeSweep(Number(searchId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
