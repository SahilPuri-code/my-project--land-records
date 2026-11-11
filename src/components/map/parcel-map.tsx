"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParcelProperties {
  id: string;
  land_record_id: string | null;
  survey_number: string | null;
  ulpin: string | null;
  label: string | null;
  area: number;
  land_use: string | null;
  trust_score: number | null;
  status: string | null;
  overlaps: string[];
  source: string;
}

export interface ParcelFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: ParcelProperties;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const W = 1000;
const H = 620;
const PAD = 60;

function statusColor(status: string | null, score: number | null) {
  if (status === "verified" || status === "eligible_auto_verification") return "#16a34a";
  if (status === "escalate_resurvey" || status === "rejected") return "#dc2626";
  if (status === "needs_officer_review" || status === "correction_requested") return "#f59e0b";
  if (status === "demo_unverified") return "#2563eb";
  if (score === null) return "#94a3b8";
  return score >= 90 ? "#16a34a" : score >= 60 ? "#f59e0b" : "#dc2626";
}

export function ParcelMap({
  features,
  selectedId,
  onSelect,
  height = 400,
  showLabels = true,
  className,
  drawingPoints = [],
  onAddPoint,
  drawing = false,
}: {
  features: ParcelFeature[];
  selectedId?: string | null;
  onSelect?: (feature: ParcelFeature) => void;
  height?: number;
  showLabels?: boolean;
  className?: string;
  drawingPoints?: [number, number][];
  onAddPoint?: (point: [number, number]) => void;
  drawing?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, w: W, h: H });
  const [drag, setDrag] = useState<{ x: number; y: number; vb: ViewBox } | null>(null);

  const bounds = useMemo(() => {
    const all: [number, number][] = [];
    for (const feature of features) {
      for (const [lon, lat] of feature.geometry.coordinates[0] ?? []) all.push([lon, lat]);
    }
    if (!all.length) return { minLon: 76.769, maxLon: 76.782, minLat: 19.259, maxLat: 19.266 };
    const lons = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return { minLon, maxLon, minLat, maxLat };
  }, [features]);

  const project = useMemo(() => {
    const dx = Math.max(bounds.maxLon - bounds.minLon, 1e-6);
    const dy = Math.max(bounds.maxLat - bounds.minLat, 1e-6);
    const scale = Math.min((W - PAD * 2) / dx, (H - PAD * 2) / dy);
    const offsetX = (W - dx * scale) / 2;
    const offsetY = (H - dy * scale) / 2;
    return (lon: number, lat: number): [number, number] => [
      offsetX + (lon - bounds.minLon) * scale,
      H - offsetY - (lat - bounds.minLat) * scale,
    ];
  }, [bounds]);

  const defaultView = useMemo<ViewBox>(() => ({ x: 0, y: 0, w: W, h: H }), []);
  const boundsKey = `${bounds.minLon.toFixed(4)}-${bounds.maxLon.toFixed(4)}-${bounds.minLat.toFixed(4)}-${bounds.maxLat.toFixed(4)}`;

  useEffect(() => {
    setViewBox(defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  function zoom(factor: number) {
    setViewBox((vb) => {
      const nextW = Math.max(120, Math.min(W * 2.2, vb.w * factor));
      const nextH = nextW * (H / W);
      return {
        x: vb.x + (vb.w - nextW) / 2,
        y: vb.y + (vb.h - nextH) / 2,
        w: nextW,
        h: nextH,
      };
    });
  }

  function toGeo(clientX: number, clientY: number): [number, number] {
    const el = svgRef.current;
    if (!el) return [bounds.minLon, bounds.minLat];
    const rect = el.getBoundingClientRect();
    const sx = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
    const sy = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
    const dx = Math.max(bounds.maxLon - bounds.minLon, 1e-6);
    const dy = Math.max(bounds.maxLat - bounds.minLat, 1e-6);
    const scale = Math.min((W - PAD * 2) / dx, (H - PAD * 2) / dy);
    const offsetX = (W - dx * scale) / 2;
    const offsetY = (H - dy * scale) / 2;
    const lon = bounds.minLon + (sx - offsetX) / scale;
    const lat = bounds.minLat + (H - offsetY - sy) / scale;
    return [Number(lon.toFixed(7)), Number(lat.toFixed(7))];
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc]", className)} style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={cn("h-full w-full", drawing ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
        style={{ touchAction: "none" }}
        onWheel={(e) => {
          e.preventDefault();
          zoom(e.deltaY > 0 ? 1.14 : 0.88);
        }}
        onPointerDown={(e) => {
          if (drawing) return;
          setDrag({ x: e.clientX, y: e.clientY, vb: viewBox });
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const el = svgRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const dx = ((e.clientX - drag.x) / rect.width) * drag.vb.w;
          const dy = ((e.clientY - drag.y) / rect.height) * drag.vb.h;
          setViewBox({ ...drag.vb, x: drag.vb.x - dx, y: drag.vb.y - dy });
        }}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        onClick={(e) => {
          if (!drawing || !onAddPoint) return;
          onAddPoint(toGeo(e.clientX, e.clientY));
        }}
      >
        <defs>
          <pattern id="parcelGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
          </pattern>
          <pattern id="overlapHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" strokeWidth="2" opacity="0.25" />
          </pattern>
        </defs>
        <rect x={-2000} y={-2000} width={6000} height={6000} fill="#f8fafc" />
        <rect x={-2000} y={-2000} width={6000} height={6000} fill="url(#parcelGrid)" />
        <g opacity="0.5">
          <path d={`M 0 ${H * 0.62} C 220 ${H * 0.56}, 420 ${H * 0.7}, ${W} ${H * 0.6}`} fill="none" stroke="#93c5fd" strokeWidth="8" />
          <path d={`M ${W * 0.32} 0 C ${W * 0.38} 160, ${W * 0.25} 360, ${W * 0.35} ${H}`} fill="none" stroke="#bbf7d0" strokeWidth="12" />
        </g>
        {features.map((feature) => {
          const ring = feature.geometry.coordinates[0] ?? [];
          const points = ring.map(([lon, lat]) => project(lon, lat).join(",")).join(" ");
          const selected = feature.properties.id === selectedId;
          const color = statusColor(feature.properties.status, feature.properties.trust_score);
          const centroid = ring.length
            ? project(
                ring.reduce((s, p) => s + p[0], 0) / ring.length,
                ring.reduce((s, p) => s + p[1], 0) / ring.length
              )
            : [0, 0];
          return (
            <g key={feature.properties.id} onClick={(e) => { if (drawing) return; e.stopPropagation(); onSelect?.(feature); }} className={drawing ? "" : "cursor-pointer"}>
              <polygon
                points={points}
                fill={color}
                fillOpacity={selected ? 0.38 : 0.2}
                stroke={selected ? "#0f172a" : color}
                strokeWidth={selected ? 3.2 : 2}
                strokeDasharray={feature.properties.status === "demo_unverified" ? "7 4" : undefined}
              />
              {feature.properties.overlaps.length > 0 && <polygon points={points} fill="url(#overlapHatch)" stroke="#dc2626" strokeWidth={selected ? 3 : 1.5} strokeDasharray="4 3" />}
              {showLabels && (
                <g pointerEvents="none">
                  <text x={centroid[0]} y={centroid[1] - 2} textAnchor="middle" fontSize={selected ? 17 : 14} fontWeight={700} fill="#0f172a">
                    {feature.properties.survey_number || feature.properties.label || "DEMO"}
                  </text>
                  <text x={centroid[0]} y={centroid[1] + 15} textAnchor="middle" fontSize={10.5} fill="#475569">
                    {feature.properties.area ? `${Math.round(feature.properties.area).toLocaleString("en-IN")} m²` : "demo"}
                    {feature.properties.trust_score !== null ? ` · ${Math.round(feature.properties.trust_score)}/100` : ""}
                  </text>
                  {feature.properties.overlaps.length > 0 && (
                    <text x={centroid[0]} y={centroid[1] + 30} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#b91c1c">
                      OVERLAP DETECTED
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
        {drawingPoints.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={drawingPoints.map(([lon, lat]) => project(lon, lat).join(",")).join(" ")}
              fill="rgba(37,99,235,0.12)"
              stroke="#2563eb"
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            {drawingPoints.map(([lon, lat], i) => {
              const [x, y] = project(lon, lat);
              return (
                <g key={`${lon}-${lat}-${i}`}>
                  <circle cx={x} cy={y} r={5} fill="#fff" stroke="#2563eb" strokeWidth={2} />
                  <text x={x + 8} y={y - 6} fontSize={10} fill="#1d4ed8">{i + 1}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {[
          { icon: Plus, action: () => zoom(0.82), label: "Zoom in" },
          { icon: Minus, action: () => zoom(1.22), label: "Zoom out" },
          { icon: RotateCcw, action: () => setViewBox(defaultView), label: "Reset view" },
        ].map((btn) => (
          <button key={btn.label} onClick={btn.action} aria-label={btn.label} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white/95 text-slate-600 shadow-sm hover:bg-white">
            <btn.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[9px] text-slate-500 shadow-sm">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> Verified / high</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" /> Review</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> Escalate / overlap</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-400" /> Reference</span>
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[9px] text-slate-400 shadow-sm">
        <Maximize2 className="h-3 w-3" /> Drag to pan · wheel to zoom
      </div>
    </div>
  );
}
