"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Crosshair, Eraser, Layers, MapPin, MousePointerClick, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { TrustRing } from "@/components/app/trust-score";
import { ParcelMap, type ParcelFeature } from "@/components/map/parcel-map";
import { useApi } from "@/hooks/use-api";
import { apiSend } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MapPage() {
  const parcels = useApi<{ features: ParcelFeature[] }>("/api/parcels");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [survey, setSurvey] = useState("DEMO/1");
  const [saving, setSaving] = useState(false);

  const features = parcels.data?.features ?? [];
  const selected = useMemo(
    () => features.find((f) => f.properties.id === selectedId) ?? features[0] ?? null,
    [features, selectedId]
  );

  async function savePolygon() {
    if (points.length < 3) {
      toast.error("Add at least three vertices before saving the polygon.");
      return;
    }
    setSaving(true);
    try {
      const ring = [...points, points[0]];
      await apiSend("/api/parcels", "POST", {
        geometry: { type: "Polygon", coordinates: [ring] },
        survey_number: survey,
        label: `Drawn ${survey}`,
      });
      toast.success("Demo polygon saved", { description: "It is stored as an unverified, illustrative boundary and added to the map." });
      setPoints([]);
      setDrawing(false);
      parcels.reload();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (parcels.error) return <ErrorState message={parcels.error} onRetry={parcels.reload} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Geometry"
        title="Cadastral map"
        description="Explore illustrative parcel polygons, inspect overlaps, and draw a demo boundary. Geometry is the spatial half of the three-way validation."
        actions={
          <Button
            variant={drawing ? "default" : "outline"}
            className={drawing ? "bg-[#14532d] hover:bg-[#166534]" : ""}
            onClick={() => { setDrawing((v) => !v); setPoints([]); }}
          >
            <MousePointerClick className="mr-1.5 h-4 w-4" /> {drawing ? "Stop drawing" : "Draw polygon"}
          </Button>
        }
      />
      <DemoNotice>
        Boundaries are synthetic and loosely placed for demonstration. They are not surveyed coordinates and must never be treated as authoritative cadastral data.
      </DemoNotice>

      {parcels.loading ? (
        <LoadingState title="Loading parcel geometry" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <ParcelMap
              features={features}
              selectedId={selected?.properties.id ?? null}
              onSelect={(feature) => setSelectedId(feature.properties.id)}
              height={560}
              drawing={drawing}
              drawingPoints={points}
              onAddPoint={(point) => setPoints((current) => [...current, point])}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Layers className="h-3.5 w-3.5" /> {features.length} parcels · {features.filter((f) => f.properties.overlaps.length).length} with overlaps
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>
                  <Undo2 className="mr-1 h-3 w-3" /> Undo point
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setPoints([])} disabled={!points.length}>
                  <Eraser className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {drawing ? (
              <Card className="border-emerald-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Draw a demo parcel</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-[11px] leading-5 text-slate-600">
                    Click the map to place vertices. At least three points are required. The polygon is saved as an unverified demonstration boundary.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="survey" className="text-xs">Survey label</Label>
                    <Input id="survey" value={survey} onChange={(e) => setSurvey(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between"><span>Vertices</span><span className="font-semibold">{points.length}</span></div>
                    <div className="mt-1 flex items-center justify-between"><span>Status</span><span className="font-semibold text-blue-700">demo_unverified</span></div>
                  </div>
                  <Button onClick={savePolygon} disabled={saving || points.length < 3} className="w-full bg-[#14532d] hover:bg-[#166534]">
                    <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save demo polygon"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Selected parcel</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {selected ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-base font-bold text-slate-900">
                            {selected.properties.survey_number || selected.properties.label}
                          </div>
                          <div className="text-[10px] text-slate-500">{selected.properties.land_use || "Unspecified"}</div>
                          <div className="font-mono text-[9px] text-slate-400">{selected.properties.ulpin || "No ULPIN"}</div>
                        </div>
                        {selected.properties.trust_score !== null && <TrustRing score={selected.properties.trust_score} size={76} label="" />}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <div className="uppercase tracking-wider text-slate-400">Calculated area</div>
                          <div className="mt-0.5 text-sm font-semibold text-slate-800">{Math.round(selected.properties.area).toLocaleString("en-IN")} m²</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5">
                          <div className="uppercase tracking-wider text-slate-400">Source</div>
                          <div className="mt-0.5 text-xs font-medium text-slate-700">{selected.properties.source}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selected.properties.status && <StatusBadge status={selected.properties.status} />}
                        {selected.properties.overlaps.length > 0 && (
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
                            Overlaps: {selected.properties.overlaps.join(", ")}
                          </Badge>
                        )}
                      </div>
                      {selected.properties.land_record_id ? (
                        <Button asChild className="w-full bg-[#14532d] hover:bg-[#166534]" size="sm">
                          <Link href={`/records/${selected.properties.land_record_id}`}>Open land record <ArrowUpRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                      ) : (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[10px] leading-4 text-blue-900">
                          This user-drawn demo polygon is not linked to a land record. It exists only to demonstrate geometry capture.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500">Select a parcel on the map.</div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Parcel index</CardTitle></CardHeader>
              <CardContent className="max-h-[360px] space-y-1.5 overflow-y-auto pt-0 thin-scroll">
                {features.map((feature) => (
                  <button
                    key={feature.properties.id}
                    onClick={() => { setSelectedId(feature.properties.id); setDrawing(false); }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${
                      feature.properties.id === selected?.properties.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-800">{feature.properties.survey_number || feature.properties.label}</div>
                      <div className="truncate text-[9px] text-slate-500">
                        {Math.round(feature.properties.area).toLocaleString("en-IN")} m² · {feature.properties.land_use || "demo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {feature.properties.overlaps.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      <span className="font-mono text-[10px] text-slate-500">{feature.properties.trust_score ?? "—"}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="space-y-2 p-3 text-[11px] leading-5 text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800"><MapPin className="h-3.5 w-3.5 text-emerald-700" /> Legend</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> verified / high score</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> needs review</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> escalate / overlap</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" /> demo unverified</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Crosshair className="h-3 w-3" /> Hover, pan and zoom with your pointer.</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
