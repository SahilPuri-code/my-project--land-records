"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Braces,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Map,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { useApi } from "@/hooks/use-api";
import { formatDate } from "@/lib/api-client";
import type { LandRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Summary {
  counts: { total: number; verified: number; pending_reviews: number; documents: number };
  average_trust_score: number;
  total_area: number;
}

type RecordRow = LandRecord & { flag_count: number; document_count: number };

export default function ReportsPage() {
  const summary = useApi<Summary>("/api/dashboard/summary");
  const records = useApi<{ records: RecordRow[] }>("/api/records");
  const [status, setStatus] = useState("all");

  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.reload} />;
  if (summary.loading || !summary.data) return <LoadingState title="Loading export center" description="Preparing record counts and export options." />;

  const counts = summary.data.counts;
  const csvHref = status === "all" ? "/api/reports/records/csv" : `/api/reports/records/csv?status=${status}`;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Export center"
        title="Reports & exports"
        description="Download machine-readable registers, spatial data and per-record PDF reports. Every export is generated live from the prototype database."
        actions={
          <Button asChild variant="outline">
            <a href="/api/reports/records/geojson" target="_blank" rel="noreferrer">
              <Map className="mr-1.5 h-4 w-4" /> GeoJSON
            </a>
          </Button>
        }
      />

      <DemoNotice>
        Exports contain synthetic records. They are suitable for demonstrating interoperability and are not official government data.
      </DemoNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Records in register", value: counts.total, hint: "CSV / GeoJSON / PDF", icon: FileBarChart },
          { label: "Verified (demo)", value: counts.verified, hint: "With prototype receipts", icon: ShieldCheck },
          { label: "Pending human review", value: counts.pending_reviews, hint: "Review / escalate / correction", icon: FileText },
          { label: "Average Trust Score", value: summary.data.average_trust_score, hint: `${summary.data.total_area.toLocaleString("en-IN")} m² total`, icon: FileSpreadsheet },
        ].map((item) => (
          <Card key={item.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-start justify-between gap-2 p-3.5">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{item.label}</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{item.value}</div>
                <div className="text-[10px] text-slate-400">{item.hint}</div>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><item.icon className="h-4 w-4" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm"><FileSpreadsheet className="h-4 w-4 text-emerald-700" /> Register CSV</CardTitle>
            <p className="text-[11px] text-slate-500">Spreadsheet-ready export of the parcel register</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-1.5">
              <label htmlFor="status" className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Filter by status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
              >
                <option value="all">All records</option>
                <option value="verified">Verified</option>
                <option value="eligible_auto_verification">Auto-eligible</option>
                <option value="needs_officer_review">Officer review</option>
                <option value="escalate_resurvey">Escalate</option>
                <option value="correction_requested">Correction requested</option>
              </select>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-[10px] leading-4 text-slate-500">
              Columns: ULPIN, survey, owner, village, area, land use, status, trust score, updated timestamp.
            </div>
            <Button asChild className="w-full bg-[#14532d] hover:bg-[#166534]">
              <a href={csvHref}><Download className="mr-1.5 h-4 w-4" /> Download CSV</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm"><Braces className="h-4 w-4 text-emerald-700" /> Spatial GeoJSON</CardTitle>
            <p className="text-[11px] text-slate-500">Current parcel polygons with properties</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg bg-slate-50 p-2 text-[10px] leading-5 text-slate-500">
              A FeatureCollection of current-epoch parcels including survey number, ULPIN, calculated area, land use, trust score, status and detected overlaps.
            </div>
            <Button asChild variant="outline" className="w-full">
              <a href="/api/reports/records/geojson" target="_blank" rel="noreferrer">
                <Map className="mr-1.5 h-4 w-4" /> Download GeoJSON
              </a>
            </Button>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <ShieldCheck className="h-3 w-3" /> Coordinates are illustrative, not surveyed.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm"><FileText className="h-4 w-4 text-emerald-700" /> Per-record PDF</CardTitle>
            <p className="text-[11px] text-slate-500">Printable summary, validation and passport reports</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg bg-slate-50 p-2 text-[10px] leading-5 text-slate-500">
              Select a record below to download its PDF. Receipt PDFs include the snapshot hash and the human-in-the-loop disclaimer.
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/records"><FileBarChart className="mr-1.5 h-4 w-4" /> Choose a record</Link>
            </Button>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Printer className="h-3 w-3" /> Generated locally without external services.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm">Record-level reports</CardTitle>
            <p className="text-[11px] text-slate-500">PDF summary, validation report and receipt (where issued)</p>
          </div>
          <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">{records.data?.records.length ?? 0} records</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Survey</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Updated</th>
                  <th className="px-3 py-2.5 text-right font-medium">Exports</th>
                </tr>
              </thead>
              <tbody>
                {(records.data?.records ?? []).map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <Link href={`/records/${record.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                        {record.survey_number}/{record.subdivision_number}
                      </Link>
                      <div className="font-mono text-[9px] text-slate-400">{record.ulpin}</div>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-600">{record.owner_name}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={record.status} /></td>
                    <td className="hidden px-3 py-2.5 text-[10px] text-slate-500 sm:table-cell">{formatDate(record.updated_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-700">
                          <a href={`/api/reports/record/${record.id}/pdf`} target="_blank" rel="noreferrer">Summary</a>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-700">
                          <a href={`/api/reports/record/${record.id}/pdf?type=validation`} target="_blank" rel="noreferrer">Validation</a>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-7 text-[10px] text-emerald-700">
                          <a href={`/api/reports/record/${record.id}/pdf?type=receipt`} target="_blank" rel="noreferrer">Receipt</a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!records.data?.records.length && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-500">No records available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-emerald-700" /> Exports include the demo-data disclaimer.</span>
        <Link href="/validation" className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline">Review validation findings <ArrowUpRight className="h-3 w-3" /></Link>
      </div>
    </div>
  );
}
