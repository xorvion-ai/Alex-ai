import { NextRequest, NextResponse } from "next/server";
import { stepSweep } from "@/lib/sweep";
import { jsonError } from "@/lib/api";

// A step is bounded to ~40s of candidate work plus the source fetch (a slow
// Overpass mirror can take 50s, and up to three are tried). Say so explicitly
// rather than relying on the platform default.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { searchId } = await req.json();
    const result = await stepSweep(Number(searchId));
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
