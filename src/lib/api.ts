import { NextResponse } from "next/server";
import { QuotaExceededError } from "@/lib/quota";

export function jsonError(e: unknown): NextResponse {
  if (e instanceof QuotaExceededError) {
    return NextResponse.json(
      { error: e.message, quotaBlocked: true, provider: e.provider },
      { status: 429 },
    );
  }
  const msg = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: msg }, { status: 500 });
}
