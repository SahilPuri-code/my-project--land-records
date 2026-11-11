import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "green",
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "amber" | "red" | "slate" | "violet";
  trend?: { value: string; direction: "up" | "down" };
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm card-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
          {hint && <div className="mt-1 truncate text-[11px] text-slate-500">{hint}</div>}
        </div>
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {trend && (
        <div className={cn("mt-3 flex items-center gap-1 text-[11px] font-medium", trend.direction === "up" ? "text-emerald-700" : "text-red-600")}>
          {trend.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
    </div>
  );
}
