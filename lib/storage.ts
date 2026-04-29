import { get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import type { DashboardPayload } from "@/lib/pricing";
import sampleData from "@/data/sample-products.json";

const BLOB_PATH = "dashboard/latest-products.json";
const LOCAL_PATH = path.join(process.cwd(), "data", "latest-products.json");

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function loadDashboardPayload(): Promise<DashboardPayload> {
  if (hasBlobToken()) {
    try {
      const result = await get(BLOB_PATH, { access: "private" });
      if (result?.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as DashboardPayload;
      }
    } catch {
      return sampleData as DashboardPayload;
    }
  }

  try {
    const text = await fs.readFile(LOCAL_PATH, "utf8");
    return JSON.parse(text) as DashboardPayload;
  } catch {
    return sampleData as DashboardPayload;
  }
}

export async function saveDashboardPayload(payload: DashboardPayload) {
  const body = JSON.stringify(payload, null, 2);

  if (hasBlobToken()) {
    await put(BLOB_PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }

  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, body, "utf8");
}
