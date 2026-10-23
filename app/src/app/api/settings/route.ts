import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { jobs, leads } from "@/db/schema";
import { DATABASE_URL, db } from "@/lib/db";
import { engineBase, engineUp } from "@/lib/engine";

export const dynamic = "force-dynamic";

/** The connection string with the password hidden, safe to show in the UI. */
function maskedUrl() {
  try {
    const u = new URL(DATABASE_URL);
    if (u.password) u.password = "****";
    return u.toString();
  } catch { return "postgres://..."; }
}

export async function GET() {
  const d = await db();
  const { rows } = await d.execute<{ bytes: string }>(sql`select pg_database_size(current_database()) as bytes`);
  return NextResponse.json({
    engineUrl: engineBase(), engineUp: await engineUp(), dbUrl: maskedUrl(), dbBytes: Number(rows[0]?.bytes ?? 0),
  });
}

/** ?what=leads clears every lead, ?what=jobs clears job history (leads stay). */
export async function DELETE(req: Request) {
  const what = new URL(req.url).searchParams.get("what");
  const d = await db();
  if (what === "leads") await d.delete(leads);
  else if (what === "jobs") await d.delete(jobs); // leads.job_id is ON DELETE SET NULL
  else return NextResponse.json({ error: "what must be leads or jobs" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
