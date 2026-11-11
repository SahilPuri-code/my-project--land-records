"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  Gauge,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustBreakdown, TrustRing, trustTone } from "@/components/app/trust-score";
import { ValidationIssueCard } from "@/components/app/validation-issue-card";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { apiGet, apiSend, formatDate } from "@/lib/api-client";
import type {
  DocumentRow,
  ExtractedField,
  LandRecord,
  ParcelGeometryRow,
  TrustScoreExplanation,
  TrustScoreRow,
  ValidationIssue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CheckResult {
  code: string;
  title: string;
  fields: string;
  evidence: string;
  status: "flagged" | "passed";
  issues: ValidationIssue[];
}

interface ValidationResponse {
  record: LandRecord;
  issues: ValidationIssue[];
  checks: CheckResult[];
  trust: TrustScoreRow | null;
  explanation: TrustScoreExplanation | null;
  documents: DocumentRow[];
  fields: ExtractedField[];
  geometries: ParcelGeometryRow[];
  owners: { name: string; share: number }[];
}

export default function ValidationPage() {
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [recordId, setRecordId] = useState("");
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "flagged" | "passed">("all");

  useEffect(() => {
    apiGet<{ records: LandRecord[] }>("/api/records")
      .then((result) => {
        setRecords(result.records);
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("record");
        const target = result.records.find((r) => r.id === fromQuery) ?? result.records[0];
        if (target) setRecordId(target.id);
        else setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<ValidationResponse>(`/api/validation/results/${id}`);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (recordId) void load(recordId);
  }, [recordId, load]);

  async function run() {
    if (!recordId) return;
    setRunning(true);
    try {
      await apiSend(`/api/validation/run/${recordId}`, "POST");
      await load(recordId);
      toast.success("Validation complete", { description: "The nine-rule engine and Parcel Trust Score were recomputed." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const checks = useMemo(() => {
    if (!data) return [];
    return filter === "all" ? data.checks : data.checks.filter((check) => check.status === filter);
  }, [data, filter]);

  const selectedRecord = records.find((record) => record.id === recordId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Rule engine"
        title="Validation center"
        description="Nine deterministic rules compare the written record, the cadastral geometry and the ground evidence. Findings feed the explainable Parcel Trust Score."
        actions={
          <>
            <select
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              className="h-9 max-w-[280px] rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              aria-label="Select land record"
            >
              {records.map((record) => (
                <option key={record.id} value={record.id}>
                  Survey {record.survey_number}/{record.subdivision_number} · {record.village} · {record.trust_score}/100
                </option>
              ))}
            </select>
            <Button onClick={run} disabled={running || !recordId} className="bg-[#14532d] hover:bg-[#166534]">
              {running ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
              {running ? "Running…" : "Run validation"}
            </Button>
          </>
        }
      />

      <DemoNotice />

      {error && <ErrorState message={error} onRetry={() => recordId && load(recordId)} />}
      {loading && !data && <LoadingState title="Loading validation results" />}

      {data && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">Survey {data.record.survey_number}/{data.record.subdivision_number}</span>
                    <StatusBadge status={data.record.status} />
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{data.record.owner_name} · {data.record.village}, {data.record.district}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{data.record.ulpin}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{data.documents.length} documents</Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{data.fields.length} extracted fields</Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{data.geometries.length} geometry epochs</Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{data.issues.length} open findings</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/records/${data.record.id}`}>Record <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/review?record=${data.record.id}`}>Review</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <TrustRing score={data.record.trust_score} size={100} />
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Routing</div>
                  <div className={cn("mt-1 text-sm font-semibold", trustTone(data.record.trust_score).text)}>
                    {trustTone(data.record.trust_score).label}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {data.trust ? `Calculated ${formatDate(data.trust.calculated_at)}` : "Not yet calculated"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Rule status</span>
            {(["all", "flagged", "passed"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize transition",
                  filter === value ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                )}
              >
                {value} ({value === "all" ? data.checks.length : data.checks.filter((c) => c.status === value).length})
              </button>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Nine-rule catalog</CardTitle>
                <p className="text-[11px] text-slate-500">Deterministic, explainable checks over the evidence bundle</p>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {checks.map((check) => (
                  <div key={check.code} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">{check.code}</code>
                          <span className="text-xs font-semibold text-slate-900">{check.title}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">{check.fields} · {check.evidence}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[9px] uppercase",
                          check.status === "flagged"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {check.status === "flagged" ? <CircleAlert className="mr-1 h-3 w-3" /> : <BadgeCheck className="mr-1 h-3 w-3" />}
                        {check.status}
                      </Badge>
                    </div>
                    {check.issues.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {check.issues.map((issue, index) => (
                          <ValidationIssueCard key={issue.id ?? `${check.code}-${index}`} issue={issue} compact />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!checks.length && <div className="py-8 text-center text-xs text-slate-500">No checks match this filter.</div>}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Score decomposition</CardTitle></CardHeader>
                <CardContent className="pt-0"><TrustBreakdown explanation={data.explanation} /></CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Component scores</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {data.explanation ? data.explanation.components.map((component) => (
                    <div key={component.key} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700">{component.label}</span>
                        <span className="font-semibold text-slate-900">{component.score}/100</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", component.score >= 80 ? "bg-emerald-500" : component.score >= 60 ? "bg-amber-500" : "bg-red-500")}
                          style={{ width: `${component.score}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[9px] text-slate-400">Weight {component.weight}% · contributes {component.weighted} points</div>
                    </div>
                  )) : <div className="text-xs text-slate-500">Run validation to calculate component scores.</div>}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="space-y-2 p-3 text-[11px] leading-5 text-slate-600">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Human-in-the-loop guarantee</div>
                  <p>AI and rules only surface findings. An authorized revenue officer must record the final decision. Every run is written to the immutable-style demo audit trail.</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Gauge className="h-3 w-3" /> Thresholds are configurable by an administrator.
                    <Sparkles className="h-3 w-3" /> Weights total 100%.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Findings for this parcel</CardTitle>
              <p className="text-[11px] text-slate-500">Expand a finding to see evidence, affected field and the recommended human action</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {data.issues.length ? data.issues.map((issue, index) => (
                <ValidationIssueCard key={issue.id ?? index} issue={issue} />
              )) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center text-xs text-emerald-900">
                  No findings. This record passes all nine demo rules on the supplied evidence.
                </div>
              )}
            </CardContent>
          </Card>

          {selectedRecord && selectedRecord.updated_at !== data.record.updated_at && (
            <div className="text-[10px] text-slate-400">Note: the record changed since this result was loaded. Run validation again to refresh.</div>
          )}
        </>
      )}
    </div>
  );
}
