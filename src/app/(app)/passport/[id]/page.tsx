"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CalendarClock,
  Download,
  FileText,
  Fingerprint,
  Landmark,
  Map,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustRing, trustTone } from "@/components/app/trust-score";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { useApi } from "@/hooks/use-api";
import { categoryLabel, formatDate, formatDateShort } from "@/lib/api-client";
import type {
  DocumentRow,
  LandRecord,
  PropertyHistoryRow,
  PropertyStructureRow,
  ReceiptRow,
  TrustScoreExplanation,
  TrustScoreRow,
  ValidationIssue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PassportResponse {
  record: LandRecord;
  owners: { name: string; share: number }[];
  documents: DocumentRow[];
  fields: { field_name: string; confidence: number; requires_review: number }[];
  geometries: { id: string }[];
  issues: ValidationIssue[];
  trust: TrustScoreRow | null;
  explanation: TrustScoreExplanation | null;
  history: PropertyHistoryRow[];
  structure: PropertyStructureRow[];
  reviews: { id: string; decision: string; comments: string; reviewed_at: string; officer_name: string }[];
  receipt: ReceiptRow | null;
  integrity_hash: string;
  demo_notice: string;
}

function Seal({ hash }: { hash: string }) {
  const cells = useMemo(() => {
    const bits = hash.split("").map((char) => parseInt(char, 16) % 2);
    return Array.from({ length: 49 }, (_, index) => bits[index % bits.length] === 1);
  }, [hash]);
  return (
    <div className="grid grid-cols-7 gap-[3px] rounded-lg border border-emerald-200 bg-white p-2">
      {cells.map((filled, index) => (
        <div key={index} className={cn("h-2.5 w-2.5 rounded-[1px]", filled ? "bg-[#14532d]" : "bg-slate-100")} />
      ))}
    </div>
  );
}

export default function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<PassportResponse>(`/api/passport/${id}`);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState title="Generating property passport" description="Assembling identity, evidence, score explanation, receipt and integrity seal." />;

  const { record, owners, documents, issues, explanation, receipt, history, structure, integrity_hash } = data;
  const tone = trustTone(record.trust_score);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Link href={`/records/${id}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
          <ArrowLeft className="h-3 w-3" /> Back to record
        </Link>
        <span>/</span>
        <span className="text-slate-700">Digital Property Passport</span>
      </div>

      <PageHeader
        eyebrow="Portable evidence bundle"
        title="Digital Property Passport"
        description="A consolidated, provisional view of identity, ownership, geometry, evidence, validation history and the Parcel Trust Score for this illustrative parcel."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/reports/record/${id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> PDF
              </a>
            </Button>
            <Button asChild className="bg-[#14532d] hover:bg-[#166534]">
              <Link href={`/viewer/${id}`}><Boxes className="mr-1.5 h-4 w-4" /> 3D viewer</Link>
            </Button>
          </>
        }
      />

      <DemoNotice>{data.demo_notice}</DemoNotice>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="brand-gradient relative px-5 py-5 text-white sm:px-7">
          <div className="hero-grid absolute inset-0 opacity-50" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <Landmark className="h-3.5 w-3.5" /> BHŪMI 3D · Digital Property Passport
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                Survey {record.survey_number}/{record.subdivision_number}
              </h2>
              <div className="mt-1 font-mono text-[11px] text-emerald-200/90">{record.ulpin}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span>{record.village}, {record.taluka}, {record.district}</span>
                <span>·</span>
                <span>{record.land_use}</span>
                <span>·</span>
                <span>{record.record_year}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3">
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest text-emerald-200/80">Parcel Trust Score</div>
                <div className="text-3xl font-bold">{record.trust_score}<span className="text-sm font-medium text-slate-400">/100</span></div>
                <div className="mt-0.5 text-[10px] text-slate-300">{tone.label}</div>
              </div>
              <Seal hash={integrity_hash} />
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Property identity</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  ["ULPIN", record.ulpin, true],
                  ["Survey / subdivision", `${record.survey_number}/${record.subdivision_number}`],
                  ["Village", record.village],
                  ["Taluka / district", `${record.taluka} / ${record.district}`],
                  ["Recorded area", `${record.recorded_area.toLocaleString("en-IN")} m²`],
                  ["Mapped area", `${record.mapped_area.toLocaleString("en-IN")} m²`],
                  ["Land use", record.land_use],
                  ["Workflow status", null],
                ].map(([label, value, mono]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                    <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
                    {value ? (
                      <div className={cn("mt-0.5 text-xs font-semibold text-slate-800", mono && "break-all font-mono text-[10px]")}>{value}</div>
                    ) : (
                      <div className="mt-1"><StatusBadge status={record.status} /></div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <Users className="h-3 w-3" /> Recorded ownership
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {owners.map((owner) => (
                  <div key={owner.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5">
                    <span className="text-xs text-slate-700">{owner.name}</span>
                    <span className="text-xs font-bold text-slate-900">{(owner.share * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">Illustrative shares only. Title is not certified by this prototype.</p>
            </section>

            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <FileText className="h-3 w-3" /> Evidence register ({documents.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {documents.length ? documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-slate-800">{doc.file_name}</div>
                      <div className="text-[9px] text-slate-500">
                        {categoryLabel(doc.document_category)} · {formatDateShort(doc.uploaded_at)} · {doc.ocr_status}
                      </div>
                      <div className="truncate font-mono text-[9px] text-slate-400">{doc.sha256_hash}</div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 text-[10px] text-emerald-700">
                      <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">Open</a>
                    </Button>
                  </div>
                )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500">No documents attached.</div>}
              </div>
            </section>

            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <CalendarClock className="h-3 w-3" /> 4D change record
              </h3>
              <div className="mt-2 space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-900">{entry.year}</span>
                      <Badge variant="outline" className="border-slate-200 text-[9px] text-slate-500">{entry.review_status}</Badge>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-600">{entry.description}</p>
                  </div>
                ))}
                {!history.length && <div className="text-[11px] text-slate-500">No historical epochs available.</div>}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link href={`/history/${id}`}>Explore the 4D timeline <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </section>
          </div>

          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex flex-col items-center p-4 text-center">
                <TrustRing score={record.trust_score} size={124} label="" />
                <div className={cn("mt-2 text-sm font-semibold", tone.text)}>{tone.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {explanation ? `${explanation.components.length} weighted components · ${issues.length} findings` : "Run validation to calculate the score"}
                </div>
                {explanation && (
                  <div className="mt-3 w-full space-y-1.5">
                    {explanation.components.map((component) => (
                      <div key={component.key} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[10px]">
                        <span className="text-slate-600">{component.label}</span>
                        <span className="font-semibold text-slate-800">{component.score}<span className="text-[9px] font-normal text-slate-400"> · {component.weight}%</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Structural record</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {structure.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[10px]">
                    <span className="text-slate-600">{item.name}</span>
                    <span className="text-slate-400">{item.area ? `${item.area} m²` : item.structure_type}</span>
                  </div>
                ))}
                {!structure.length && <div className="text-[11px] text-slate-500">No structure data.</div>}
                <Button asChild variant="outline" size="sm" className="mt-1 w-full text-[10px]">
                  <Link href={`/viewer/${id}`}><Map className="mr-1 h-3 w-3" /> Open 3D structure</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className={cn("shadow-sm", receipt ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" /> Verification receipt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {receipt ? (
                  <>
                    <div className="text-xs font-bold text-emerald-900">{receipt.receipt_no}</div>
                    <div className="text-[10px] text-emerald-800">Issued {formatDate(receipt.issued_at)}</div>
                    <div className="break-all rounded-lg border border-emerald-200 bg-white p-2 font-mono text-[9px] text-slate-500">{receipt.snapshot_hash}</div>
                    <Button asChild variant="outline" size="sm" className="w-full border-emerald-200 text-emerald-800">
                      <a href={`/api/reports/record/${id}/pdf?type=receipt`} target="_blank" rel="noreferrer">Download receipt</a>
                    </Button>
                  </>
                ) : (
                  <div className="text-[11px] leading-5 text-slate-600">
                    No receipt yet. The passport remains provisional until an authorized officer records a decision.
                    <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                      <Link href={`/review?record=${id}`}><BadgeCheck className="mr-1 h-3 w-3" /> Go to review</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                <Fingerprint className="h-3 w-3" /> Passport integrity hash
              </div>
              <div className="mt-1 break-all font-mono text-[9px] text-slate-500">{integrity_hash}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-[10px] leading-4 text-slate-500 sm:px-7">
          This Digital Property Passport is generated from illustrative hackathon data. It is not an official land record, not a title certificate, and carries no legal effect. Scores are decision support for authorized human review.
        </div>
      </div>
    </div>
  );
}
