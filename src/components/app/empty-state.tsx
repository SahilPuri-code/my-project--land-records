import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LoadingState({
  title = "Loading",
  description = "Fetching records from the prototype database…",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center", className)}>
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 max-w-md text-xs text-slate-500">{description}</div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-8 text-center", className)}>
      <AlertTriangle className="h-7 w-7 text-red-600" />
      <div className="mt-3 text-sm font-semibold text-slate-900">Something went wrong</div>
      <div className="mt-1 max-w-md text-xs text-slate-600">{message}</div>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center", className)}>
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-400 shadow-sm">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function DemoNotice({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900", className)}>
      <span className="font-semibold">Demo data notice:</span>{" "}
      {children ?? "All records, names, identifiers, geometries, scores and histories are illustrative. This prototype is not a government system and does not provide legal certification."}
    </div>
  );
}
