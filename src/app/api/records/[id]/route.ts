import { NextResponse } from "next/server";
import { getDb, jsonParse } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent, getRecord, getRecordBundle, runValidation } from "@/lib/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const bundle = getRecordBundle(id);
  if (!bundle) return jsonError("Record not found.", 404);
  return NextResponse.json(bundle);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(["surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const record = getRecord(id);
  if (!record) return jsonError("Record not found.", 404);
  let body: Record<string, unknown>;
  try {
    body = await readJson<Record<string, unknown>>(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  const allowed = [
    "owner_name",
    "village",
    "taluka",
    "district",
    "state",
    "recorded_area",
    "mapped_area",
    "land_use",
    "owner_share",
    "record_year",
    "notes",
    "ulpin",
    "survey_number",
    "subdivision_number",
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (body.owner_shares !== undefined) {
    updates.push("owner_shares_json = ?");
    values.push(JSON.stringify(body.owner_shares));
  }
  if (body.ground_evidence !== undefined) {
    updates.push("ground_evidence_json = ?");
    values.push(body.ground_evidence ? JSON.stringify(body.ground_evidence) : null);
  }
  if (body.subdivisions !== undefined) {
    updates.push("subdivisions_json = ?");
    values.push(body.subdivisions ? JSON.stringify(body.subdivisions) : null);
  }
  if (!updates.length) return jsonError("No editable fields supplied.");
  updates.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE land_records SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  addAuditEvent({
    userId: auth.user.id,
    recordId: id,
    action: "record_edited",
    description: `Record ${record.survey_number}/${record.subdivision_number} updated: ${Object.keys(body)
      .filter((k) => k !== "notes")
      .join(", ")}.`,
  });
  if (body.rerun_validation !== false) runValidation(id, auth.user.id);
  return NextResponse.json(getRecordBundle(id));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const record = getRecord(id);
  if (!record) return jsonError("Record not found.", 404);
  const db = getDb();
  const docs = db.prepare("SELECT id FROM documents WHERE land_record_id = ?").all(id) as { id: string }[];
  for (const doc of docs) {
    db.prepare("DELETE FROM extracted_fields WHERE document_id = ?").run(doc.id);
  }
  for (const table of [
    "documents",
    "validation_results",
    "trust_scores",
    "reviews",
    "receipts",
    "property_structure",
    "property_history",
    "parcel_geometries",
  ]) {
    db.prepare(`DELETE FROM ${table} WHERE land_record_id = ?`).run(id);
  }
  db.prepare("DELETE FROM land_records WHERE id = ?").run(id);
  addAuditEvent({
    userId: auth.user.id,
    recordId: null,
    action: "record_deleted",
    description: `Record ${record.survey_number}/${record.subdivision_number} (${record.ulpin}) deleted by administrator.`,
  });
  return NextResponse.json({ ok: true });
}
