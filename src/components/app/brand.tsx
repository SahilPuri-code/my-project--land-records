import Link from "next/link";
import { LandPlot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2.5", compact && "gap-2")}>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-900/20">
        <LandPlot className="h-[18px] w-[18px]" />
      </div>
      <div className="leading-tight">
        <div className={cn("text-sm font-bold tracking-wide", light ? "text-white" : "text-slate-900")}>
          BHŪMI <span className="text-emerald-500">3D</span>
        </div>
        {!compact && (
          <div className={cn("text-[9px] uppercase tracking-[0.2em]", light ? "text-slate-400" : "text-slate-500")}>
            Land intelligence
          </div>
        )}
      </div>
    </Link>
  );
}
