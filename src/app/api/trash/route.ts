// The DELETED LIST: leads deleted in the last hour (by the DELETE button, or
// automatically when a web check found the business already has a website).
// Reading it also purges anything past the hour, permanently.

import { NextResponse } from "next/server";
import { listTrash, TRASH_TTL_MS } from "@/lib/trash";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    const rows = await listTrash();
    return NextResponse.json({ deleted: rows, ttlMs: TRASH_TTL_MS });
  } catch (e) {
    return jsonError(e);
  }
}
