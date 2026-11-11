import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, row } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent, getFieldsForDocuments } from "@/lib/service";
import type { DocumentRow } from "@/lib/types";

export const runtime = "nodejs";

interface IncomingField {
  field_name: string;
  extracted_value: string;
  corrected_value?: string | null;
  confidence: number;
  requires_review?: boolean | number;
}

const FIELD_NAMES = [
  "owner_name",
  "survey_number",
  "subdivision_number",
  "village",
  "taluka",
  "district",
  "recorded_area",
  "land_use",
  "owner_share",
  "record_year",
  "ulpin",
];

function confidenceSummary(fields: { confidence: number }[]) {
  const values = fields.map((f) => (f.confidence > 1 ? f.confidence : f.confidence * 100));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { documentId } = await params;
  const document = row<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!document) return jsonError("Document not found.", 404);
  const fields = getFieldsForDocuments([documentId]);
  return NextResponse.json({
    document,
    fields,
    average_confidence: confidenceSummary(fields),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireApiUser(["citizen", "surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  const { documentId } = await params;
  const document = row<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!document) return jsonError("Document not found.", 404);
  let body: { fields?: IncomingField[] };
  try {
    body = await readJson<{ fields?: IncomingField[] }>(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  if (!Array.isArray(body.fields)) return jsonError("fields[] is required.");
  const db = getDb();
  db.prepare("DELETE FROM extracted_fields WHERE document_id = ?").run(documentId);
  for (const field of body.fields) {
    if (!field.field_name || !FIELD_NAMES.includes(field.field_name)) continue;
    const confidence = Math.max(0, Math.min(100, Number(field.confidence || 0)));
    const requiresReview =
      field.requires_review === true || field.requires_review === 1 || confidence < 75 ? 1 : 0;
    db.prepare(
      `INSERT INTO extracted_fields (id, document_id, field_name, extracted_value, corrected_value, confidence, requires_review)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `fld_${randomUUID()}`,
      documentId,
      field.field_name,
      String(field.extracted_value ?? ""),
      field.corrected_value ? String(field.corrected_value) : null,
      confidence,
      requiresReview
    );
  }
  db.prepare("UPDATE documents SET ocr_status = 'complete' WHERE id = ?").run(documentId);
  addAuditEvent({
    userId: auth.user.id,
    recordId: document.land_record_id,
    action: "ocr_completed",
    description: `Extraction results saved for "${document.file_name}" (${body.fields.length} fields). Low-confidence fields remain marked for manual verification.`,
    documentHash: document.sha256_hash,
  });
  const fields = getFieldsForDocuments([documentId]);
  return NextResponse.json({
    document: { ...document, ocr_status: "complete" },
    fields,
    average_confidence: confidenceSummary(fields),
  });
}
