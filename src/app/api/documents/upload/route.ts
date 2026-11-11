import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/http";
import { addAuditEvent, getRecord } from "@/lib/service";

export const runtime = "nodejs";

const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
]);
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireApiUser(["citizen", "surveyor", "officer", "admin"]);
  if ("error" in auth) return auth.error;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected a multipart form upload.");
  }
  const file = form.get("file");
  const recordId = String(form.get("land_record_id") || "");
  const category = String(form.get("document_category") || "supporting");
  if (!(file instanceof File)) return jsonError("A document file is required.");
  if (!recordId) return jsonError("Select a land record to attach this document to.");
  const record = getRecord(recordId);
  if (!record) return jsonError("Land record not found.", 404);
  if (file.size > MAX_SIZE) return jsonError("File is larger than the 10 MB limit.", 413);
  const ext = ALLOWED.get(file.type);
  if (!ext) return jsonError("Unsupported file type. Upload PDF, JPG or PNG.", 415);

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  const safeName = `${randomUUID()}.${ext}`;
  writeFileSync(path.join(uploadDir, safeName), buffer);

  const id = `doc_${randomUUID()}`;
  const stamp = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO documents (id, land_record_id, file_name, file_type, document_category, file_path, sha256_hash, uploaded_by, uploaded_at, ocr_status, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      id,
      recordId,
      file.name,
      file.type,
      category,
      `/uploads/${safeName}`,
      hash,
      auth.user.id,
      stamp,
      file.size
    );
  addAuditEvent({
    userId: auth.user.id,
    recordId,
    action: "document_uploaded",
    description: `Document "${file.name}" uploaded as ${category.replaceAll("_", " ")} for ${record.survey_number}/${record.subdivision_number}. SHA-256 recorded.`,
    documentHash: hash,
  });
  return NextResponse.json(
    {
      document: {
        id,
        land_record_id: recordId,
        file_name: file.name,
        file_type: file.type,
        document_category: category,
        file_path: `/uploads/${safeName}`,
        sha256_hash: hash,
        uploaded_by: auth.user.id,
        uploaded_at: stamp,
        ocr_status: "pending",
        size_bytes: file.size,
      },
      message: "Document stored and SHA-256 hashed. Run OCR or enter fields manually.",
    },
    { status: 201 }
  );
}
