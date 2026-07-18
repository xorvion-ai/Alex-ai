import { NextResponse } from "next/server";
import { getQuotaSnapshot } from "@/lib/quota";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json({ quota: await getQuotaSnapshot() });
  } catch (e) {
    return jsonError(e);
  }
}
