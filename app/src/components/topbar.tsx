"use client";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const TITLES: Record<string, string> = {
  "/": "Dashboard", "/scrape": "Quick scrape", "/deep-search": "Deep search", "/jobs": "Jobs", "/email-finder": "Email finder", "/leads": "Leads",
  "/import-export": "Import / Export", "/settings": "Settings",
};

export function Topbar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />
      <h2 className="text-sm font-medium">{TITLES[path] ?? "Maps Leads"}</h2>
      <div className="ml-auto flex items-center gap-2"><ThemeToggle /></div>
    </header>
  );
}
