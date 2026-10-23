import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function JobStatusBadge({ status }: { status: string }) {
  if (status === "running")
    return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"><Loader2Icon className="animate-spin" />Running</Badge>;
  if (status === "done")
    return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2Icon />Done</Badge>;
  return <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"><XCircleIcon />Failed</Badge>;
}

const LEAD_COLORS: Record<string, string> = {
  new: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  replied: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  won: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  lost: "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

export function LeadStatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge variant="outline" className={cn("capitalize", LEAD_COLORS[status], className)}>{status}</Badge>;
}
