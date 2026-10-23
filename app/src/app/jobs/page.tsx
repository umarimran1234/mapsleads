"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLinkIcon, PlusIcon, RadarIcon, RefreshCwIcon, SearchIcon, SquareIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge } from "@/components/status-badges";
import { ago, duration } from "@/lib/format";
import type { DeepSearch, Job } from "@/lib/types";
import { useJobs } from "@/lib/use-jobs";

type Item = { kind: "scrape"; job: Job } | { kind: "deep"; search: DeepSearch };

const startedAt = (i: Item) => (i.kind === "scrape" ? i.job.createdAt : i.search.createdAt);

/** Where a running deep search is, in words and as a progress bar value. */
function deepProgress(s: DeepSearch) {
  if (s.phase === "scanning") return { label: `Scanning tiles ${s.tilesDone}/${s.tilesTotal}`, pct: s.tilesTotal ? (100 * s.tilesDone) / s.tilesTotal : 0 };
  if (s.phase === "emails") return { label: `Finding emails ${s.sitesChecked}/${s.sitesTotal}`, pct: s.sitesTotal ? (100 * s.sitesChecked) / s.sitesTotal : 0 };
  return { label: "Mapping the area", pct: 0 };
}

export default function JobsPage() {
  const { jobs, searches, engineUp, loading, reload } = useJobs();
  const [target, setTarget] = useState<Item | null>(null);

  const items = useMemo<Item[]>(
    () => [
      ...jobs.map((job): Item => ({ kind: "scrape", job })),
      ...searches.map((search): Item => ({ kind: "deep", search })),
    ].sort((a, b) => new Date(startedAt(b)).getTime() - new Date(startedAt(a)).getTime()),
    [jobs, searches],
  );

  const targetLeads = target ? (target.kind === "scrape" ? target.job.leadCount : target.search.leads) : 0;

  async function remove(withLeads: boolean) {
    if (!target) return;
    const url = target.kind === "scrape"
      ? `/api/jobs?id=${target.job.id}&leads=${withLeads ? 1 : 0}`
      : `/api/deep-search/${target.search.id}?leads=${withLeads ? 1 : 0}`;
    await fetch(url, { method: "DELETE" });
    toast.success(withLeads ? "Deleted with its leads" : "Deleted, leads kept");
    setTarget(null); reload();
  }

  async function stop(id: string) {
    await fetch(`/api/deep-search/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    toast.success("Stopped. What was found so far is kept.");
    reload();
  }

  return (
    <>
      <PageHeader title="Jobs" description="Every quick scrape and deep search you have run. Running ones update live.">
        <Button variant="outline" onClick={reload}><RefreshCwIcon /> Refresh</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/scrape" />}><PlusIcon /> Quick scrape</Button>
        <Button nativeButton={false} render={<Link href="/deep-search" />}><RadarIcon /> Deep search</Button>
      </PageHeader>

      {engineUp === false && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Scraper engine is offline</AlertTitle>
          <AlertDescription>Running jobs stay as they are until the engine is back. Run <code className="rounded bg-muted px-1">docker compose up -d</code>.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-sm text-muted-foreground">No jobs yet.</div>
              <Button nativeButton={false} render={<Link href="/deep-search" />}><RadarIcon /> Start a deep search</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Job</TableHead><TableHead>Where</TableHead><TableHead>Settings</TableHead>
                  <TableHead>Status</TableHead><TableHead>Duration</TableHead><TableHead>Leads</TableHead>
                  <TableHead>Started</TableHead><TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => it.kind === "scrape" ? (
                  <TableRow key={it.job.id}>
                    <TableCell className="max-w-64 pl-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0"><SearchIcon />Quick</Badge>
                        <span className="truncate font-medium">{it.job.name}</span>
                      </div>
                      {it.job.keywords.length > 1 && <div className="mt-0.5 truncate text-xs text-muted-foreground">{it.job.keywords.join(" · ")}</div>}
                    </TableCell>
                    <TableCell>{it.job.city}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant="secondary">depth {it.job.depth}</Badge>
                      {it.job.email ? <Badge variant="secondary">emails</Badge> : null}
                    </TableCell>
                    <TableCell className="min-w-44">
                      <JobStatusBadge status={it.job.status} />
                      {it.job.status === "running" && <Progress value={null} className="mt-2 h-1" />}
                      {it.job.error && <p className="mt-1 max-w-64 text-xs text-destructive">{it.job.error}</p>}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{duration(it.job.createdAt, it.job.finishedAt)}</TableCell>
                    <TableCell>
                      {it.job.status === "done" ? (
                        <Button nativeButton={false} variant="link" size="sm" className="h-auto p-0" render={<Link href={`/leads?job=${it.job.id}`} />}>
                          <UsersIcon /> {it.job.leadCount} new
                        </Button>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ago(it.job.createdAt)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon" aria-label="Delete job" onClick={() => setTarget(it)}><Trash2Icon /></Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={it.search.id}>
                    <TableCell className="max-w-64 pl-4">
                      <div className="flex items-center gap-2">
                        <Badge className="shrink-0"><RadarIcon />Deep</Badge>
                        <span className="truncate font-medium">{it.search.keywords.join(", ")}</span>
                      </div>
                    </TableCell>
                    <TableCell>{it.search.area}</TableCell>
                    <TableCell className="space-x-1">
                      <Badge variant="secondary">{it.search.gridN}×{it.search.gridN} tiles</Badge>
                      {it.search.findEmails ? <Badge variant="secondary">emails</Badge> : null}
                    </TableCell>
                    <TableCell className="min-w-44">
                      {it.search.status === "cancelled" ? <Badge variant="outline">Stopped</Badge> : <JobStatusBadge status={it.search.status} />}
                      {it.search.status === "running" && (() => {
                        const p = deepProgress(it.search);
                        return <div className="mt-2 space-y-1"><Progress value={p.pct} className="h-1" /><div className="text-xs text-muted-foreground">{p.label}</div></div>;
                      })()}
                      {it.search.tilesFailed > 0 && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{it.search.tilesFailed} tile{it.search.tilesFailed === 1 ? "" : "s"} failed</p>}
                      {it.search.error && <p className="mt-1 max-w-64 text-xs text-destructive">{it.search.error}</p>}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{duration(it.search.createdAt, it.search.finishedAt)}</TableCell>
                    <TableCell>
                      <Button nativeButton={false} variant="link" size="sm" className="h-auto p-0" render={<Link href={`/leads?search=${it.search.id}`} />}>
                        <UsersIcon /> {it.search.leads}
                      </Button>
                      {it.search.uniqueEmails > 0 && <div className="text-xs text-muted-foreground">{it.search.uniqueEmails} emails</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ago(it.search.createdAt)}</TableCell>
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      {it.search.status === "running" && <Button variant="ghost" size="icon" aria-label="Stop search" onClick={() => stop(it.search.id)}><SquareIcon /></Button>}
                      <Button variant="ghost" size="icon" aria-label="Open deep search" nativeButton={false} render={<Link href="/deep-search" />}><ExternalLinkIcon /></Button>
                      <Button variant="ghost" size="icon" aria-label="Delete search" onClick={() => setTarget(it)}><Trash2Icon /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {target?.kind === "deep" ? "deep search" : "job"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {targetLeads > 0
                ? `It found ${targetLeads} leads. You can keep them or delete them together with it.`
                : "It is removed from this list. A running one is stopped."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {targetLeads > 0 && <Button variant="outline" onClick={() => remove(false)}>Delete, keep leads</Button>}
            <Button variant="destructive" onClick={() => remove(true)}>{targetLeads > 0 ? "Delete and leads" : "Delete"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
