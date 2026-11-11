import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent, getRecord, getReceipt, snapshotForRecord } from "@/lib/service";

export const runtime = "nodejs";

const ACTIONS = new Set(["approve", "reject", "request-correction", "escalate"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordId: string; action: string }> }
) {
  const auth = await requireApiUser(["officer", "admin"]);
  if ("error" in auth) return auth.error;
  const { recordId, action } = await params;
  if (!ACTIONS.has(action)) return jsonError("Unknown review action.", 404);
  const record = getRecord(recordId);
  if (!record) return jsonError("Record not found.", 404);

  let body: { comments?: string } = {};
  try {
    body = await readJson<{ comments?: string }>(request);
  } catch {
    body = {};
  }
  const comments = (body.comments || "").trim();
  if ((action === "reject" || action === "request-correction") && !comments) {
    return jsonError("A review comment is required when rejecting or requesting correction.");
  }
  if (action === "approve" && record.status === "verified") {
    return jsonError("This prototype record has already been verified.");
  }

  const db = getDb();
  const stamp = new Date().toISOString();
  const decision =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : action === "request-correction"
          ? "correction_requested"
          : "escalated";
  const newStatus =
    action === "approve"
      ? "verified"
      : action === "reject"
        ? "rejected"
        : action === "request-correction"
          ? "correction_requested"
          : "escalate_resurvey";

  db.prepare(
    "INSERT INTO reviews (id, land_record_id, officer_id, decision, comments, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(`rev_${randomUUID()}`, recordId, auth.user.id, decision, comments || "No comment supplied.", stamp);

  db.prepare("UPDATE land_records SET status = ?, updated_at = ? WHERE id = ?").run(newStatus, stamp, recordId);

  let receipt: { receipt_no: string; snapshot_hash: string; snapshot_json: string } | null = null;
  if (action === "approve") {
    const snapshot = snapshotForRecord(recordId);
    const receiptNo = `BHUMI-PROTO-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 900000) + 100000
    )}`;
    db.prepare(
      "INSERT INTO receipts (id, land_record_id, receipt_no, snapshot_hash, snapshot_json, issued_by, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(`rcpt_${randomUUID()}`, recordId, receiptNo, snapshot.hash, snapshot.json, auth.user.id, stamp);
    receipt = { receipt_no: receiptNo, snapshot_hash: snapshot.hash, snapshot_json: snapshot.json };
    addAuditEvent({
      userId: auth.user.id,
      recordId,
      action: "verification_receipt_generated",
      description: `Prototype verification receipt ${receiptNo} generated with SHA-256 snapshot ${snapshot.hash.slice(0, 16)}… This is not a government-issued certificate.`,
      documentHash: snapshot.hash,
    });
  }

  const actionLabel =
    action === "approve"
      ? "record_approved"
      : action === "reject"
        ? "record_rejected"
        : action === "request-correction"
          ? "correction_requested"
          : "escalated_for_resurvey";
  addAuditEvent({
    userId: auth.user.id,
    recordId,
    action: actionLabel,
    description: `${auth.user.full_name} (${auth.user.role}) recorded decision "${decision}" for ${record.survey_number}/${record.subdivision_number}. Comment: ${comments || "—"}`,
  });

  return NextResponse.json({
    ok: true,
    decision,
    status: newStatus,
    receipt,
    existing_receipt: getReceipt(recordId),
  });
}
