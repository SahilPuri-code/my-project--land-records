import {
  BadgeCheck,
  Calculator,
  FileEdit,
  FileSearch,
  FileText,
  Landmark,
  LogIn,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import type { AuditEvent } from "@/lib/types";
import { formatDate } from "@/lib/api-client";

const ICONS: Record<string, typeof FileText> = {
  record_created: FileText,
  document_uploaded: FileText,
  ocr_completed: ScanLine,
  record_edited: FileEdit,
  validation_run: FileSearch,
  trust_score_calculated: Calculator,
  record_approved: BadgeCheck,
  record_rejected: XCircle,
  correction_requested: FileEdit,
  escalated_for_resurvey: RefreshCw,
  verification_receipt_generated: ShieldCheck,
  user_login: LogIn,
  user_logout: LogIn,
  user_updated: UserCog,
  settings_updated: UserCog,
  demo_reset: RefreshCw,
  demo_polygon_created: Landmark,
  system_seeded: Landmark,
  record_deleted: XCircle,
};

const TONES: Record<string, string> = {
  record_approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  verification_receipt_generated: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trust_score_calculated: "bg-blue-50 text-blue-700 border-blue-200",
  validation_run: "bg-blue-50 text-blue-700 border-blue-200",
  record_rejected: "bg-red-50 text-red-700 border-red-200",
  escalated_for_resurvey: "bg-amber-50 text-amber-700 border-amber-200",
};

export function AuditTimeline({
  events,
  showRecord = false,
}: {
  events: (AuditEvent & { user_name?: string | null; user_role?: string | null })[];
  showRecord?: boolean;
}) {
  if (!events.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No audit events yet.</div>;
  }
  return (
    <div className="relative space-y-3 pl-8 timeline-line">
      {events.map((event) => {
        const Icon = ICONS[event.action] ?? FileText;
        return (
          <div key={event.id} className="relative rounded-lg border border-slate-200 bg-white p-3">
            <div className={`absolute -left-8 top-3 grid h-7 w-7 place-items-center rounded-full border ${TONES[event.action] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">{event.action.replaceAll("_", " ")}</span>
                {event.user_name && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{event.user_name}</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">{formatDate(event.created_at)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">{event.description}</p>
            {event.document_hash && (
              <div className="mt-1.5 truncate font-mono text-[10px] text-slate-400">SHA-256 {event.document_hash}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
