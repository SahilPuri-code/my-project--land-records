import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/api-client";

const styles: Record<string, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  eligible_auto_verification: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_officer_review: "border-amber-200 bg-amber-50 text-amber-700",
  escalate_resurvey: "border-red-200 bg-red-50 text-red-700",
  correction_requested: "border-blue-200 bg-blue-50 text-blue-700",
  rejected: "border-slate-300 bg-slate-100 text-slate-700",
  digitized: "border-blue-200 bg-blue-50 text-blue-700",
  demo_unverified: "border-slate-200 bg-slate-50 text-slate-600",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", styles[status] ?? "border-slate-200 bg-slate-50 text-slate-600", className)}>
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          status === "verified" || status === "eligible_auto_verification"
            ? "bg-emerald-500"
            : status === "needs_officer_review"
              ? "bg-amber-500"
              : status === "escalate_resurvey" || status === "rejected"
                ? "bg-red-500"
                : "bg-blue-500"
        )}
      />
      {statusLabel(status)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "border-red-300 bg-red-100 text-red-800",
    high: "border-red-200 bg-red-50 text-red-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <Badge variant="outline" className={cn("uppercase tracking-wide text-[10px]", map[severity] ?? map.low)}>
      {severity}
    </Badge>
  );
}
