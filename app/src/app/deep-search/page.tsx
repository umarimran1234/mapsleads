"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2Icon, ClipboardCopyIcon, DownloadIcon, Loader2Icon, MailIcon, RadarIcon, SquareIcon,
  Trash2Icon, TriangleAlertIcon, UsersIcon, XCircleIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { ago, duration, num } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string; keywords: string[]; area: string; gridN: number; findEmails: boolean;
  status: "running" | "done" | "failed" | "cancelled"; phase: "geocoding" | "scanning" | "emails" | "done";
  tilesTotal: number; tilesDone: number; tilesFailed: number; found: number; sitesTotal: number; sitesChecked: number;
  error: string | null; createdAt: string; finishedAt: string | null;
  leads: number; withWebsite: number; withEmail: number; uniqueEmails: number;
};

const LEVELS = [
  { n: 3, name: "Standard", tiles: 9, time: "about 15 min", hint: "A town or district" },
  { n: 5, name: "Deep", tiles: 25, time: "about 40 min", hint: "A city" },
  { n: 7, name: "Maximum", tiles: 49, time: "about 1.5 hours", hint: "A big city, such as London" },
];
const PRESETS = ["hair salons", "barber shops", "dentists", "plumbers", "restaurants", "gyms", "beauty salons", "accountants"];

const STEPS = [
  { key: "geocoding", label: "Map the area" },
  { key: "scanning", label: "Scan tiles" },
  { key: "emails", label: "Find emails" },
  { key: "done", label: "Done" },
] as const;

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{num(value)}</div>
    </div>
  );
}

function SearchCard({ s, onStop, onDelete }: { s: Row; onStop: () => void; onDelete: () => void }) {
  const phaseIdx = STEPS.findIndex((x) => x.key === s.phase);
  const tilePct = s.tilesTotal ? (100 * s.tilesDone) / s.tilesTotal : 0;
  const sitePct = s.sitesTotal ? (100 * s.sitesChecked) / s.sitesTotal : s.phase === "done" ? 100 : 0;

  async function copyEmails() {
    const d = await (await fetch(`/api/deep-search/${s.id}`)).json();
    await navigator.clipboard.writeText(d.emails.join("\n"));
    toast.success(`Copied ${d.emails.length} emails`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {s.keywords.join(", ")} <span className="font-normal text-muted-foreground">in {s.area}</span>
          </CardTitle>
          <CardDescription>
            {s.gridN}×{s.gridN} coverage · started {ago(s.createdAt)}
            {s.status !== "running" && s.finishedAt ? ` · took ${duration(s.createdAt, s.finishedAt)}` : ""}
          </CardDescription>
        </div>
        <div>
          {s.status === "running" && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Loader2Icon className="animate-spin" />Running</Badge>}
          {s.status === "done" && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2Icon />Done</Badge>}
          {s.status === "failed" && <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"><XCircleIcon />Failed</Badge>}
          {s.status === "cancelled" && <Badge variant="outline">Stopped</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {s.error && <Alert variant="destructive"><TriangleAlertIcon /><AlertDescription>{s.error}</AlertDescription></Alert>}

        <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {STEPS.filter((x) => x.key !== "emails" || s.findEmails).map((x) => {
            const i = STEPS.findIndex((y) => y.key === x.key);
            const state = s.status === "done" || i < phaseIdx ? "done" : i === phaseIdx && s.status === "running" ? "active" : "todo";
            return (
              <li key={x.key} className={cn("flex items-center gap-1.5", state === "todo" && "text-muted-foreground", state === "active" && "font-medium")}>
                {state === "done" ? <CheckCircle2Icon className="size-4 text-emerald-500" /> : state === "active" ? <Loader2Icon className="size-4 animate-spin text-primary" /> : <span className="size-4 rounded-full border" />}
                {x.label}
              </li>
            );
          })}
        </ol>

        {s.tilesTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Map tiles scanned</span>
              <span className="tabular-nums">{s.tilesDone} / {s.tilesTotal}{s.tilesFailed ? ` · ${s.tilesFailed} failed` : ""}</span>
            </div>
            <Progress value={tilePct} />
          </div>
        )}
        {s.findEmails && s.sitesTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Websites searched for emails</span>
              <span className="tabular-nums">{s.sitesChecked} / {s.sitesTotal}</span>
            </div>
            <Progress value={sitePct} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Businesses" value={s.leads} icon={UsersIcon} />
          <Stat label="With website" value={s.withWebsite} icon={RadarIcon} />
          <Stat label="With email" value={s.withEmail} icon={MailIcon} />
          <Stat label="Unique emails" value={s.uniqueEmails} icon={MailIcon} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" nativeButton={false} render={<Link href={`/leads?search=${s.id}`} />}><UsersIcon /> View leads</Button>
          <Button size="sm" variant="outline" disabled={!s.uniqueEmails} onClick={copyEmails}><ClipboardCopyIcon /> Copy emails</Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<a href={`/api/export?search=${s.id}&format=csv`} />}><DownloadIcon /> Download CSV</Button>
          <span className="flex-1" />
          {s.status === "running" && <Button size="sm" variant="outline" onClick={onStop}><SquareIcon /> Stop</Button>}
          <Button size="sm" variant="ghost" aria-label="Delete search" onClick={onDelete}><Trash2Icon /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeepSearchPage() {
  const [keywords, setKeywords] = useState("");
  const [area, setArea] = useState("");
  const [gridN, setGridN] = useState(5);
  const [findEmails, setFindEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [engineUp, setEngineUp] = useState<boolean | null>(null);
  const [target, setTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await (await fetch("/api/deep-search", { cache: "no-store" })).json();
      setRows(d.searches); setEngineUp(d.engineUp);
    } catch { setEngineUp(false); }
  }, []);

  const anyRunning = rows?.some((r) => r.status === "running");
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [anyRunning, load]);

  const list = [...new Set(keywords.split(/\n|,/).map((k) => k.trim()).filter(Boolean))];
  const level = LEVELS.find((l) => l.n === gridN)!;
  const add = (k: string) => setKeywords((v) => (list.includes(k) ? v : [v.trim(), k].filter(Boolean).join("\n")));

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/deep-search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: list, area, gridN, findEmails }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return toast.error(d.error);
    toast.success("Deep search started. You can leave this page; it keeps running.");
    setKeywords(""); load();
  }

  async function stop(s: Row) {
    await fetch(`/api/deep-search/${s.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    toast.success("Stopped. What was found so far is kept."); load();
  }

  async function remove(withLeads: boolean) {
    if (!target) return;
    await fetch(`/api/deep-search/${target.id}?leads=${withLeads ? 1 : 0}`, { method: "DELETE" });
    toast.success(withLeads ? "Search and its leads deleted" : "Search deleted, leads kept");
    setTarget(null); load();
  }

  return (
    <>
      <PageHeader title="Deep search" description="Pick a business type and an area. We scan the whole area tile by tile, then search every website for emails." />

      {engineUp === false && (
        <Alert variant="destructive" className="mb-6">
          <TriangleAlertIcon />
          <AlertTitle>Scraper engine is offline</AlertTitle>
          <AlertDescription>Start Docker Desktop, then run <code className="rounded bg-muted px-1">docker compose up -d</code>.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={start} className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>What and where</CardTitle><CardDescription>Example: hair salons in London, UK.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="kw">Business types</Label>
              <Textarea id="kw" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={"hair salons\nbarber shops"} />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Quick add:</span>
                {PRESETS.map((p) => (
                  <button type="button" key={p} onClick={() => add(p)}><Badge variant="secondary" className="cursor-pointer hover:bg-accent">{p}</Badge></button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="London, UK" />
              <p className="text-xs text-muted-foreground">A city, district or region. Add the country for common names, like &quot;Birmingham, UK&quot;.</p>
            </div>
            <div className="space-y-2">
              <Label>Coverage</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <button type="button" key={l.n} onClick={() => setGridN(l.n)}
                    className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted/50", gridN === l.n && "border-primary bg-primary/5 ring-1 ring-primary")}>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.tiles} map tiles · {l.time}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{l.hint}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Google shows about 120 results per search. More tiles means more of the area is covered, so more businesses are found.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="fe">Deep email search</Label>
                  <p className="mt-1 text-xs text-muted-foreground">After scanning, open every business website (homepage, contact and about pages) and collect the emails, plus their Instagram, Facebook and LinkedIn links.</p>
                </div>
                <Switch id="fe" checked={findEmails} onCheckedChange={setFindEmails} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">Summary</div>
                <p className="mt-1 text-muted-foreground">
                  {list.length || 0} type{list.length === 1 ? "" : "s"}{area.trim() ? <> in <b className="text-foreground">{area.trim()}</b></> : ""}, {level.tiles} tiles, {level.time}{findEmails ? ", plus email search" : ""}.
                </p>
              </div>
              {gridN > 3 && (
                <Alert>
                  <TriangleAlertIcon />
                  <AlertDescription>Large areas run many searches in a row. Google can temporarily rate-limit your IP. If tiles start failing, wait a while or use proxies.</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy || !list.length || !area.trim() || engineUp === false}>
                <RadarIcon /> {busy ? "Starting…" : "Start deep search"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Your searches</h2>
      <div className="space-y-4">
        {rows === null && <Skeleton className="h-56 rounded-xl" />}
        {rows?.length === 0 && <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No deep searches yet.</p>}
        {rows?.map((s) => <SearchCard key={s.id} s={s} onStop={() => stop(s)} onDelete={() => setTarget(s)} />)}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this search?</AlertDialogTitle>
            <AlertDialogDescription>
              {target && target.leads > 0 ? `It found ${target.leads} businesses. Keep them in your leads, or delete them with the search.` : "The search is removed. A running search is stopped."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {target && target.leads > 0 && <Button variant="outline" onClick={() => remove(false)}>Delete search, keep leads</Button>}
            <Button variant="destructive" onClick={() => remove(true)}>{target && target.leads > 0 ? "Delete search and leads" : "Delete"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
