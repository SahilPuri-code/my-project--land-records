"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarClock, Info, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { PropertyViewer } from "@/components/viewer/property-viewer";
import { useApi } from "@/hooks/use-api";
import type {
  DocumentRow,
  LandRecord,
  PropertyHistoryRow,
  PropertyStructureRow,
  TrustScoreExplanation,
  ValidationIssue,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Bundle {
  record: LandRecord;
  documents: DocumentRow[];
  issues: ValidationIssue[];
  history: PropertyHistoryRow[];
  structure: PropertyStructureRow[];
  explanation: TrustScoreExplanation | null;
}

export default function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Bundle>(`/api/records/${id}`);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState title="Building the 3D view" description="Reconstructing the illustrative building envelope from recorded floor and unit attributes." />;

  const { record, structure, history } = data;
  const latest = history[history.length - 1] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Link href={`/records/${id}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
          <ArrowLeft className="h-3 w-3" /> Back to record
        </Link>
        <span>/</span>
        <span className="text-slate-700">3D property viewer</span>
      </div>

      <PageHeader
        eyebrow={`Survey ${record.survey_number}/${record.subdivision_number}`}
        title="3D property structure"
        description="A schematic, interactive reconstruction of the parcel envelope, floors and units. Select a floor or unit to inspect its recorded attributes."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/history/${id}`}><CalendarClock className="mr-1.5 h-4 w-4" /> 4D history</Link>
            </Button>
            <Button asChild className="bg-[#14532d] hover:bg-[#166534]">
              <Link href={`/passport/${id}`}><ShieldCheck className="mr-1.5 h-4 w-4" /> Property passport</Link>
            </Button>
          </>
        }
      />

      <DemoNotice />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={record.status} />
        <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-slate-600">{record.ulpin}</Badge>
        <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">{structure.length} structure components</Badge>
        {latest && (
          <Badge variant="outline" className="border-slate-200 bg-white text-[10px] text-slate-600">
            Latest epoch {latest.year} · {latest.review_status}
          </Badge>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <PropertyViewer structure={structure} surveyNumber={`${record.survey_number}/${record.subdivision_number}`} landUse={record.land_use} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">What am I looking at?</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-0 text-[11px] leading-5 text-slate-600">
            <p>The model is extruded from recorded attributes: footprint, floor count, floor heights and unit splits. It is not a photogrammetric or LiDAR reconstruction.</p>
            <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-blue-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Useful for demonstrating the 3D/4D property passport concept. Not a surveyed building model.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recorded attributes</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {[
              ["Recorded area", `${record.recorded_area.toLocaleString("en-IN")} m²`],
              ["Mapped area", `${record.mapped_area.toLocaleString("en-IN")} m²`],
              ["Land use", record.land_use],
              ["Owner share", `${(record.owner_share * 100).toFixed(0)}%`],
              ["Floors", `${structure.filter((s) => s.structure_type === "floor").length}`],
              ["Units", `${structure.filter((s) => s.structure_type === "unit").length}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[11px]">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-800">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Latest change</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {latest ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">{latest.year}</div>
                <p className="text-[11px] leading-5 text-slate-600">{latest.description}</p>
                <p className="text-[10px] text-slate-400">{latest.evidence_description}</p>
                <Button asChild variant="outline" size="sm" className="w-full text-[10px]">
                  <Link href={`/history/${id}`}>Compare epochs <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">No multi-year history in the demo dataset for this parcel.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
