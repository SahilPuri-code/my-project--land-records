"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  FileWarning,
  Fingerprint,
  Gavel,
  RefreshCw,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustRing, trustTone } from "@/components/app/trust-score";
import { ValidationIssueCard } from "@/components/app/validation-issue-card";
import { DemoNotice, EmptyState, ErrorState, LoadingState } from "@/components/app/empty-state";
import { apiGet, apiSend, formatDate } from "@/lib/api-client";
import type {
  DocumentRow,
  LandRecord,
  ReceiptRow,
  TrustScoreExplanation,
  ValidationIssue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type QueueRow = LandRecord & { flag_count: number; critical_count: number; document_count: number };

interface Bundle {
  record: LandRecord;
  documents: DocumentRow[];
  issues: ValidationIssue[];
  explanation: TrustScoreExplanation | null;
  receipt: ReceiptRow | null;
  reviews: { id: string; decision: string; comments: string; reviewed_at: string; officer_name: string }[];
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ receipt_no: string; snapshot_hash: string } | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ records: QueueRow[] }>("/api/reviews/pending");
      setQueue(result.records);
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("record");
      setSelectedId((current) => {
        if (current) return current;
        return result.records.find((r) => r.id === fromQuery)?.id ?? result.records[0]?.id ?? null;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const loadBundle = useCallback(async (id: string) => {
    setBundleLoading(true);
    try {
      const data = await apiGet<Bundle>(`/api/records/${id}`);
      setBundle(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBundleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadBundle(selectedId);
  }, [selectedId, loadBundle]);

  async function decide(action: "approve" | "reject" | "request-correction" | "escalate") {
    if (!selectedId) return;
    if ((action === "reject" || action === "request-correction") && !comments.trim()) {
      toast.error("A written comment is required for this decision.");
      return;
    }
    setBusy(action);
    try {
      const result = await apiSend<{ decision: string; status: string; receipt: { receipt_no: string; snapshot_hash: string } | null }>(
        `/api/reviews/${selectedId}/${action}`,
        "POST",
        { comments }
      );
      if (result.receipt) setLastReceipt(result.receipt);
      toast.success("Decision recorded", {
        description: result.receipt
          ? `Prototype receipt ${result.receipt.receipt_no} issued with a SHA-256 snapshot seal.`
          : "The decision and comment were written to the audit trail.",
      });
      setComments("");
      await loadQueue();
      await loadBundle(selectedId);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const record = bundle?.record ?? queue.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Human decision"
        title="Officer review workspace"
        description="Inspect the evidence, the findings and the score explanation. Then record a written, auditable decision. The prototype never certifies on its own."
        actions={
          <Button variant="outline" onClick={() => { void loadQueue(); if (selectedId) void loadBundle(selectedId); }}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh queue
          </Button>
        }
      />

      <DemoNotice>
        Decisions here apply only to synthetic demo records and create prototype receipts, not government certificates.
      </DemoNotice>

      {error && <ErrorState message={error} onRetry={loadQueue} />}
      {loading && <LoadingState title="Loading review queue" description="Checking officer permissions and assembling pending records." />}

      {!loading && !error && (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending decisions</CardTitle>
              <p className="text-[11px] text-slate-500">{queue.length} record(s) awaiting a human</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {queue.length ? queue.map((row) => (
                <button
                  key={row.id}
                  onClick={() => { setSelectedId(row.id); setLastReceipt(null); }}
                  className={cn(
                    "w-full rounded-lg border p-2.5 text-left transition",
                    row.id === selectedId ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">Survey {row.survey_number}/{row.subdivision_number}</span>
                    <span className={cn("text-sm font-bold", trustTone(row.trust_score).text)}>{row.trust_score}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">{row.owner_name} · {row.village}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={row.status} className="text-[9px]" />
                    <Badge variant="outline" className="border-slate-200 text-[9px] text-slate-500">{row.flag_count} findings</Badge>
                    {row.critical_count > 0 && (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-[9px] text-red-700">{row.critical_count} critical</Badge>
                    )}
                  </div>
                </button>
              )) : (
                <EmptyState
                  title="Queue is clear"
                  description="Every seeded record currently has a decision. Reset the demo dataset from Administration to restore the sample review cases."
                  className="min-h-[180px]"
                  action={<Button asChild variant="outline" size="sm"><Link href="/records">Browse records</Link></Button>}
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {!record && !loading && (
              <EmptyState title="Select a record" description="Choose a pending record from the queue to inspect its evidence and record a decision." />
            )}

            {record && (
              <>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">Survey {record.survey_number}/{record.subdivision_number}</span>
                        <StatusBadge status={record.status} />
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{record.owner_name} · {record.village}, {record.district} · {record.land_use}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{record.ulpin}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        <span>{record.recorded_area.toLocaleString("en-IN")} m² recorded</span>
                        <span>·</span>
                        <span>{record.mapped_area.toLocaleString("en-IN")} m² mapped</span>
                        <span>·</span>
                        <span>{bundle?.documents.length ?? 0} documents</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <TrustRing score={record.trust_score} size={84} label="" />
                      <div className="text-right text-[10px] text-slate-500">
                        <div className="font-semibold uppercase tracking-widest text-slate-400">Recommendation</div>
                        <div className={cn("mt-0.5 text-xs font-semibold", trustTone(record.trust_score).text)}>
                          {record.trust_score >= 90 ? "Eligible for verification" : record.trust_score >= 60 ? "Review carefully" : "Escalate and re-survey"}
                        </div>
                        <Link href={`/records/${record.id}`} className="mt-1 inline-flex items-center gap-0.5 text-emerald-700 hover:underline">
                          Full bundle <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Evidence review</CardTitle>
                      <p className="text-[11px] text-slate-500">Documents carry a SHA-256 hash on upload</p>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {bundleLoading && <div className="text-xs text-slate-500">Loading bundle…</div>}
                      {bundle?.documents.length ? bundle.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-medium text-slate-800">{doc.file_name}</div>
                            <div className="truncate font-mono text-[9px] text-slate-400">{doc.sha256_hash.slice(0, 32)}…</div>
                          </div>
                          <Button asChild variant="outline" size="sm" className="h-7 shrink-0 text-[10px]">
                            <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        </div>
                      )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500">No documents attached.</div>}
                      <div className="rounded-lg bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500">
                        <FileWarning className="mb-1 h-3 w-3 text-amber-500" />
                        Missing evidence lowers the Change & audit component and keeps the score provisional.
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Findings ({bundle?.issues.length ?? 0})</CardTitle>
                      <p className="text-[11px] text-slate-500">Deterministic rules, not an AI verdict</p>
                    </CardHeader>
                    <CardContent className="max-h-[360px] space-y-2 overflow-y-auto pt-0 thin-scroll">
                      {bundle?.issues.length ? bundle.issues.map((issue, index) => (
                        <ValidationIssueCard key={issue.id ?? index} issue={issue} compact />
                      )) : <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-[11px] text-emerald-900">No findings on this record.</div>}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Record a decision</CardTitle>
                    <p className="text-[11px] text-slate-500">Rejection and correction requests require a written comment</p>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-1.5">
                      <Label htmlFor="comments" className="text-xs">Officer comment</Label>
                      <Textarea
                        id="comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="e.g. Area difference of 6% is attributable to the 2026 boundary shift; ground evidence confirms the extension. Approve with a correction note."
                        rows={3}
                        className="text-xs"
                      />
                      <div className="text-[10px] text-slate-400">This comment is stored verbatim in the audit trail with your name and role.</div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Button
                        onClick={() => decide("approve")}
                        disabled={Boolean(busy) || record.status === "verified"}
                        className="bg-[#14532d] hover:bg-[#166534]"
                      >
                        {busy === "approve" ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-1.5 h-4 w-4" />}
                        Approve & certify
                      </Button>
                      <Button variant="outline" onClick={() => decide("request-correction")} disabled={Boolean(busy)} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                        {busy === "request-correction" ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
                        Request correction
                      </Button>
                      <Button variant="outline" onClick={() => decide("escalate")} disabled={Boolean(busy)} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                        {busy === "escalate" ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Gavel className="mr-1.5 h-4 w-4" />}
                        Escalate re-survey
                      </Button>
                      <Button variant="outline" onClick={() => decide("reject")} disabled={Boolean(busy)} className="border-red-200 text-red-700 hover:bg-red-50">
                        {busy === "reject" ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                        Reject record
                      </Button>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] leading-4 text-amber-900">
                      Approving issues a prototype verification receipt and freezes a SHA-256 snapshot of the current bundle. It does not create legal title.
                    </div>
                  </CardContent>
                </Card>

                {(lastReceipt || bundle?.receipt) && (
                  <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm text-emerald-900">
                        <ShieldCheck className="h-4 w-4" /> Prototype verification receipt
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="text-sm font-bold text-emerald-900">{(lastReceipt ?? bundle?.receipt)?.receipt_no}</div>
                      <div className="break-all rounded-lg border border-emerald-200 bg-white p-2 font-mono text-[10px] text-slate-500">
                        <Fingerprint className="mr-1 inline h-3 w-3 align-[-2px] text-emerald-700" />
                        SHA-256 {(lastReceipt ?? bundle?.receipt)?.snapshot_hash}
                      </div>
                      {bundle?.receipt && <div className="text-[10px] text-emerald-800">Issued {formatDate(bundle.receipt.issued_at)}</div>}
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm" className="border-emerald-200 text-emerald-800">
                          <Link href={`/passport/${record.id}`}>Open property passport</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="border-emerald-200 text-emerald-800">
                          <a href={`/api/reports/record/${record.id}/pdf?type=receipt`} target="_blank" rel="noreferrer">Download receipt PDF</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {bundle?.reviews.length ? (
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Decision history</CardTitle></CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {bundle.reviews.map((review) => (
                        <div key={review.id} className="rounded-lg border border-slate-200 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold capitalize text-slate-800">{review.decision.replaceAll("_", " ")}</span>
                            <span className="text-[9px] text-slate-400">{formatDate(review.reviewed_at)}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{review.officer_name}</div>
                          <p className="mt-1 text-[10px] leading-4 text-slate-600">{review.comments}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
