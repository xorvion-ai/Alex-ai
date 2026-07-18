import { NextRequest, NextResponse } from "next/server";
import { stopSweep } from "@/lib/sweep";
import { jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { searchId } = await req.json();
    await stopSweep(Number(searchId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
