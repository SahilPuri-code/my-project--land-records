"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  FolderSearch,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  X,
  Landmark,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "./brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role, User } from "@/lib/types";
import { apiSend } from "@/lib/api-client";

const NAV = [
  {
    label: "Land intelligence",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: null },
      { href: "/records", label: "Land records", icon: FolderSearch, roles: null },
      { href: "/documents/upload", label: "Document intake", icon: UploadCloud, roles: null },
      { href: "/map", label: "Cadastral map", icon: Map, roles: null },
      { href: "/validation", label: "Validation center", icon: ShieldCheck, roles: null },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/review", label: "Officer review", icon: ClipboardCheck, roles: ["officer", "admin"] as Role[] },
      { href: "/reports", label: "Reports & exports", icon: FileBarChart, roles: null },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/admin", label: "Administration", icon: Settings, roles: ["admin"] as Role[] }],
  },
];

function pageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/documents/upload")) return "Document intake";
  if (pathname.startsWith("/records/")) return "Record details";
  if (pathname === "/records") return "Land records";
  if (pathname === "/map") return "Cadastral map";
  if (pathname === "/validation") return "Validation center";
  if (pathname === "/review") return "Officer review";
  if (pathname.startsWith("/passport/")) return "Digital Property Passport";
  if (pathname.startsWith("/viewer/")) return "3D property viewer";
  if (pathname.startsWith("/history/")) return "4D property history";
  if (pathname === "/reports") return "Reports & exports";
  if (pathname === "/admin") return "Administration";
  return "BHŪMI 3D";
}

const roleLabels: Record<Role, string> = {
  citizen: "Citizen",
  surveyor: "Surveyor",
  officer: "Revenue Officer",
  admin: "Administrator",
};

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiSend("/api/auth/logout", "POST");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
      setLoggingOut(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0f172a] text-slate-200">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Brand light />
        <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
          <Landmark className="h-3.5 w-3.5" /> Department of Land Resources
        </div>
        <div className="mt-1 text-[10px] text-slate-500">Demonstration workspace · SIH 2026</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 thin-scroll">
        {NAV.map((group) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(user.role));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-5">
              <div className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</div>
              <div className="space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
                        active
                          ? "bg-emerald-500/15 font-medium text-emerald-300"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", active ? "text-emerald-400" : "text-slate-500")} />
                      {item.label}
                      {item.href === "/review" && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-white">{user.full_name}</div>
              <div className="text-[10px] text-emerald-300/80">{roleLabels[user.role]}</div>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          disabled={loggingOut}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> {loggingOut ? "Signing out…" : "Sign out"}
        </button>
        <div className="px-3 pt-2 text-[9px] leading-4 text-slate-600">
          Illustrative demo data only. Not a government service.
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[256px] lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[280px] max-w-[85vw]">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-[256px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{pageTitle(pathname)}</div>
              <div className="hidden text-[10px] text-slate-400 sm:block">BHŪMI 3D · Digitize · Validate · Trust</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/records"
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 transition hover:border-emerald-200 hover:bg-white sm:flex"
            >
              <Search className="h-3.5 w-3.5" /> Search survey, ULPIN, owner
            </Link>
            <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 sm:inline-flex">
              Demo dataset
            </Badge>
            <button className="relative rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 text-left hover:bg-slate-50"
              >
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#14532d] text-[10px] font-bold text-white">
                  {user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                </div>
                <div className="hidden sm:block">
                  <div className="max-w-[120px] truncate text-[11px] font-medium text-slate-800">{user.full_name}</div>
                  <div className="text-[9px] text-slate-500">{roleLabels[user.role]}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    <div className="px-2 py-1.5">
                      <div className="text-xs font-semibold text-slate-900">{user.full_name}</div>
                      <div className="text-[10px] text-slate-500">{user.email}</div>
                      <div className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        {roleLabels[user.role]}
                      </div>
                    </div>
                    <div className="my-1 border-t border-slate-100" />
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      Dashboard
                    </Link>
                    <Link href="/reports" onClick={() => setMenuOpen(false)} className="block rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      Reports & exports
                    </Link>
                    <Link href="/" onClick={() => setMenuOpen(false)} className="block rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      Public landing page
                    </Link>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={logout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" /> {loggingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 pb-6 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>BHŪMI 3D · Biocreate Innovators · Smart India Hackathon 2026</span>
          <span>Illustrative demo data · AI-assisted findings require authorized human review</span>
        </footer>
      </div>
    </div>
  );
}
