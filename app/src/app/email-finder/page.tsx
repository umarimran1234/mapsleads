"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopyIcon, DownloadIcon, FileUpIcon, MailSearchIcon, SaveIcon, SquareIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { generic, runBatches } from "@/lib/batch";
import { num } from "@/lib/format";

type Socials = { instagram: string; facebook: string; linkedin: string };
type Site = { url: string; emails: { email: string; source: string }[]; socials: Socials; pagesChecked: number; error?: string };
const SOCIALS = [["instagram", "IG"], ["facebook", "FB"], ["linkedin", "in"]] as const;
const hasSocial = (r: Site) => !!(r.socials.instagram || r.socials.facebook || r.socials.linkedin);

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** One site per line. A CSV/TXT file may hold the site in the first column or a column named website/url/domain. */
function parseSites(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const head = lines[0]?.split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, "")) ?? [];
  const col = head.findIndex((h) => ["website", "url", "domain", "site"].includes(h));
  const body = col >= 0 ? lines.slice(1) : lines;
  const raw = body.map((l) => (l.split(",")[col >= 0 ? col : 0] ?? "").trim().replace(/^"|"$/g, ""));
  return [...new Set(raw.filter((s) => s && !s.startsWith("#")))];
}

export default function EmailFinderPage() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const sites = parseSites(text);
  const withEmail = results.filter((r) => r.emails.length);
  const allEmails = [...new Set(results.flatMap((r) => r.emails.map((e) => e.email)))];
  const pct = total ? Math.round((100 * results.length) / total) : 0;

  async function loadFile(f?: File) {
    if (!f) return;
    const found = parseSites(await f.text());
    setText((t) => [...new Set([...parseSites(t), ...found])].join("\n"));
    toast.success(`Loaded ${found.length} sites`);
  }

  async function start() {
    setResults([]); setTotal(sites.length); setRunning(true);
    abort.current = new AbortController();
    await runBatches<string, Site>(
      sites, 8,
      async (batch) => {
        const r = await fetch("/api/emails/find", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: batch }) });
        if (!r.ok) throw new Error("batch failed");
        return (await r.json()).results;
      },
      (_n, batch) => setResults((prev) => [...prev, ...batch]),
      abort.current.signal,
    );
    setRunning(false);
  }

  function download() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [["website", "emails", "instagram", "facebook", "linkedin", "source_page", "status"], ...results.map((r) => [
      r.url, r.emails.map((e) => e.email).join(", "), r.socials.instagram, r.socials.facebook, r.socials.linkedin,
      r.emails[0]?.source ?? "", r.error ?? (r.emails.length ? "found" : "none")])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `emails-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  }

  async function saveToLeads() {
    const rows = results.filter((r) => r.emails.length || hasSocial(r)).map((r) => ({
      title: hostOf(r.url), website: r.url, emails: r.emails.map((e) => e.email).join(", "), ...r.socials,
    }));
    const fd = new FormData();
    fd.append("file", new File([JSON.stringify(rows)], "email-finder.json", { type: "application/json" }));
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error);
    toast.success(`Saved ${d.added} new leads (${d.skipped} already existed)`);
  }

  return (
    <>
      <PageHeader title="Email finder" description="Paste websites and get the contact emails they publish. No Google Maps needed." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Websites</CardTitle><CardDescription>One per line: domains (example.com) or full URLs.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"example.com\nhttps://acmedental.com\nwww.bestplumbers.net"} disabled={running} />
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="sites-file" className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm hover:bg-muted">
                <FileUpIcon className="size-4" /> Load .txt / .csv
              </Label>
              <input id="sites-file" type="file" accept=".txt,.csv" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} />
              <span className="text-sm text-muted-foreground">{num(sites.length)} site{sites.length === 1 ? "" : "s"}</span>
              <span className="flex-1" />
              {running
                ? <Button variant="outline" onClick={() => abort.current?.abort()}><SquareIcon /> Stop</Button>
                : <Button onClick={start} disabled={!sites.length}><MailSearchIcon /> Find emails</Button>}
            </div>
            {(running || results.length > 0) && (
              <div className="space-y-2 pt-1">
                <Progress value={pct} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{results.length} / {total} sites checked</span>
                  <span className="text-foreground">{withEmail.length} with email · {allEmails.length} unique addresses</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>For each site we read the homepage, and if there is no email there, its contact and about pages.</p>
            <p>Only addresses the site publishes are returned. Many sites use contact forms instead, so expect roughly half to have one.</p>
            <Alert><AlertDescription>Emails are personal data. Follow GDPR, CCPA and CAN-SPAM, and keep an opt-out list.</AlertDescription></Alert>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div><CardTitle>Results</CardTitle><CardDescription>{withEmail.length} of {results.length} sites have a public email.</CardDescription></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!allEmails.length} onClick={() => { navigator.clipboard.writeText(allEmails.join("\n")); toast.success(`Copied ${allEmails.length} emails`); }}><ClipboardCopyIcon /> Copy emails</Button>
              <Button variant="outline" size="sm" onClick={download}><DownloadIcon /> Download CSV</Button>
              <Button size="sm" disabled={!results.some((r) => r.emails.length || hasSocial(r)) || running} onClick={saveToLeads}><SaveIcon /> Save to leads</Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-4">Website</TableHead><TableHead>Emails</TableHead><TableHead>Found on</TableHead><TableHead className="pr-4">Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-56 truncate pl-4 font-medium">{hostOf(r.url)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.emails.map((e) => (
                          <button key={e.email} title="Click to copy" onClick={() => { navigator.clipboard.writeText(e.email); toast.success("Copied"); }}>
                            <Badge variant={generic(e.email) ? "secondary" : "outline"} className="cursor-pointer">{e.email}</Badge>
                          </button>
                        ))}
                        {!r.emails.length && <span className="text-muted-foreground">—</span>}
                      </div>
                      {hasSocial(r) && (
                        <div className="mt-1 flex gap-1">
                          {SOCIALS.map(([key, label]) => r.socials[key] && (
                            <a key={key} href={r.socials[key]} target="_blank" rel="noreferrer" title={r.socials[key]}>
                              <Badge variant="secondary" className="px-1.5 text-[10px] hover:bg-accent">{label}</Badge>
                            </a>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs text-muted-foreground">{r.emails[0] ? new URL(r.emails[0].source).pathname : ""}</TableCell>
                    <TableCell className="pr-4 text-sm">
                      {r.emails.length ? <span className="text-emerald-600 dark:text-emerald-400">Found</span>
                        : r.error ? <span className="text-destructive" title={r.error}>{r.error}</span>
                        : <span className="text-muted-foreground">None published</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
