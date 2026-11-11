import { Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { TrustScoreExplanation } from "@/lib/types";
import { cn } from "@/lib/utils";

export function trustTone(score: number) {
  if (score >= 90) return { text: "text-emerald-700", stroke: "#16a34a", bg: "bg-emerald-500", label: "Auto-verification eligible" };
  if (score >= 60) return { text: "text-amber-700", stroke: "#f59e0b", bg: "bg-amber-500", label: "Officer review required" };
  return { text: "text-red-700", stroke: "#dc2626", bg: "bg-red-500", label: "Escalate / re-survey" };
}

export function TrustRing({ score, size = 116, label }: { score: number; size?: number; label?: string }) {
  const tone = trustTone(score);
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-ring"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tracking-tight", tone.text)} style={{ fontSize: size * 0.27 }}>
            {score}
          </span>
          <span className="text-[9px] font-medium uppercase tracking-widest text-slate-400">/ 100</span>
        </div>
      </div>
      {label !== "" && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Parcel Trust Score</div>
          <div className={cn("mt-1 text-sm font-semibold", tone.text)}>{tone.label}</div>
          <div className="mt-1 max-w-[180px] text-[11px] leading-4 text-slate-500">
            Weighted, explainable and provisional wherever evidence is missing.
          </div>
        </div>
      )}
    </div>
  );
}

export function TrustBreakdown({ explanation }: { explanation: TrustScoreExplanation | null }) {
  if (!explanation) {
    return <div className="text-xs text-slate-500">No trust score has been calculated yet. Run validation to generate one.</div>;
  }
  const tone = trustTone(explanation.final_score);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Why this score?</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold tracking-tight", tone.text)}>{explanation.final_score}</span>
            <span className="text-xs text-slate-500">/ 100 · {tone.label}</span>
          </div>
        </div>
        <div className={cn("rounded-lg border px-3 py-2 text-[11px] font-medium", explanation.provisional ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
          {explanation.provisional ? "Provisional — evidence incomplete" : "Evidence complete for demo scope"}
        </div>
      </div>
      <div className="space-y-3">
        {explanation.components.map((component) => (
          <div key={component.key} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="font-semibold text-slate-800">{component.label}</div>
              <div className="text-slate-500">
                <span className="font-semibold text-slate-800">{component.score}</span>/100 · weight {component.weight}% · {component.weighted} pts
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", component.score >= 80 ? "bg-emerald-500" : component.score >= 60 ? "bg-amber-500" : "bg-red-500")}
                style={{ width: `${component.score}%` }}
              />
            </div>
            {component.deductions.length > 0 ? (
              <details className="mt-2 group">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-500 hover:text-emerald-700">
                  {component.deductions.length} deduction{component.deductions.length === 1 ? "" : "s"} · show reasoning
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {component.deductions.map((d, i) => (
                    <li key={`${d.reason}-${i}`} className="flex gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] leading-4 text-slate-600">
                      <span className="font-mono font-semibold text-red-600">−{d.points}</span>
                      <span>
                        <span className="font-medium text-slate-800">{d.reason}.</span> {d.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <div className="mt-1.5 text-[11px] text-emerald-700">No deductions in the supplied demo evidence.</div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>{explanation.summary}</span>
      </div>
      {explanation.missing_evidence.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Missing evidence keeps this score provisional: {explanation.missing_evidence.join("; ")}.
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
        <ShieldCheck className="h-3 w-3" /> Prototype score · human decision remains mandatory
      </div>
    </div>
  );
}
