import { all } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import type { ParcelGeometryRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const geometries = all<ParcelGeometryRow>(
    "SELECT * FROM parcel_geometries WHERE survey_epoch = 'current' ORDER BY rowid"
  );
  const features = geometries.flatMap((g) => {
    try {
      return [
        {
          type: "Feature",
          geometry: JSON.parse(g.geometry_geojson),
          properties: {
            id: g.id,
            land_record_id: g.land_record_id,
            survey_number: g.survey_number,
            ulpin: g.ulpin,
            label: g.label,
            area_m2: g.calculated_area,
            land_use: g.land_use,
            trust_score: g.trust_score,
            status: g.status,
            source: g.geometry_source,
          },
        },
      ];
    } catch {
      return [];
    }
  });
  const collection = {
    type: "FeatureCollection",
    name: "bhumi-3d-demo-parcels",
    features,
    disclaimer:
      "Illustrative demo parcel geometry for the BHUMI 3D prototype. Not a legally surveyed cadastral boundary.",
  };
  return new Response(JSON.stringify(collection, null, 2), {
    headers: {
      "Content-Type": "application/geo+json",
      "Content-Disposition": `attachment; filename="bhumi-3d-parcels.geojson"`,
      "Cache-Control": "private, no-store",
    },
  });
}
