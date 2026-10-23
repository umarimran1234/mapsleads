import { and, asc, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { leads } from "@/db/schema";
import { db } from "./db";

type NewLead = typeof leads.$inferInsert;

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(r).find((h) => h.toLowerCase() === k);
    if (hit && r[hit]) return r[hit].trim();
  }
  return "";
};
const num = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };

// The engine scrapes emails out of page HTML, so it also returns image names ("logo@2x.png") and
// template placeholders. Same junk rules as extract_emails() in scripts/scrape.py.
const JUNK_EXT = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;
const JUNK_DOMAIN = /example|sentry|wixpress|wix\.com|godaddy|squarespace|wordpress|domain\.com|email\.com|yourdomain|schema\.org|w3\.org/i;
const JUNK_LOCAL = new Set(["name", "email", "user", "you", "someone", "example", "test", "demo", "sample", "yourname", "username", "firstname", "lastname"]);

export function cleanEmails(raw: string) {
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const e = part.trim().toLowerCase();
    const at = e.lastIndexOf("@");
    if (at < 1 || JUNK_EXT.test(e) || JUNK_DOMAIN.test(e.slice(at + 1)) || JUNK_LOCAL.has(e.slice(0, at))) continue;
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) seen.add(e);
  }
  return [...seen].join(", ");
}

/** Same business = same name + address, so repeated scrapes and re-imports never duplicate. */
const keyOf = (title: string, address: string, website: string, phone: string) =>
  `${title}|${address || website || phone}`.toLowerCase().replace(/\s+/g, " ").trim();

/** Map an engine CSV row or an exported/imported row (either header style) to a lead, or null if it has no name. */
export function toLead(r: Record<string, string>, jobId: string | null): NewLead | null {
  const title = pick(r, "title", "name");
  if (!title) return null;
  const phone = pick(r, "phone"), website = pick(r, "website"), address = pick(r, "address");
  const reviews = num(pick(r, "review_count", "reviews"));
  return {
    dedupeKey: keyOf(title, address, website, phone),
    jobId, title, phone, website, address,
    emails: cleanEmails(pick(r, "emails", "email")),
    instagram: pick(r, "instagram"), facebook: pick(r, "facebook"), linkedin: pick(r, "linkedin"),
    category: pick(r, "category"),
    rating: num(pick(r, "review_rating", "rating")),
    reviews: reviews == null ? null : Math.round(reviews),
  };
}

/**
 * Insert leads, skipping ones already stored. Returns { added, skipped }.
 * With `searchId`, leads already stored are also attached to that deep search, so its result set is
 * complete even when an earlier run found some of the same businesses; `matched` counts every lead
 * in the batch, new or existing.
 */
export async function saveLeads(rows: Record<string, string>[], jobId: string | null, searchId?: string) {
  const mapped = rows.map((r) => toLead(r, jobId)).filter((l): l is NewLead => l !== null)
    .map((l) => (searchId ? { ...l, searchId } : l));
  // A file can repeat a business; Postgres rejects duplicates inside one INSERT ... ON CONFLICT, so dedupe first.
  const unique = [...new Map(mapped.map((l) => [l.dedupeKey, l])).values()];
  const d = await db();
  let added = 0;
  for (let i = 0; i < unique.length; i += 500) {
    const ins = d.insert(leads).values(unique.slice(i, i + 500));
    if (searchId) {
      // (xmax = 0) is true only for freshly inserted rows, so it separates new leads from updated ones.
      const res = await ins.onConflictDoUpdate({ target: leads.dedupeKey, set: { searchId: sql`excluded.search_id` } })
        .returning({ fresh: sql<boolean>`(xmax = 0)` });
      added += res.filter((r) => r.fresh).length;
    } else {
      added += (await ins.onConflictDoNothing().returning({ id: leads.id })).length;
    }
  }
  return { added, skipped: rows.length - added, matched: unique.length };
}

export const STATUSES = ["new", "contacted", "replied", "won", "lost"] as const;

export type LeadFilter = {
  q?: string; job?: string; search?: string; status?: string; hasEmail?: boolean; hasPhone?: boolean;
  sort?: string; dir?: string; page?: number; size?: number;
};

const SORTS = {
  title: leads.title, category: leads.category, rating: leads.rating,
  reviews: leads.reviews, status: leads.status, created_at: leads.createdAt,
} as const;

function whereOf(f: LeadFilter): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    c.push(or(ilike(leads.title, like), ilike(leads.emails, like), ilike(leads.phone, like),
      ilike(leads.address, like), ilike(leads.category, like), ilike(leads.website, like)));
  }
  if (f.job) c.push(eq(leads.jobId, f.job));
  if (f.search) c.push(eq(leads.searchId, f.search));
  if (f.status) c.push(eq(leads.status, f.status as (typeof STATUSES)[number]));
  if (f.hasEmail) c.push(ne(leads.emails, ""));
  if (f.hasPhone) c.push(ne(leads.phone, ""));
  return and(...c);
}

export async function queryLeads(f: LeadFilter, paged = true) {
  const d = await db();
  const where = whereOf(f);
  const col = SORTS[(f.sort ?? "created_at") as keyof typeof SORTS] ?? leads.createdAt;
  const order = f.dir === "asc" ? asc(col) : desc(col);
  const size = Math.min(Math.max(f.size ?? 50, 1), 500);
  const page = Math.max(f.page ?? 1, 1);
  const [{ total }] = await d.select({ total: sql<number>`count(*)::int` }).from(leads).where(where);
  const q = d.select().from(leads).where(where).orderBy(order, desc(leads.id));
  const rows = paged ? await q.limit(size).offset((page - 1) * size) : await q;
  return { rows, total, page, size };
}

export function filterFromParams(p: URLSearchParams): LeadFilter {
  return {
    q: p.get("q") || undefined, job: p.get("job") || undefined, search: p.get("search") || undefined, status: p.get("status") || undefined,
    hasEmail: p.get("hasEmail") === "1", hasPhone: p.get("hasPhone") === "1",
    sort: p.get("sort") || undefined, dir: p.get("dir") || undefined,
    page: Number(p.get("page")) || 1, size: Number(p.get("size")) || 50,
  };
}
