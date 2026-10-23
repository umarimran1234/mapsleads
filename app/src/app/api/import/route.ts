import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { saveLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

/** Multipart upload with a `file` field: a .csv (kit/engine/exported headers) or a .json array of leads. */
export async function POST(req: Request) {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a .csv or .json file." }, { status: 400 });
  const text = await file.text();
  let rows: Record<string, string>[];
  try {
    if (file.name.toLowerCase().endsWith(".json")) {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error("JSON must be an array of leads.");
      rows = data.map((r) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])));
    } else rows = parseCsv(text);
  } catch (e) {
    return NextResponse.json({ error: `Could not read file: ${(e as Error).message}` }, { status: 400 });
  }
  if (!rows.length) return NextResponse.json({ error: "No rows found in the file." }, { status: 400 });
  const { added, skipped } = await saveLeads(rows, null);
  return NextResponse.json({ added, skipped, total: rows.length });
}
