"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Layers,
  Pause,
  Play,
  Ruler,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { DemoNotice, EmptyState, ErrorState, LoadingState } from "@/components/app/empty-state";
import { ParcelMap, type ParcelFeature } from "@/components/map/parcel-map";
import { useApi } from "@/hooks/use-api";
import { formatDate } from "@/lib/api-client";
import { centroidDistanceM, polygonAreaM2, toRing } from "@/lib/geo";
import type { LandRecord, PropertyHistoryRow, PropertyStructureRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HistoryResponse {
  record: LandRecord;
  history: PropertyHistoryRow[];
  structure: PropertyStructureRow[];
  demo_notice: string;
}

interface BuildingMeta {
  floors?: number;
  units?: number;
  height?: number;
  footprint?: number;
  extension?: boolean;
}

function parseMeta(value: string | null | undefined): BuildingMeta {
  try {
    return value ? (JSON.parse(value) as BuildingMeta) : {};
  } catch {
    return {};
  }
}

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<HistoryResponse>(`/api/history/${id}`);
  const [yearIndex, setYearIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const initialized = useRef(false);

  const history = data?.history ?? [];
  const current = history[yearIndex] ?? null;

  useEffect(() => {
    if (history.length && !initialized.current) {
      initialized.current = true;
      setYearIndex(history.length - 1);
    }
  }, [history.length]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setYearIndex((index) => (index + 1 < history.length ? index + 1 : 0));
    }, 2000);
    return () => clearInterval(timer);
  }, [playing, history.length]);

  const features: ParcelFeature[] = useMemo(() => {
    return history.map((entry) => {
      const ring = toRing(entry.geometry_geojson);
      return {
        type: "Feature" as const,
        geometry: ring ? { type: "Polygon" as const, coordinates: [ring] } : { type: "Polygon" as const, coordinates: [[]] },
        properties: {
          id: entry.id,
          land_record_id: entry.land_record_id,
          survey_number: `${entry.year}`,
          ulpin: data?.record.ulpin ?? null,
          label: `${entry.year} epoch`,
          area: ring ? Math.round(polygonAreaM2(ring)) : 0,
          land_use: data?.record.land_use ?? null,
          trust_score: data?.record.trust_score ?? null,
          status: entry.review_status === "confirmed" ? "verified" : entry.review_status === "pending_review" ? "needs_officer_review" : "digitized",
          overlaps: [],
          source: "Historical demo epoch",
        },
      };
    });
  }, [history, data]);

  const previous = yearIndex > 0 ? history[yearIndex - 1] : null;
  const currentMeta = parseMeta(current?.building_metadata_json);
  const previousMeta = parseMeta(previous?.building_metadata_json);

  const area = current ? Math.round(polygonAreaM2(JSON.parse(current.geometry_geojson).coordinates[0] as [number, number][])) : 0;
  const previousArea = previous ? Math.round(polygonAreaM2(JSON.parse(previous.geometry_geojson).coordinates[0] as [number, number][])) : 0;
  const areaDelta = previous ? area - previousArea : 0;

  const centroidShift = useMemo(() => {
    if (!current || !previous) return 0;
    const currentRing = toRing(current.geometry_geojson);
    const previousRing = toRing(previous.geometry_geojson);
    if (!currentRing || !previousRing) return 0;
    return centroidDistanceM(previousRing, currentRing);
  }, [current, previous]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingState title="Loading 4D history" description="Fetching historical survey epochs and building metadata." />;

  if (!history.length) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow={`Survey ${data.record.survey_number}/${data.record.subdivision_number}`} title="4D property history" description="No historical epochs are available for this illustrative parcel." />
        <EmptyState
          title="No multi-year history"
          description="The demo dataset contains 2024–2026 epochs for parcel 118/2. Open that record to explore the full 4D timeline."
          action={<Button asChild><Link href="/history/rec_118_2">Open 118/2 history</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Link href={`/records/${id}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
          <ArrowLeft className="h-3 w-3" /> Back to record
        </Link>
        <span>/</span>
        <span className="text-slate-700">4D property history</span>
      </div>

      <PageHeader
        eyebrow={`Survey ${data.record.survey_number}/${data.record.subdivision_number} · ${data.record.village}`}
        title="4D property history"
        description="Step through illustrative survey epochs to see how the parcel boundary and built structure changed over time. Ground evidence is compared epoch by epoch."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/viewer/${id}`}><Boxes className="mr-1.5 h-4 w-4" /> Current 3D view</Link>
            </Button>
            <Button asChild className="bg-[#14532d] hover:bg-[#166534]">
              <Link href={`/passport/${id}`}><ShieldCheck className="mr-1.5 h-4 w-4" /> Property passport</Link>
            </Button>
          </>
        }
      />

      <DemoNotice>{data.demo_notice}</DemoNotice>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" /> Survey epochs
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setPlaying((v) => !v)}>
              {playing ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}
              {playing ? "Pause" : "Play timeline"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute left-3 right-3 top-[15px] h-0.5 bg-slate-200" />
            <div className="relative grid grid-cols-3 gap-2 sm:grid-cols-3">
              {history.map((entry, index) => (
                <button
                  key={entry.id}
                  onClick={() => { setYearIndex(index); setPlaying(false); }}
                  className="group flex flex-col items-center text-center"
                >
                  <span
                    className={cn(
                      "z-10 grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-bold transition",
                      index === yearIndex
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : index < yearIndex
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300"
                    )}
                  >
                    {entry.year}
                  </span>
                  <span className={cn("mt-1.5 text-[9px] font-medium uppercase tracking-wider", index === yearIndex ? "text-emerald-700" : "text-slate-400")}>
                    {entry.review_status.replaceAll("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm">{current?.year} parcel geometry</CardTitle>
              <p className="text-[11px] text-slate-500">Highlighted epoch over earlier epochs</p>
            </div>
            <Badge variant="outline" className="border-slate-200 text-[10px] capitalize text-slate-600">{current?.review_status.replaceAll("_", " ")}</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <ParcelMap features={features} selectedId={current?.id ?? null} height={420} />
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Earlier epochs are drawn as background context.</span>
              <span>{current ? formatDate(`${current.year}-06-15T10:00:00.000Z`) : ""}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{current?.year} change summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="text-[11px] leading-5 text-slate-600">{current?.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Epoch area</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">{area.toLocaleString("en-IN")} m²</div>
                  {previous && (
                    <div className={cn("text-[9px] font-medium", areaDelta === 0 ? "text-slate-400" : areaDelta > 0 ? "text-blue-600" : "text-red-600")}>
                      {areaDelta >= 0 ? "+" : ""}{areaDelta} m² vs {previous.year}
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Centroid shift</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">{centroidShift ? `${centroidShift.toFixed(1)} m` : "—"}</div>
                  <div className="text-[9px] text-slate-400">{previous ? `compared with ${previous.year}` : "first recorded epoch"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Floors</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">
                    {currentMeta.floors ?? "—"}
                    {previous && (currentMeta.floors ?? 0) !== (previousMeta.floors ?? 0) && (
                      <span className="ml-1 text-[9px] font-medium text-amber-600">was {previousMeta.floors ?? "—"}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">Units</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800">
                    {currentMeta.units ?? "—"}
                    {previous && (currentMeta.units ?? 0) !== (previousMeta.units ?? 0) && (
                      <span className="ml-1 text-[9px] font-medium text-amber-600">was {previousMeta.units ?? "—"}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Ruler className="h-3 w-3" /> Building metadata
                </div>
                <div className="text-[11px] text-slate-600">
                  Height {currentMeta.height ?? "—"} m · footprint {currentMeta.footprint ?? "—"} m² · extension {currentMeta.extension ? "detected" : "not detected"}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500">
                <span className="font-semibold text-slate-700">Evidence:</span> {current?.evidence_description}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Epoch comparison</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              {previous ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-3.5 w-3.5" /> Detected change {previous.year} → {current?.year}</div>
                  <p className="mt-1">
                    {centroidShift > 6
                      ? `Boundary centroid moved ${centroidShift.toFixed(1)} m, above the 6 m stability threshold used by the validation engine.`
                      : `Boundary movement of ${centroidShift.toFixed(1)} m is within the 6 m stability threshold.`}
                    {areaDelta !== 0 ? ` Epoch area changed by ${areaDelta} m².` : ""}
                  </p>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">This is the first recorded epoch in the demo dataset, so there is no earlier geometry to compare.</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled={yearIndex === 0} onClick={() => { setYearIndex((i) => Math.max(0, i - 1)); setPlaying(false); }} className="text-[10px]">
                  <ArrowLeft className="mr-1 h-3 w-3" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={yearIndex >= history.length - 1} onClick={() => { setYearIndex((i) => Math.min(history.length - 1, i + 1)); setPlaying(false); }} className="text-[10px]">
                  Next <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <StatusBadge status={data.record.status} />
                <Link href={`/validation?record=${id}`} className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline">
                  See current validation <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Epoch register</CardTitle>
          <p className="text-[11px] text-slate-500">Illustrative historical evidence chain — not an authoritative land history</p>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {history.map((entry, index) => (
            <button
              key={entry.id}
              onClick={() => { setYearIndex(index); setPlaying(false); }}
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition sm:flex-row sm:items-center sm:justify-between",
                index === yearIndex ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{entry.year}</span>
                  <Badge variant="outline" className="border-slate-200 text-[9px] capitalize text-slate-500">{entry.review_status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">{entry.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                <Layers className="h-3 w-3" /> {parseMeta(entry.building_metadata_json).floors ?? "—"} floors
              </div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
