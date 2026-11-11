import { all } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import type { LandRecord } from "@/lib/types";

export const runtime = "nodejs";

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const status = new URL(request.url).searchParams.get("status");
  const records = status
    ? all<LandRecord>("SELECT * FROM land_records WHERE status = ? ORDER BY survey_number", status)
    : all<LandRecord>("SELECT * FROM land_records ORDER BY survey_number");
  const headers = [
    "ulpin",
    "survey_number",
    "subdivision_number",
    "owner_name",
    "village",
    "taluka",
    "district",
    "recorded_area_m2",
    "mapped_area_m2",
    "land_use",
    "record_year",
    "status",
    "trust_score",
    "updated_at",
  ];
  const lines = [headers.map(cell).join(",")];
  for (const r of records) {
    lines.push(
      [
        r.ulpin,
        r.survey_number,
        r.subdivision_number,
        r.owner_name,
        r.village,
        r.taluka,
        r.district,
        r.recorded_area,
        r.mapped_area,
        r.land_use,
        r.record_year,
        r.status,
        r.trust_score,
        r.updated_at,
      ]
        .map(cell)
        .join(",")
    );
  }
  lines.push("");
  lines.push(cell("DISCLAIMER: Illustrative BHUMI 3D hackathon demo data. Not an official land record export."));
  const csv = `\uFEFF${lines.join("\r\n")}`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bhumi-3d-records-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
