import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseTable } from "@/lib/pricing";
import { saveDashboardPayload } from "@/lib/storage";

export const dynamic = "force-dynamic";

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const token = String(form.get("token") ?? request.headers.get("x-admin-token") ?? "");

    if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
      return unauthorized("Admin token không đúng.");
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Chưa có file upload." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return NextResponse.json({ ok: false, message: "Không đọc được sheet đầu tiên trong file." }, { status: 400 });
    }

    const table = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
    const headers = (table[0] ?? []).map((item) => String(item ?? ""));
    const rows = table.slice(1);

    if (!headers.length || !rows.length) {
      return NextResponse.json({ ok: false, message: "File chưa có dữ liệu bảng giá." }, { status: 400 });
    }

    const payload = parseTable(headers, rows, file.name);
    await saveDashboardPayload(payload);

    return NextResponse.json({
      ok: true,
      rowCount: payload.rows.length,
      sourceFileName: file.name,
      summary: payload.summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload thất bại.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
