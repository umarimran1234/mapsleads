"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ArrowRightIcon, BriefcaseIcon, MailIcon, PhoneIcon, PlusIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { JobStatusBadge, LeadStatusBadge } from "@/components/status-badges";
import { ago, num } from "@/lib/format";
import type { Job } from "@/lib/types";

type Stats = {
  engineUp: boolean;
  totals: { leads: number; withEmail: number; withPhone: number; withWebsite: number; jobs: number; running: number; failed: number };
  timeline: { date: string; leads: number }[];
  statuses: { status: string; c: number }[];
  categories: { category: string; c: number }[];
  recentJobs: Job[];
};

const chartConfig = { leads: { label: "New leads", color: "var(--chart-1)" } } satisfies ChartConfig;

function Stat({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription>{title}</CardDescription>
        <div className="rounded-md bg-accent p-2 text-accent-foreground"><Icon className="size-4" /></div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () => fetch(`/api/stats?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}% of leads` : "No leads yet");

  return (
    <>
      <PageHeader title="Dashboard" description="Your lead pipeline at a glance.">
        <Button nativeButton={false} render={<Link href="/scrape" />}><PlusIcon /> New scrape</Button>
      </PageHeader>

      {s && !s.engineUp && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Scraper engine is offline</AlertTitle>
          <AlertDescription>Start Docker Desktop, then run <code className="rounded bg-muted px-1">docker compose up -d</code> in the kit folder.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <Stat title="Total leads" value={num(s.totals.leads)} hint={`${num(s.totals.withWebsite)} with a website`} icon={UsersIcon} />
            <Stat title="With email" value={num(s.totals.withEmail)} hint={pct(s.totals.withEmail, s.totals.leads)} icon={MailIcon} />
            <Stat title="With phone" value={num(s.totals.withPhone)} hint={pct(s.totals.withPhone, s.totals.leads)} icon={PhoneIcon} />
            <Stat title="Jobs" value={num(s.totals.jobs)} hint={`${s.totals.running} running · ${s.totals.failed} failed`} icon={BriefcaseIcon} />
          </>
        ) : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads collected</CardTitle>
            <CardDescription>New leads per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {s ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <AreaChart data={s.timeline} margin={{ left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-leads)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--color-leads)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32}
                    tickFormatter={(v: string) => new Date(v + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Area dataKey="leads" type="monotone" stroke="var(--color-leads)" strokeWidth={2} fill="url(#fill)" />
                </AreaChart>
              </ChartContainer>
            ) : <Skeleton className="h-64" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>Leads by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {s && ["new", "contacted", "replied", "won", "lost"].map((st) => {
              const c = s.statuses.find((x) => x.status === st)?.c ?? 0;
              return (
                <div key={st} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <LeadStatusBadge status={st} /><span className="tabular-nums text-muted-foreground">{num(c)}</span>
                  </div>
                  <Progress value={s.totals.leads ? (100 * c) / s.totals.leads : 0} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Recent jobs</CardTitle><CardDescription>Your latest scrapes</CardDescription></div>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/jobs" />}>View all <ArrowRightIcon /></Button>
          </CardHeader>
          <CardContent>
            {!s ? <Skeleton className="h-40" /> : s.recentJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No jobs yet. Start your first scrape.</p>
            ) : (
              <ul className="divide-y">
                {s.recentJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{j.name}</div>
                      <div className="text-xs text-muted-foreground">{j.city} · {ago(j.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {j.status === "done" && <span className="text-sm tabular-nums text-muted-foreground">{j.leadCount} leads</span>}
                      <JobStatusBadge status={j.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top categories</CardTitle><CardDescription>Most common business types</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {!s ? <Skeleton className="h-40" /> : s.categories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
            ) : s.categories.map((c) => (
              <div key={c.category} className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="truncate">{c.category}</span><span className="tabular-nums text-muted-foreground">{num(c.c)}</span></div>
                <Progress value={(100 * c.c) / s.categories[0].c} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
