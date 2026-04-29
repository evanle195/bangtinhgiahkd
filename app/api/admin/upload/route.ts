export const runtime = "nodejs";

import { parseExcel } from "@/lib/parser";
import { calculateRow } from "@/lib/calculator";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rows = parseExcel(buffer);
    const result = rows.map(calculateRow);

    return Response.json(result);
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
