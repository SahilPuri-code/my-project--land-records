"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  FileStack,
  FileText,
  FolderSearch,
  Gauge,
  GitCompareArrows,
  Map,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustRing, trustTone } from "@/components/app/trust-score";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { AuditTimeline } from "@/components/app/audit-timeline";
import { ParcelMap, type ParcelFeature } from "@/components/map/parcel-map";
import {
  IssueBreakdownChart,
  StatusDonut,
  TrustDistributionChart,
} from "@/components/charts/trust-charts";
import { useApi } from "@/hooks/use-api";
import { formatDate, statusLabel } from "@/lib/api-client";
import type { LandRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Summary {
  counts: {
    total: number;
    digitized: number;
    verified: number;
    review: number;
    escalated: number;
    pending_reviews: number;
    correction: number;
    documents: number;
    ocr_complete: number;
  };
  average_trust_score: number;
  total_area: number;
  recent_activity: {
    id: string;
    action: string;
    description: string;
    created_at: string;
    user_name: string | null;
    survey_number: string | null;
    subdivision_number: string | null;
    land_record_id: string | null;
  }[];
  recent_records: LandRecord[];
  villages: string[];
}

interface Analytics {
  trust_distribution: { range: string; count: number }[];
  status_distribution: { status: string; count: number }[];
  issue_breakdown: { code: string; label: string; count: number; critical: number }[];
  upload_activity: { label: string; uploads: number }[];
  total_issues: number;
}

type RecordRow = LandRecord & { flag_count: number; document_count: number };

export default function DashboardPage() {
  const summary = useApi<Summary>("/api/dashboard/summary");
  const analytics = useApi<Analytics>("/api/dashboard/analytics");
  const recordsApi = useApi<{ records: RecordRow[] }>("/api/records");
  const parcels = useApi<{ features: ParcelFeature[] }>("/api/parcels");

  const [query, setQuery] = useState("");
  const [village, setVillage] = useState("all");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const records = recordsApi.data?.records ?? [];

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (query) {
        const haystack = `${record.survey_number}/${record.subdivision_number} ${record.ulpin} ${record.owner_name}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      if (village !== "all" && record.village !== village) return false;
      if (status !== "all" && record.status !== status) return false;
      if (band !== "all") {
        const [min, max] = band.split("-").map(Number);
        if (record.trust_score < min || record.trust_score > max) return false;
      }
      return true;
    });
  }, [records, query, village, status, band]);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? filtered[0] ?? records[0] ?? null;
  const queue = records
    .filter((r) => ["needs_officer_review", "escalate_resurvey", "correction_requested"].includes(r.status))
    .sort((a, b) => a.trust_score - b.trust_score)
    .slice(0, 4);

  const counts = summary.data?.counts;

  if (summary.error) {
    return <ErrorState message={summary.error} onRetry={summary.reload} />;
  }
  if (summary.loading || !summary.data) {
    return <LoadingState title="Loading land intelligence" description="Assembling records, scores and validation findings from the prototype database." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Decision support workspace"
        title="Land intelligence dashboard"
        description="Seven illustrative parcels, one evidence chain. Every score is explainable, every finding is traceable, and every certification waits for an authorized human decision."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/documents/upload">
                <UploadCloud className="mr-1.5 h-4 w-4" /> Upload document
              </Link>
            </Button>
            <Button asChild className="bg-[#14532d] hover:bg-[#166534]">
              <Link href="/validation">
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Validation center
              </Link>
            </Button>
          </>
        }
      />

      <DemoNotice />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Land records" value={counts?.total ?? records.length} hint={`${summary.data.counts.digitized} with linked evidence`} icon={FolderSearch} tone="green" />
        <StatCard label="Documents" value={counts?.documents ?? 0} hint={`${counts?.ocr_complete ?? 0} extracted · SHA-256 stored`} icon={FileStack} tone="blue" />
        <StatCard label="Pending review" value={counts?.pending_reviews ?? 0} hint={`${counts?.escalated ?? 0} escalated · ${counts?.correction ?? 0} correction`} icon={ShieldAlert} tone="amber" />
        <StatCard label="Verified (demo)" value={counts?.verified ?? 0} hint="Officer-approved prototype receipts" icon={BadgeCheck} tone="green" />
        <StatCard label="Avg. Trust Score" value={summary.data.average_trust_score} hint={`${summary.data.total_area.toLocaleString("en-IN")} m² recorded area`} icon={Gauge} tone="violet" />
        <StatCard label="Open findings" value={analytics.data?.total_issues ?? "—"} hint="Across all validation rules" icon={GitCompareArrows} tone="red" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search survey number, ULPIN or owner"
              className="h-9 pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[540px]">
            <select
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus-visible:border-emerald-500"
              aria-label="Filter by village"
            >
              <option value="all">All villages</option>
              {summary.data.villages.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus-visible:border-emerald-500"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="eligible_auto_verification">Auto-eligible</option>
              <option value="needs_officer_review">Officer review</option>
              <option value="escalate_resurvey">Escalate</option>
              <option value="correction_requested">Correction</option>
            </select>
            <select
              value={band}
              onChange={(e) => setBand(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus-visible:border-emerald-500"
              aria-label="Filter by score band"
            >
              <option value="all">All scores</option>
              <option value="90-100">90–100</option>
              <option value="60-89">60–89</option>
              <option value="0-59">0–59</option>
            </select>
          </div>
          <div className="text-[11px] text-slate-500 lg:whitespace-nowrap">
            {filtered.length} of {records.length} records
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Trust score distribution</CardTitle>
            <p className="text-[11px] text-slate-500">Auto-eligible ≥ 90 · review 60–89 · escalate &lt; 60</p>
          </CardHeader>
          <CardContent className="pt-2">
            {analytics.data ? <TrustDistributionChart data={analytics.data.trust_distribution} /> : <div className="h-[230px] animate-pulse rounded-lg bg-slate-100" />}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Workflow status</CardTitle>
            <p className="text-[11px] text-slate-500">Human decision always closes the loop</p>
          </CardHeader>
          <CardContent className="pt-2">
            {analytics.data ? <StatusDonut data={analytics.data.status_distribution} /> : <div className="h-[230px] animate-pulse rounded-lg bg-slate-100" />}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Findings by rule</CardTitle>
            <p className="text-[11px] text-slate-500">{analytics.data?.total_issues ?? 0} open findings across 9 rules</p>
          </CardHeader>
          <CardContent className="pt-2">
            {analytics.data ? <IssueBreakdownChart data={analytics.data.issue_breakdown} /> : <div className="h-[230px] animate-pulse rounded-lg bg-slate-100" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Cadastral overview</CardTitle>
              <p className="text-[11px] text-slate-500">Illustrative parcel geometry · overlaps hatched</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
              <Link href="/map">Open map <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {parcels.data ? (
              <ParcelMap
                features={parcels.data.features}
                selectedId={selectedRecord ? parcels.data.features.find((f) => f.properties.land_record_id === selectedRecord.id)?.properties.id : null}
                onSelect={(feature) => setSelectedId(feature.properties.land_record_id)}
                height={380}
              />
            ) : (
              <div className="h-[380px] animate-pulse rounded-lg bg-slate-100" />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Selected parcel</CardTitle>
            <p className="text-[11px] text-slate-500">Click a parcel on the map to inspect it</p>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedRecord ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold tracking-tight text-slate-900">
                      Survey {selectedRecord.survey_number}/{selectedRecord.subdivision_number}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">{selectedRecord.ulpin}</div>
                    <div className="mt-1.5 text-xs text-slate-600">{selectedRecord.owner_name}</div>
                    <div className="text-[11px] text-slate-500">
                      {selectedRecord.village}, {selectedRecord.district} · {selectedRecord.land_use}
                    </div>
                  </div>
                  <TrustRing score={selectedRecord.trust_score} size={86} label="" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="uppercase tracking-wider text-slate-400">Recorded area</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-800">{selectedRecord.recorded_area.toLocaleString("en-IN")} m²</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="uppercase tracking-wider text-slate-400">Mapped area</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-800">{selectedRecord.mapped_area.toLocaleString("en-IN")} m²</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedRecord.status} />
                  <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600">
                    {records.find((r) => r.id === selectedRecord.id)?.flag_count ?? 0} findings
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600">
                    {records.find((r) => r.id === selectedRecord.id)?.document_count ?? 0} documents
                  </Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button asChild size="sm" className="bg-[#14532d] hover:bg-[#166534]">
                    <Link href={`/records/${selectedRecord.id}`}>Open record</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/validation?record=${selectedRecord.id}`}>Explain score</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <Link href={`/passport/${selectedRecord.id}`} className="rounded-md border border-slate-200 p-2 text-center text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                    Passport
                  </Link>
                  <Link href={`/viewer/${selectedRecord.id}`} className="rounded-md border border-slate-200 p-2 text-center text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                    3D viewer
                  </Link>
                  <Link href={`/history/${selectedRecord.id}`} className="rounded-md border border-slate-200 p-2 text-center text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                    4D history
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-500">No record selected.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">Officer review queue</CardTitle>
              <p className="text-[11px] text-slate-500">Lowest score first · officers and admins only</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
              <Link href="/review">Review queue <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {queue.length ? (
              queue.map((record) => {
                const tone = trustTone(record.trust_score);
                return (
                  <Link
                    key={record.id}
                    href={`/review?record=${record.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">
                        Survey {record.survey_number}/{record.subdivision_number}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">{record.owner_name} · {record.village}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", tone.text)}>{record.trust_score}</span>
                      <StatusBadge status={record.status} />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                Review queue is clear. Ask an administrator to reset the demo dataset to restore sample cases.
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500">
              The prototype never auto-certifies a parcel. Approval is a written officer decision and issues a SHA-256 sealed receipt.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <p className="text-[11px] text-slate-500">Every scoring, upload and decision is audited</p>
          </CardHeader>
          <CardContent className="pt-0">
            <AuditTimeline
              events={summary.data.recent_activity.map((event) => ({
                id: event.id,
                user_id: null,
                land_record_id: event.land_record_id,
                action: event.action,
                description: event.description,
                document_hash: null,
                created_at: event.created_at,
                user_name: event.user_name,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm">Parcel register</CardTitle>
            <p className="text-[11px] text-slate-500">{filtered.length} matching illustrative records</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 text-[11px]">
            <Link href="/records">Full register <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-3 font-medium">Survey</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="hidden py-2 pr-3 font-medium md:table-cell">Village</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell">Area (rec/map)</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3">
                      <Link href={`/records/${record.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                        {record.survey_number}/{record.subdivision_number}
                      </Link>
                      <div className="hidden font-mono text-[9px] text-slate-400 lg:block">{record.ulpin}</div>
                    </td>
                    <td className="max-w-[160px] truncate py-2.5 pr-3 text-slate-700">{record.owner_name}</td>
                    <td className="hidden py-2.5 pr-3 text-slate-500 md:table-cell">{record.village}</td>
                    <td className="hidden py-2.5 pr-3 text-slate-500 sm:table-cell">
                      {record.recorded_area.toLocaleString("en-IN")} / {record.mapped_area.toLocaleString("en-IN")} m²
                    </td>
                    <td className={cn("py-2.5 pr-3 font-bold", trustTone(record.trust_score).text)}>{record.trust_score}</td>
                    <td className="py-2.5 pr-3"><StatusBadge status={record.status} /></td>
                    <td className="py-2.5 pr-3 text-right">
                      <Link href={`/validation?record=${record.id}`} className="text-[11px] font-medium text-emerald-700 hover:underline">
                        {record.flag_count}
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            {recordsApi.loading ? "Refreshing register…" : `Updated ${formatDate(summary.data.recent_records[0]?.updated_at)}`}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/records", label: "Browse land records", text: "Search, filter and open evidence bundles", icon: FolderSearch },
          { href: "/documents/upload", label: "Digitize a document", text: "Upload, OCR, correct and attach evidence", icon: FileText },
          { href: "/review", label: "Human review", text: "Approve, reject, correct or escalate", icon: Users },
          { href: "/reports", label: "Exports", text: "CSV, GeoJSON and per-record PDFs", icon: Sparkles },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300 hover:shadow"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-800">{item.label}</div>
              <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{item.text}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><Map className="h-3 w-3" /> Map geometry is illustrative only.</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> {statusLabel("needs_officer_review")} is a workflow state, not a legal finding.</span>
      </div>
    </div>
  );
}
