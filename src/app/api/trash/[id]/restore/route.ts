// Put a deleted lead back in the working list, while it is still inside the
// one-hour window. The analysis is not recovered — the lead comes back as
// unchecked, so it can be analyzed again.

import { NextRequest, NextResponse } from "next/server";
import { restoreFromTrash } from "@/lib/trash";
import { jsonError } from "@/lib/api";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const r = await restoreFromTrash(Number(id));
    if (!r.restored) {
      return NextResponse.json({ error: "gone — the hour has passed" }, { status: 404 });
    }
    return NextResponse.json(r);
  } catch (e) {
    return jsonError(e);
  }
}
