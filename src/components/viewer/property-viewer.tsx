"use client";

import { useMemo, useState } from "react";
import { Box, Layers, RotateCw, Ruler, Tag } from "lucide-react";
import type { PropertyStructureRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VIEW_W = 760;
const VIEW_H = 560;
const SCALE = 8.2;
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const FOOTPRINT_W = 20;
const FOOTPRINT_D = 12;
const DEFAULT_FLOOR_HEIGHT = 3.2;

type Point = [number, number];

function iso(x: number, y: number, z: number, rotation: number): Point {
  const r = ((rotation % 4) + 4) % 4;
  let rx = x;
  let ry = y;
  if (r === 1) [rx, ry] = [-y, x];
  if (r === 2) [rx, ry] = [-x, -y];
  if (r === 3) [rx, ry] = [y, -x];
  return [
    VIEW_W / 2 + (rx - ry) * COS * SCALE,
    VIEW_H / 2 + 40 + (rx + ry) * SIN * SCALE - z * SCALE,
  ];
}

function polygon(points: Point[]) {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export function PropertyViewer({
  structure,
  surveyNumber,
  landUse,
}: {
  structure: PropertyStructureRow[];
  surveyNumber: string;
  landUse: string;
}) {
  const building = structure.find((item) => item.structure_type === "building") ?? null;
  const floors = useMemo(
    () =>
      structure
        .filter((item) => item.structure_type === "floor")
        .sort((a, b) => (a.floor_number ?? 0) - (b.floor_number ?? 0)),
    [structure]
  );
  const units = useMemo(() => structure.filter((item) => item.structure_type === "unit"), [structure]);
  const utility = structure.find((item) => item.structure_type === "utility") ?? null;

  const defaultFloor = floors.length ? floors[0].id : null;
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(defaultFloor);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showUnits, setShowUnits] = useState(true);

  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId) ?? floors[0] ?? null;
  const floorUnits = selectedFloor
    ? units.filter((unit) => unit.parent_id === selectedFloor.id)
    : [];
  const selectedUnit = floorUnits.find((unit) => unit.id === selectedUnitId) ?? null;

  const floorHeight = selectedFloor?.height || DEFAULT_FLOOR_HEIGHT;
  const floorCount = Math.max(floors.length, building ? 1 : 0);

  const parcelCorners: Point[] = [
    iso(-24, -17, 0, rotation),
    iso(24, -17, 0, rotation),
    iso(24, 17, 0, rotation),
    iso(-24, 17, 0, rotation),
  ];

  const footprint: [number, number][] = [
    [-FOOTPRINT_W / 2, -FOOTPRINT_D / 2],
    [FOOTPRINT_W / 2, -FOOTPRINT_D / 2],
    [FOOTPRINT_W / 2, FOOTPRINT_D / 2],
    [-FOOTPRINT_W / 2, FOOTPRINT_D / 2],
  ];

  const floorShapes = (selectedFloor ? floors : []).map((floor, index) => {
    const base = index * floorHeight;
    const top = base + floorHeight;
    const bottom = footprint.map(([x, y]) => iso(x, y, base, rotation));
    const upper = footprint.map(([x, y]) => iso(x, y, top, rotation));
    const isSelected = selectedFloor?.id === floor.id;
    return { floor, base, top, bottom, upper, isSelected, index };
  });

  const ceilingZ = floorCount * floorHeight;
  const roof = footprint.map(([x, y]) => iso(x, y, ceilingZ, rotation));

  const unitShapes = selectedFloor && showUnits
    ? floorUnits.map((unit, index) => {
        const count = floorUnits.length || 1;
        const unitWidth = FOOTPRINT_W / count;
        const x0 = -FOOTPRINT_W / 2 + index * unitWidth;
        const x1 = x0 + unitWidth;
        const inset = 0.5;
        const z = ((selectedFloor.floor_number ?? 1) * floorHeight) + 0.06;
        const corners = [
          iso(x0 + inset, -FOOTPRINT_D / 2 + inset, z, rotation),
          iso(x1 - inset, -FOOTPRINT_D / 2 + inset, z, rotation),
          iso(x1 - inset, FOOTPRINT_D / 2 - inset, z, rotation),
          iso(x0 + inset, FOOTPRINT_D / 2 - inset, z, rotation),
        ];
        const center = iso((x0 + x1) / 2, 0, z, rotation);
        return { unit, corners, center, selected: unit.id === selectedUnitId };
      })
    : [];

  const utilityBox = utility && selectedFloor
    ? (() => {
        const z = ceilingZ;
        const cx = 4;
        const cy = -2;
        const size = 2.4;
        const corners = footprint.map(([x, y]) => [cx + (x / FOOTPRINT_W) * size, cy + (y / FOOTPRINT_D) * size] as [number, number]);
        const lower = corners.map(([x, y]) => iso(x, y, z, rotation));
        const upper = corners.map(([x, y]) => iso(x, y, z + 1.4, rotation));
        return { lower, upper };
      })()
    : null;

  const tone = ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e"];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-[420px] w-full sm:h-[500px]">
          <defs>
            <linearGradient id="parcelFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#dcfce7" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#86efac" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          <polygon points={polygon(parcelCorners)} fill="url(#parcelFill)" stroke="#16a34a" strokeWidth={1.6} strokeDasharray="6 4" />
          <text
            x={VIEW_W / 2}
            y={VIEW_H - 12}
            textAnchor="middle"
            fontSize={10}
            fill="#15803d"
          >
            Illustrative parcel envelope · Survey {surveyNumber} · {landUse}
          </text>

          {floorShapes.map((shape) => {
            return (
              <g key={shape.floor.id}>
                <polygon
                  points={polygon([shape.bottom[1], shape.bottom[2], shape.upper[2], shape.upper[1]])}
                  fill={shape.isSelected ? "#fde68a" : tone[shape.index % tone.length]}
                  stroke={shape.isSelected ? "#b45309" : "#15803d"}
                  strokeWidth={shape.isSelected ? 2 : 1}
                  opacity={0.95}
                />
                <polygon
                  points={polygon([shape.bottom[2], shape.bottom[3], shape.upper[3], shape.upper[2]])}
                  fill={shape.isSelected ? "#fcd34d" : "#16a34a"}
                  stroke={shape.isSelected ? "#b45309" : "#14532d"}
                  strokeWidth={shape.isSelected ? 2 : 1}
                  opacity={shape.isSelected ? 0.95 : 0.78}
                />
                <polygon
                  points={polygon(shape.upper)}
                  fill={shape.isSelected ? "#fef3c7" : tone[(shape.index + 1) % tone.length]}
                  stroke={shape.isSelected ? "#b45309" : "#15803d"}
                  strokeWidth={shape.isSelected ? 2.4 : 1.2}
                  className="cursor-pointer"
                  onClick={() => { setSelectedFloorId(shape.floor.id); setSelectedUnitId(null); }}
                />
              </g>
            );
          })}

          {floorShapes.length > 0 && (
            <polygon points={polygon(roof)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} opacity={0.65} />
          )}

          {unitShapes.map((shape) => (
            <g key={shape.unit.id} onClick={() => setSelectedUnitId(shape.unit.id)} className="cursor-pointer">
              <polygon
                points={polygon(shape.corners)}
                fill={shape.selected ? "#2563eb" : "#ffffff"}
                fillOpacity={shape.selected ? 0.9 : 0.75}
                stroke={shape.selected ? "#1d4ed8" : "#3b82f6"}
                strokeWidth={shape.selected ? 2 : 1.2}
              />
              <text x={shape.center[0]} y={shape.center[1] + 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={shape.selected ? "#ffffff" : "#1e40af"}>
                {shape.unit.unit_number ?? shape.unit.name}
              </text>
            </g>
          ))}

          {utilityBox && (
            <g>
              <polygon points={polygon([utilityBox.lower[1], utilityBox.lower[2], utilityBox.upper[2], utilityBox.upper[1]])} fill="#94a3b8" stroke="#475569" strokeWidth={1} />
              <polygon points={polygon([utilityBox.lower[2], utilityBox.lower[3], utilityBox.upper[3], utilityBox.upper[2]])} fill="#64748b" stroke="#334155" strokeWidth={1} />
              <polygon points={polygon(utilityBox.upper)} fill="#cbd5e1" stroke="#475569" strokeWidth={1} />
            </g>
          )}

          {floorShapes.length === 0 && (
            <text x={VIEW_W / 2} y={VIEW_H / 2} textAnchor="middle" fontSize={13} fill="#64748b">
              No structure recorded for this parcel.
            </text>
          )}

          <g transform={`translate(${VIEW_W - 58} 40)`} opacity={0.8}>
            <circle r={17} fill="#ffffff" stroke="#e2e8f0" />
            <text y={4} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0f172a">N</text>
            <path d="M 0 -13 L 4 -4 L 0 -6 L -4 -4 Z" fill="#16a34a" />
          </g>
        </svg>

        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 bg-white/95 text-[10px]" onClick={() => setRotation((r) => (r + 1) % 4)}>
            <RotateCw className="mr-1 h-3 w-3" /> Rotate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-7 bg-white/95 text-[10px]", showUnits && "border-blue-300 text-blue-700")}
            onClick={() => setShowUnits((v) => !v)}
          >
            <Tag className="mr-1 h-3 w-3" /> Units
          </Button>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[9px] text-slate-500 shadow-sm">
          <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> 1 grid ≈ 8 m</span>
          <span className="flex items-center gap-1"><Box className="h-3 w-3" /> Click a floor top to select</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Structure</div>
            <Badge variant="outline" className="border-slate-200 text-[9px] text-slate-500">{floors.length} floors · {units.length} units</Badge>
          </div>
          <div className="mt-2 text-sm font-bold text-slate-900">{building?.name ?? "Parcel only"}</div>
          <div className="text-[11px] text-slate-500">
            Footprint {building?.area ? `${building.area.toFixed(0)} m²` : `${FOOTPRINT_W * FOOTPRINT_D} m²`} · height {building?.height ? `${building.height.toFixed(1)} m` : `${(floorCount * floorHeight).toFixed(1)} m`}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => { setSelectedFloorId(floor.id); setSelectedUnitId(null); }}
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px] font-medium transition",
                  selectedFloor?.id === floor.id ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <Layers className="mr-1 inline h-3 w-3" /> {floor.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Selected level</div>
          {selectedFloor ? (
            <div className="mt-1.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{selectedFloor.name}</span>
                <Badge variant="outline" className="border-slate-200 text-[9px] text-slate-500">Floor {selectedFloor.floor_number}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="uppercase tracking-wider text-slate-400">Floor area</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-800">{selectedFloor.area ?? building?.area ?? FOOTPRINT_W * FOOTPRINT_D} m²</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2">
                  <div className="uppercase tracking-wider text-slate-400">Height</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-800">{selectedFloor.height ?? floorHeight} m</div>
                </div>
              </div>

              <div className="space-y-1">
                {floorUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => { setSelectedUnitId(unit.id); setShowUnits(true); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[10px] transition",
                      selectedUnitId === unit.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    <span className="font-medium">{unit.unit_number} · {unit.name}</span>
                    <span>{unit.area ?? "—"} m²</span>
                  </button>
                ))}
                {!floorUnits.length && <div className="text-[10px] text-slate-400">No unit breakdown recorded for this floor.</div>}
              </div>

              {selectedUnit && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-[10px] leading-4 text-blue-900">
                  <div className="font-semibold">{selectedUnit.name} ({selectedUnit.unit_number})</div>
                  <div>Area {selectedUnit.area ?? "—"} m² · metadata {selectedUnit.metadata_json ?? "—"}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-slate-500">No floor structure is recorded for this parcel.</div>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] leading-4 text-amber-900">
          The 3D structure is a schematic reconstruction from illustrative attributes. It is not a surveyed building model and must not be used for construction, valuation or legal purposes.
        </div>
      </div>
    </div>
  );
}
