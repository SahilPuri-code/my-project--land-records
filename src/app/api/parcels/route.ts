import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { all, getDb } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { overlapRatio, polygonAreaM2, toRing } from "@/lib/geo";
import { addAuditEvent } from "@/lib/service";
import type { ParcelGeometryRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const geometries = all<ParcelGeometryRow>(
    "SELECT * FROM parcel_geometries WHERE survey_epoch = 'current' ORDER BY rowid"
  );
  const features = geometries
    .map((g) => {
      let geometry;
      try {
        geometry = JSON.parse(g.geometry_geojson);
      } catch {
        return null;
      }
      const overlaps: string[] = [];
      const ring = toRing(g.geometry_geojson);
      if (ring) {
        for (const other of geometries) {
          if (other.id === g.id) continue;
          const otherRing = toRing(other.geometry_geojson);
          if (!otherRing) continue;
          if (overlapRatio(ring, otherRing) > 0.02) {
            overlaps.push(other.survey_number || other.label || other.id);
          }
        }
      }
      return {
        type: "Feature" as const,
        geometry,
        properties: {
          id: g.id,
          land_record_id: g.land_record_id,
          survey_number: g.survey_number,
          ulpin: g.ulpin,
          label: g.label,
          area: g.calculated_area,
          land_use: g.land_use,
          trust_score: g.trust_score,
          status: g.status,
          overlaps,
          source: g.geometry_source,
        },
      };
    })
    .filter(Boolean);
  return NextResponse.json({
    type: "FeatureCollection",
    features,
    demo_notice: "Illustrative parcels generated for the BHŪMI 3D prototype. Not surveyed cadastral boundaries.",
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  let body: { geometry?: { type: string; coordinates: number[][][] }; survey_number?: string; label?: string };
  try {
    body = await readJson(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  const ring = body.geometry?.coordinates?.[0];
  if (!body.geometry || body.geometry.type !== "Polygon" || !ring || ring.length < 3) {
    return jsonError("A valid GeoJSON Polygon with at least three vertices is required.");
  }
  const area = polygonAreaM2(ring as [number, number][]);
  const id = `geom_${randomUUID()}`;
  getDb()
    .prepare(
      `INSERT INTO parcel_geometries
        (id, land_record_id, geometry_geojson, calculated_area, geometry_source, survey_epoch, created_at, label, survey_number, ulpin, land_use, trust_score, status)
       VALUES (?, NULL, ?, ?, 'User-drawn demo polygon', 'current', ?, ?, ?, NULL, 'Unspecified (demo)', NULL, 'demo_unverified')`
    )
    .run(
      id,
      JSON.stringify(body.geometry),
      Math.round(area),
      new Date().toISOString(),
      body.label || "User-drawn demo polygon",
      body.survey_number || "DEMO"
    );
  addAuditEvent({
    userId: auth.user.id,
    recordId: null,
    action: "demo_polygon_created",
    description: `User-drawn demo polygon ${body.survey_number || "DEMO"} created (${Math.round(area)} m²). Not a legally surveyed boundary.`,
  });
  return NextResponse.json({ id, area: Math.round(area) }, { status: 201 });
}
