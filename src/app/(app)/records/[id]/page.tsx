"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CalendarClock,
  Download,
  FileText,
  History,
  LandPlot,
  Map,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustBreakdown, TrustRing } from "@/components/app/trust-score";
import { ValidationIssueCard } from "@/components/app/validation-issue-card";
import { AuditTimeline } from "@/components/app/audit-timeline";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { ParcelMap, type ParcelFeature } from "@/components/map/parcel-map";
import { useApi } from "@/hooks/use-api";
import { apiSend, categoryLabel, formatDate, formatDateShort } from "@/lib/api-client";
import type {
  AuditEvent,
  DocumentRow,
  ExtractedField,
  LandRecord,
  ParcelGeometryRow,
  PropertyHistoryRow,
  PropertyStructureRow,
  ReceiptRow,
  ReviewRow,
  TrustScoreExplanation,
  TrustScoreRow,
  ValidationIssue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Bundle {
  record: LandRecord;
  owners: { name: string; share: number }[];
  documents: DocumentRow[];
  fields: ExtractedField[];
  geometries: ParcelGeometryRow[];
  issues: ValidationIssue[];
  trust: TrustScoreRow | null;
  explanation: TrustScoreExplanation | null;
  history: PropertyHistoryRow[];
  structure: PropertyStructureRow[];
  audit: (AuditEvent & { user_name: string | null; user_role: string | null })[];
  reviews: (ReviewRow & { officer_name: string })[];
  receipt: ReceiptRow | null;
}

const FIELD_LABELS: Record<string, string> = {
  owner_name: "Owner name",
  survey_number: "Survey number",
  subdivision_number: "Subdivision",
  village: "Village",
  taluka: "Taluka",
  district: "District",
  recorded_area: "Recorded area",
  land_use: "Land use",
  owner_share: "Owner share",
  record_year: "Record year",
  ulpin: "ULPIN",
};

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const bundleApi = useApi<Bundle>(`/api/records/${id}`);
  const parcels = useApi<{ features: ParcelFeature[] }>("/api/parcels");
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("evidence");

  const bundle = bundleApi.data;

  const feature = useMemo(
    () => parcels.data?.features.find((f) => f.properties.land_record_id === id) ?? null,
    [parcels.data, id]
  );

  async function runValidation() {
    setRunning(true);
    try {
      await apiSend(`/api/validation/run/${id}`, "POST");
      toast.success("Validation recalculated", { description: "Findings, Trust Score and audit trail were refreshed." });
      bundleApi.reload();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (bundleApi.error) return <ErrorState message={bundleApi.error} onRetry={bundleApi.reload} />;
  if (bundleApi.loading || !bundle) return <LoadingState title="Loading record bundle" description="Fetching documents, extracted fields, geometry, validation findings and audit history." />;

  const { record, owners, documents, fields, issues, explanation, history, structure, audit, reviews, receipt } = bundle;
  const areaDelta = record.recorded_area ? ((record.mapped_area - record.recorded_area) / record.recorded_area) * 100 : 0;
  const structureCounts = structure.reduce<Record<string, number>>((acc, item) => {
    acc[item.structure_type] = (acc[item.structure_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Link href="/records" className="inline-flex items-center gap-1 hover:text-emerald-700">
          <ArrowLeft className="h-3 w-3" /> Land records
        </Link>
        <span>/</span>
        <span className="text-slate-700">Survey {record.survey_number}/{record.subdivision_number}</span>
      </div>

      <PageHeader
        eyebrow={`${record.village} · ${record.district} · ${record.record_year}`}
        title={`Survey ${record.survey_number}/${record.subdivision_number}`}
        description={`${record.owner_name} · ${record.land_use} · ${record.recorded_area.toLocaleString("en-IN")} m² recorded, ${record.mapped_area.toLocaleString("en-IN")} m² mapped (${areaDelta >= 0 ? "+" : ""}${areaDelta.toFixed(1)}%).`}
        actions={
          <>
            <Button variant="outline" onClick={runValidation} disabled={running}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", running && "animate-spin")} /> {running ? "Revalidating…" : "Run validation"}
            </Button>
            <Button asChild variant="outline">
              <a href={`/api/reports/record/${id}/pdf`} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" /> PDF
              </a>
            </Button>
            <Button asChild className="bg-[#14532d] hover:bg-[#166534]">
              <Link href={`/passport/${id}`}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Property passport
              </Link>
            </Button>
          </>
        }
      />

      <DemoNotice />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={record.status} />
        <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-slate-600">{record.ulpin}</Badge>
        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">{issues.length} findings</Badge>
        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">{documents.length} documents</Badge>
        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">Updated {formatDate(record.updated_at)}</Badge>
        {receipt && (
          <Badge className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700" variant="outline">
            <BadgeCheck className="mr-1 h-3 w-3" /> Receipt {receipt.receipt_no}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Parcel geometry</CardTitle>
              <p className="text-[11px] text-slate-500">Current illustrative cadastral boundary</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
              <Link href={`/viewer/${id}`}>3D viewer <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {parcels.data && feature ? (
              <ParcelMap features={parcels.data.features} selectedId={feature.properties.id} height={340} />
            ) : parcels.loading ? (
              <div className="h-[340px] animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <div className="flex h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center">
                <Map className="h-6 w-6 text-slate-400" />
                <div className="mt-2 text-xs font-semibold text-slate-700">No mapped geometry yet</div>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">Draw a parcel boundary from the cadastral map module to attach geometry.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/map">Open cadastral map</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <TrustRing score={record.trust_score} size={104} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="uppercase tracking-wider text-slate-400">Recorded</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">{record.recorded_area.toLocaleString("en-IN")} m²</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="uppercase tracking-wider text-slate-400">Mapped</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">{record.mapped_area.toLocaleString("en-IN")} m²</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="uppercase tracking-wider text-slate-400">Owner share</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">{(record.owner_share * 100).toFixed(0)}%</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="uppercase tracking-wider text-slate-400">Survey epoch</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">Current</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Ownership</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              {owners.length ? owners.map((owner) => (
                <div key={owner.name} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-700"><Users className="h-3.5 w-3.5 text-slate-400" /> {owner.name}</span>
                  <span className="font-semibold text-slate-900">{(owner.share * 100).toFixed(0)}%</span>
                </div>
              )) : <div className="text-xs text-slate-500">No owner share breakdown recorded.</div>}
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] leading-4 text-slate-500">
                Shares are illustrative. Real title verification requires the Record of Rights and human legal review.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Documents", value: documents.length, icon: FileText, href: `/documents/upload?record=${id}` },
          { label: "Extracted fields", value: fields.length, icon: ScanLine, href: `/documents/upload?record=${id}` },
          { label: "4D epochs", value: history.length, icon: CalendarClock, href: `/history/${id}` },
          { label: "Structures", value: structure.length, icon: Boxes, href: `/viewer/${id}` },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><item.icon className="h-4 w-4" /></div>
            <div>
              <div className="text-lg font-bold text-slate-900">{item.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{item.label}</div>
            </div>
            <ArrowUpRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-emerald-600" />
          </Link>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="evidence">Evidence ({documents.length})</TabsTrigger>
          <TabsTrigger value="validation">Validation ({issues.length})</TabsTrigger>
          <TabsTrigger value="trust">Trust explanation</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="review">Decisions ({reviews.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Documents</CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
                  <Link href={`/documents/upload?record=${id}`}>Add evidence <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {documents.length ? documents.map((doc) => (
                  <div key={doc.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900">{doc.file_name}</div>
                        <div className="text-[10px] text-slate-500">
                          {categoryLabel(doc.document_category)} · {(doc.size_bytes / 1024).toFixed(0)} KB · {formatDateShort(doc.uploaded_at)}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] uppercase", doc.ocr_status === "complete" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                        {doc.ocr_status}
                      </Badge>
                    </div>
                    <div className="mt-2 truncate rounded bg-slate-50 px-2 py-1 font-mono text-[9px] text-slate-400">SHA-256 {doc.sha256_hash}</div>
                    <div className="mt-2 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="h-7 text-[10px]">
                        <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">View file</a>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-700">
                        <Link href={`/documents/upload?record=${id}&document=${doc.id}`}>Inspect extraction</Link>
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    No documents attached. Upload a 7/12 extract or cadastral map to build the evidence chain.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Extracted fields</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {fields.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="py-2 pr-2 font-medium">Field</th>
                          <th className="py-2 pr-2 font-medium">Extracted</th>
                          <th className="py-2 pr-2 font-medium">Corrected</th>
                          <th className="py-2 font-medium text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr key={field.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-2 font-medium text-slate-700">{FIELD_LABELS[field.field_name] ?? field.field_name}</td>
                            <td className="max-w-[140px] truncate py-2 pr-2 text-slate-600">{field.extracted_value || "—"}</td>
                            <td className="max-w-[140px] truncate py-2 pr-2 text-slate-600">{field.corrected_value || "—"}</td>
                            <td className="py-2 text-right">
                              <span className={cn("font-semibold", field.confidence >= 85 ? "text-emerald-700" : field.confidence >= 70 ? "text-amber-700" : "text-red-700")}>
                                {field.confidence.toFixed(0)}%
                              </span>
                              {field.requires_review ? <div className="text-[9px] text-amber-600">review</div> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    No extraction results yet. Upload a document and run OCR or enter fields manually.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-3">
          {issues.length ? issues.map((issue, index) => (
            <ValidationIssueCard key={issue.id ?? `${issue.rule_code}-${index}`} issue={issue} />
          )) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <BadgeCheck className="mx-auto h-6 w-6 text-emerald-700" />
              <div className="mt-2 text-sm font-semibold text-emerald-900">No validation findings</div>
              <p className="mt-1 text-xs text-emerald-800">All nine demo rules pass on the supplied evidence. A human decision is still required before certification.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trust">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Weighted score decomposition</CardTitle></CardHeader>
              <CardContent className="pt-0"><TrustBreakdown explanation={explanation} /></CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">How to read this score</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0 text-[11px] leading-5 text-slate-600">
                <p>The Parcel Trust Score aggregates four weighted components into a single 0–100 indicator. It is decision support, not a certificate.</p>
                <div className="space-y-2">
                  {[
                    ["Text integrity", "30%", "Document authenticity and extraction confidence."],
                    ["Text-to-map consistency", "30%", "Do textual areas, shares and land use match geometry?"],
                    ["Ground-truth match", "25%", "Satellite and ground evidence corroboration."],
                    ["Change & audit history", "15%", "Detected boundary shifts and evidence completeness."],
                  ].map(([label, weight, text]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{label}</span>
                        <span className="font-mono text-emerald-700">{weight}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{text}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
                  Routing: ≥ 90 auto-verification eligible · 60–89 officer review · below 60 escalate for re-survey. Even an eligible record still needs an officer to certify it.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Change timeline</CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
                  <Link href={`/history/${id}`}>Open 4D view <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {history.length ? history.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{entry.year}</span>
                      <Badge variant="outline" className="border-slate-200 text-[9px] text-slate-600">{entry.review_status}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{entry.description}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{entry.evidence_description}</p>
                  </div>
                )) : <div className="text-xs text-slate-500">No historical epochs in the demo dataset.</div>}
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Property structure</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(structureCounts).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="border-slate-200 text-[10px] capitalize text-slate-600">{count} {type}</Badge>
                  ))}
                </div>
                {structure.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[11px]">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="text-slate-400">{item.area ? `${item.area} m²` : item.structure_type}</span>
                  </div>
                ))}
                <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                  <Link href={`/viewer/${id}`}><LandPlot className="mr-1.5 h-3.5 w-3.5" /> Explore in 3D</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <AuditTimeline events={audit} />
        </TabsContent>

        <TabsContent value="review">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Officer decisions</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {reviews.length ? reviews.map((review) => (
                  <div key={review.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold capitalize text-slate-900">{review.decision.replaceAll("_", " ")}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(review.reviewed_at)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">By {review.officer_name}</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{review.comments}</p>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                    No human decision recorded yet. An officer must review this parcel before it can be certified.
                  </div>
                )}
                <Button asChild className="w-full bg-[#14532d] hover:bg-[#166534]">
                  <Link href={`/review?record=${id}`}><History className="mr-1.5 h-4 w-4" /> Open in review workspace</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Verification receipt</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {receipt ? (
                  <>
                    <div className="text-xs font-semibold text-slate-900">{receipt.receipt_no}</div>
                    <div className="break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500">SHA-256 {receipt.snapshot_hash}</div>
                    <div className="text-[10px] text-slate-500">Issued {formatDate(receipt.issued_at)}</div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={`/api/reports/record/${id}/pdf?type=receipt`} target="_blank" rel="noreferrer">Download receipt PDF</a>
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                    No receipt yet. A receipt is generated only after an officer approves this record.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
