import { toCsv } from "@/lib/csv";
import { filterFromParams, queryLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

const COLUMNS = ["title", "phone", "emails", "website", "instagram", "facebook", "linkedin", "category", "address", "rating", "reviews", "status", "notes"];

/** Exports the leads matching the same filters as the table. ?format=csv|json */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const { rows } = await queryLeads(filterFromParams(p), false);
  const stamp = new Date().toISOString().slice(0, 10);
  if (p.get("format") === "json") {
    const data = (rows as Record<string, unknown>[]).map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c]])));
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="leads-${stamp}.json"` },
    });
  }
  return new Response(toCsv(rows as Record<string, unknown>[], COLUMNS), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${stamp}.csv"` },
  });
}
