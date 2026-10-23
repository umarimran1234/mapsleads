"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRightIcon, BriefcaseIcon, LayoutDashboardIcon, MailSearchIcon, MapPinIcon, RadarIcon, SearchIcon, SettingsIcon, UsersIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar";
import { useJobs } from "@/lib/use-jobs";

const NAV = [
  { label: "Overview", items: [{ href: "/", title: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    label: "Scraping",
    items: [
      { href: "/deep-search", title: "Deep search", icon: RadarIcon },
      { href: "/scrape", title: "Quick scrape", icon: SearchIcon },
      { href: "/jobs", title: "Jobs", icon: BriefcaseIcon },
      { href: "/email-finder", title: "Email finder", icon: MailSearchIcon },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/leads", title: "Leads", icon: UsersIcon },
      { href: "/import-export", title: "Import / Export", icon: ArrowLeftRightIcon },
    ],
  },
  { label: "System", items: [{ href: "/settings", title: "Settings", icon: SettingsIcon }] },
];

export function AppSidebar() {
  const path = usePathname();
  const { running, engineUp } = useJobs();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <MapPinIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">Maps Leads</span>
                <span className="truncate text-xs text-sidebar-foreground/60">Lead generation</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton
                      tooltip={it.title}
                      isActive={it.href === "/" ? path === "/" : path.startsWith(it.href)}
                      render={<Link href={it.href} />}
                    >
                      <it.icon />
                      <span>{it.title}</span>
                    </SidebarMenuButton>
                    {it.href === "/jobs" && running > 0 && <SidebarMenuBadge>{running}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:justify-center">
          <span className={`size-2 shrink-0 rounded-full ${engineUp ? "bg-emerald-400" : engineUp === false ? "bg-red-400" : "bg-zinc-500"}`} />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Engine {engineUp ? "online" : engineUp === false ? "offline" : "checking…"}
          </span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
