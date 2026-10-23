"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, DownloadIcon, ExternalLinkIcon, MailIcon, MailSearchIcon, PhoneIcon,
  SearchIcon, StarIcon, Trash2Icon, UploadIcon, XIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { EnrichDialog } from "@/components/enrich-dialog";
import { LeadStatusBadge } from "@/components/status-badges";
import { num } from "@/lib/format";
import { LEAD_STATUSES, type Lead } from "@/lib/types";

type JobRef = { id: string; name: string; city: string };
const SIZE = 25;
const SOCIALS = [["instagram", "IG"], ["facebook", "FB"], ["linkedin", "in"]] as const;
const post = (method: string, body: unknown) =>
  fetch("/api/leads", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function Leads() {
  const params = useSearchParams();
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [jobs, setJobs] = useState<JobRef[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [job, setJob] = useState(params.get("job") ?? "");
  const [search, setSearch] = useState(params.get("search") ?? ""); // set when arriving from a deep search
  const [status, setStatus] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [enrichIds, setEnrichIds] = useState<number[] | null>(null);

  async function findMissing() {
    const d = await (await fetch(`/api/emails/enrich${job ? `?job=${job}` : ""}`, { cache: "no-store" })).json();
    if (!d.ids.length) return toast.info("Every lead with a website already has an email.");
    setEnrichIds(d.ids);
  }

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ q, job, search, status, sort, dir, ...extra });
    if (hasEmail) p.set("hasEmail", "1");
    if (hasPhone) p.set("hasPhone", "1");
    return p.toString();
  }, [q, job, search, status, sort, dir, hasEmail, hasPhone]);

  const load = useCallback(async () => {
    const d = await (await fetch(`/api/leads?${qs({ page: String(page), size: String(SIZE) })}`, { cache: "no-store" })).json();
    setRows(d.rows); setTotal(d.total); setJobs(d.jobs); setLoading(false);
    setCounts(Object.fromEntries(d.counts.map((c: { status: string; c: number }) => [c.status, c.c])));
  }, [qs, page]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => { setPage(1); setPicked(new Set()); }, [q, job, search, status, hasEmail, hasPhone, sort, dir]);

  const pages = Math.max(1, Math.ceil(total / SIZE));
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const ids = [...picked];
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtered = !!(q || job || search || status || hasEmail || hasPhone);

  function sortBy(col: string) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(col); setDir("asc"); }
  }
  const SortHead = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => sortBy(col)}>
        {children}
        {sort === col ? (dir === "asc" ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />) : <ArrowUpDownIcon className="size-3 opacity-40" />}
      </button>
    </TableHead>
  );

  async function setStatusFor(list: number[], s: string) {
    await post("PATCH", { ids: list, status: s });
    toast.success(`Marked ${list.length} lead${list.length === 1 ? "" : "s"} as ${s}`);
    if (open && list.includes(open.id)) setOpen({ ...open, status: s as Lead["status"] });
    load();
  }
  async function saveNotes() {
    if (!open) return;
    await post("PATCH", { ids: [open.id], notes });
    toast.success("Notes saved"); setOpen(null); load();
  }
  async function removePicked() {
    await post("DELETE", { ids });
    toast.success(`Deleted ${ids.length} lead${ids.length === 1 ? "" : "s"}`);
    setPicked(new Set()); setConfirmDelete(false); load();
  }
  function reset() { setQ(""); setJob(""); setSearch(""); setStatus(""); setHasEmail(false); setHasPhone(false); }

  const jobItems = [{ value: "all", label: "All jobs" }, ...jobs.map((j) => ({ value: j.id, label: `${j.name} · ${j.city}` }))];
  const statusItems = [{ value: "all", label: "All statuses" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))];

  return (
    <>
      <PageHeader title="Leads" description={`${num(allCount)} leads in your database.`}>
        <Button variant="outline" onClick={findMissing}><MailSearchIcon /> Find missing emails &amp; socials</Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/import-export" />}><UploadIcon /> Import</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}><DownloadIcon /> Export{filtered ? " filtered" : ""}</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<a href={`/api/export?${qs({ format: "csv" })}`} />}>CSV (Excel)</DropdownMenuItem>
            <DropdownMenuItem render={<a href={`/api/export?${qs({ format: "json" })}`} />}>JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {[["", "All", allCount] as const, ...LEAD_STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1), counts[s] ?? 0] as const)].map(([key, label, c]) => (
          <button key={key} onClick={() => setStatus(key)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${status === key ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:text-foreground"}`}>
            {label} <span className="tabular-nums opacity-70">{num(c)}</span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search name, email, phone, address…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select items={jobItems} value={job || "all"} onValueChange={(v) => setJob(!v || v === "all" ? "" : v)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{jobItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
          <Label className="gap-2 text-sm"><Checkbox checked={hasEmail} onCheckedChange={(c) => setHasEmail(!!c)} />Has email</Label>
          <Label className="gap-2 text-sm"><Checkbox checked={hasPhone} onCheckedChange={(c) => setHasPhone(!!c)} />Has phone</Label>
          {search && <Badge variant="secondary">From a deep search</Badge>}
          {filtered && <Button variant="ghost" size="sm" onClick={reset}><XIcon /> Clear</Button>}
          <span className="ml-auto text-sm text-muted-foreground">{num(total)} match</span>
        </div>

        {picked.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/50 px-3 py-2">
            <span className="text-sm font-medium">{picked.size} selected</span>
            <Select items={statusItems.slice(1)} value="" onValueChange={(v) => v && setStatusFor(ids, v)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Mark as…" /></SelectTrigger>
              <SelectContent>{statusItems.slice(1).map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEnrichIds(ids)}><MailSearchIcon /> Find emails</Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}><Trash2Icon /> Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Clear selection</Button>
          </div>
        )}

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 pl-4"><Checkbox checked={allOn} onCheckedChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></TableHead>
                <SortHead col="title">Business</SortHead>
                <TableHead>Contact</TableHead>
                <SortHead col="category">Category</SortHead>
                <SortHead col="rating">Rating</SortHead>
                <SortHead col="status">Status</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && [0, 1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>)}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground">
                  {filtered ? "No leads match these filters." : <>No leads yet. <Link href="/scrape" className="text-primary underline">Run a scrape</Link> or <Link href="/import-export" className="text-primary underline">import a file</Link>.</>}
                </TableCell></TableRow>
              )}
              {rows.map((l) => (
                <TableRow key={l.id} className="cursor-pointer" data-state={picked.has(l.id) ? "selected" : undefined}
                  onClick={() => { setOpen(l); setNotes(l.notes); }}>
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={picked.has(l.id)} aria-label={`Select ${l.title}`} onCheckedChange={() => {
                      const n = new Set(picked); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); setPicked(n);
                    }} />
                  </TableCell>
                  <TableCell className="max-w-72">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{l.address}</div>
                  </TableCell>
                  <TableCell className="max-w-56 text-sm">
                    {l.emails && <div className="flex items-center gap-1.5 truncate"><MailIcon className="size-3.5 shrink-0 text-muted-foreground" />{l.emails}</div>}
                    {l.phone && <div className="flex items-center gap-1.5 text-muted-foreground"><PhoneIcon className="size-3.5 shrink-0" />{l.phone}</div>}
                    {!l.emails && !l.phone && <span className="text-muted-foreground">—</span>}
                    <div className="mt-1 flex gap-1">
                      {SOCIALS.map(([key, label]) => l[key] && (
                        <a key={key} href={l[key]} target="_blank" rel="noreferrer" title={l[key]} onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className="px-1.5 text-[10px] hover:bg-accent">{label}</Badge>
                        </a>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{l.category}</TableCell>
                  <TableCell>
                    {l.rating != null ? <span className="inline-flex items-center gap-1"><StarIcon className="size-3.5 fill-amber-400 text-amber-400" />{l.rating}<span className="text-xs text-muted-foreground">({num(l.reviews ?? 0)})</span></span> : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select items={statusItems.slice(1)} value={l.status} onValueChange={(v) => v && setStatusFor([l.id], v)}>
                      <SelectTrigger className="h-7 w-32 border-0 bg-transparent px-1 shadow-none hover:bg-muted">
                        <LeadStatusBadge status={l.status} />
                      </SelectTrigger>
                      <SelectContent>{statusItems.slice(1).map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        <div className="flex items-center justify-between border-t p-3">
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{open.category || "Business"}{open.address ? ` · ${open.address}` : ""}</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-4">
                <dl className="space-y-3 text-sm">
                  <Field label="Email">{open.emails ? open.emails.split(/,\s*/).map((e) => <a key={e} className="block text-primary hover:underline" href={`mailto:${e}`}>{e}</a>) : null}</Field>
                  <Field label="Phone">{open.phone ? <a className="text-primary hover:underline" href={`tel:${open.phone}`}>{open.phone}</a> : null}</Field>
                  <Field label="Website">{open.website ? <a className="inline-flex max-w-full items-center gap-1 break-all text-primary hover:underline" target="_blank" rel="noreferrer" href={/^https?:/.test(open.website) ? open.website : `http://${open.website}`}>{open.website.replace(/^https?:\/\/(www\.)?/, "")}<ExternalLinkIcon className="size-3" /></a> : null}</Field>
                  {SOCIALS.map(([key]) => (
                    <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
                      {open[key] ? <a className="inline-flex max-w-full items-center gap-1 break-all text-primary hover:underline" target="_blank" rel="noreferrer" href={open[key]}>{open[key].replace(/^https?:\/\/(www\.)?/, "")}<ExternalLinkIcon className="size-3" /></a> : null}
                    </Field>
                  ))}
                  <Field label="Rating">{open.rating != null ? `${open.rating} (${num(open.reviews ?? 0)} reviews)` : null}</Field>
                </dl>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select items={statusItems.slice(1)} value={open.status} onValueChange={(v) => v && setStatusFor([open.id], v)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{statusItems.slice(1).map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call back Tuesday, asked for a quote…" />
                </div>
              </div>
              <SheetFooter className="flex-row justify-end">
                <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
                <Button onClick={saveNotes}>Save notes</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EnrichDialog key={enrichIds?.length ?? 0} ids={enrichIds ?? []} open={enrichIds !== null}
        onClose={() => setEnrichIds(null)} onDone={load} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {picked.size} lead{picked.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Export first if you want a backup.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={removePicked}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense><Leads /></Suspense>;
}
