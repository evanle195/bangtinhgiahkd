import { NextResponse } from "next/server";
import { loadDashboardPayload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await loadDashboardPayload();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
