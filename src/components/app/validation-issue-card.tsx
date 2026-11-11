import { ChevronDown, Wrench } from "lucide-react";
import type { ValidationIssue } from "@/lib/types";
import { SeverityBadge } from "./status-badge";

const severityBorder: Record<string, string> = {
  critical: "border-l-red-600",
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
};

export function ValidationIssueCard({ issue, compact = false }: { issue: ValidationIssue; compact?: boolean }) {
  return (
    <details className={`group rounded-lg border border-slate-200 border-l-4 bg-white ${severityBorder[issue.severity] ?? "border-l-slate-400"}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{issue.rule_code}</code>
          </div>
          <div className="mt-2 text-sm font-semibold leading-5 text-slate-900">{issue.title}</div>
          {!compact && <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{issue.description}</div>}
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3.5 pb-3.5 pt-3">
        <p className="text-xs leading-5 text-slate-600">{issue.description}</p>
        <div className="rounded-md bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-600">
          <span className="font-semibold text-slate-700">Evidence used:</span> {issue.evidence}
        </div>
        <div className="grid gap-2 text-[11px] sm:grid-cols-2">
          <div className="rounded-md border border-slate-100 p-2.5">
            <div className="font-semibold uppercase tracking-wider text-slate-400">Affected field</div>
            <div className="mt-0.5 font-mono text-slate-700">{issue.affected_field}</div>
          </div>
          <div className="rounded-md border border-slate-100 p-2.5">
            <div className="flex items-center gap-1 font-semibold uppercase tracking-wider text-slate-400">
              <Wrench className="h-3 w-3" /> Recommended action
            </div>
            <div className="mt-0.5 leading-5 text-slate-700">{issue.recommended_action}</div>
          </div>
        </div>
      </div>
    </details>
  );
}
