import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { all, getDb } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent, runValidation } from "@/lib/service";
import type { LandRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const params = url.searchParams;
  const clauses: string[] = [];
  const values: unknown[] = [];

  const q = params.get("q")?.trim();
  if (q) {
    clauses.push("(survey_number LIKE ? OR ulpin LIKE ? OR owner_name LIKE ?)");
    values.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const village = params.get("village");
  if (village) {
    clauses.push("village = ?");
    values.push(village);
  }
  const district = params.get("district");
  if (district) {
    clauses.push("district = ?");
    values.push(district);
  }
  const status = params.get("status");
  if (status) {
    clauses.push("status = ?");
    values.push(status);
  }
  const minScore = params.get("min_score");
  if (minScore) {
    clauses.push("trust_score >= ?");
    values.push(Number(minScore));
  }
  const maxScore = params.get("max_score");
  if (maxScore) {
    clauses.push("trust_score <= ?");
    values.push(Number(maxScore));
  }
  const from = params.get("from");
  if (from) {
    clauses.push("created_at >= ?");
    values.push(from);
  }
  const to = params.get("to");
  if (to) {
    clauses.push("created_at <= ?");
    values.push(`${to}T23:59:59.999Z`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const records = all<LandRecord & { flag_count: number; document_count: number }>(
    `SELECT lr.*,
       (SELECT COUNT(*) FROM validation_results vr WHERE vr.land_record_id = lr.id) AS flag_count,
       (SELECT COUNT(*) FROM documents d WHERE d.land_record_id = lr.id) AS document_count
     FROM land_records lr ${where}
     ORDER BY lr.updated_at DESC`,
    ...values
  );
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["citizen", "surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await readJson<Record<string, unknown>>(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  const survey = String(body.survey_number || "").trim();
  const subdivision = String(body.subdivision_number || "").trim();
  const owner = String(body.owner_name || "").trim();
  const village = String(body.village || "Parbhani").trim();
  const recordedArea = Number(body.recorded_area || 0);
  if (!survey || !subdivision || !owner || !recordedArea) {
    return jsonError("Survey number, subdivision, owner name and recorded area are required.");
  }
  const id = `rec_${randomUUID()}`;
  const stamp = new Date().toISOString();
  const ulpin =
    String(body.ulpin || "").trim() ||
    `MH-PBN-2026-${survey.padStart(4, "0")}-${subdivision.padStart(4, "0")}-${String(
      Math.floor(Math.random() * 9000) + 1000
    )}`;
  const ownerShare = Number(body.owner_share ?? 1);
  const shares = body.owner_shares
    ? JSON.stringify(body.owner_shares)
    : JSON.stringify([{ name: owner, share: ownerShare }]);
  getDb()
    .prepare(
      `INSERT INTO land_records
        (id, ulpin, survey_number, subdivision_number, owner_name, village, taluka, district, state,
         recorded_area, mapped_area, area_unit, land_use, owner_share, owner_shares_json, record_year,
         status, trust_score, created_by, created_at, updated_at, ground_evidence_json, subdivisions_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'm2', ?, ?, ?, ?, 'digitized', 0, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      ulpin,
      survey,
      subdivision,
      owner,
      village,
      String(body.taluka || "Parbhani"),
      String(body.district || "Parbhani"),
      String(body.state || "Maharashtra"),
      recordedArea,
      Number(body.mapped_area || 0),
      String(body.land_use || "Agricultural"),
      ownerShare,
      shares,
      Number(body.record_year || new Date().getFullYear()),
      auth.user.id,
      stamp,
      stamp,
      body.ground_evidence ? JSON.stringify(body.ground_evidence) : null,
      body.subdivisions ? JSON.stringify(body.subdivisions) : null,
      String(body.notes || "Record created in the BHŪMI 3D prototype.")
    );
  addAuditEvent({
    userId: auth.user.id,
    recordId: id,
    action: "record_created",
    description: `Land record ${survey}/${subdivision} created for ${village}.`,
  });
  const result = runValidation(id, auth.user.id);
  return NextResponse.json({ record: result?.record ?? null, id }, { status: 201 });
}
