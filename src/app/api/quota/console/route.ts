// Google's own Places request count (Cloud Monitoring), for display next to
// Alex.ai's local counter. Optional — see GCP_SERVICE_ACCOUNT_JSON in .env.example.

import { NextResponse } from "next/server";
import { consoleSyncConfigured, placesConsoleUsage } from "@/lib/gcp";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    if (!consoleSyncConfigured()) {
      return NextResponse.json({ configured: false, places: null });
    }
    const usage = await placesConsoleUsage();
    return NextResponse.json({
      configured: true,
      places: usage?.requests ?? null,
      since: usage?.since ?? null,
      fetchedAt: usage?.fetchedAt ?? null,
    });
  } catch (e) {
    return jsonError(e);
  }
}
