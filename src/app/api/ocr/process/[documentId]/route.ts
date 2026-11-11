import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/http";
import { addAuditEvent, getFieldsForDocuments } from "@/lib/service";
import type { DocumentRow, ExtractedField } from "@/lib/types";

export const runtime = "nodejs";

function confidenceSummary(fields: ExtractedField[]) {
  const values = fields.map((f) => (f.confidence > 1 ? f.confidence : f.confidence * 100));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const auth = await requireApiUser(["citizen", "surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  const { documentId } = await params;
  const document = row<DocumentRow>("SELECT * FROM documents WHERE id = ?", documentId);
  if (!document) return jsonError("Document not found.", 404);
  const existing = getFieldsForDocuments([documentId]);

  if (document.file_path.startsWith("/samples/") && existing.length) {
    addAuditEvent({
      userId: auth.user.id,
      recordId: document.land_record_id,
      action: "ocr_completed",
      description: `Pre-authored sample extraction loaded for "${document.file_name}". This is illustrative demo data, not live OCR.`,
      documentHash: document.sha256_hash,
    });
    return NextResponse.json({
      mode: "sample",
      message:
        "Pre-authored sample extraction loaded. These values are illustrative demo data and are not live OCR output from a government document.",
      fields: existing,
      average_confidence: confidenceSummary(existing),
      document,
    });
  }

  if (existing.length) {
    return NextResponse.json({
      mode: "stored",
      message: "Stored extraction results are available.",
      fields: existing,
      average_confidence: confidenceSummary(existing),
      document,
    });
  }

  return NextResponse.json({
    mode: "client",
    message:
      "Run OCR in the browser with Tesseract.js. If the engine or language data cannot load, enter the fields manually — the workflow will not block.",
    fields: [],
    average_confidence: 0,
    document,
  });
}
