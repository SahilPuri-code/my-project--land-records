import { createHash, randomUUID } from "node:crypto";
import { all, getDb, getSettings, jsonParse, row } from "./db";
import { computeTrustScore } from "./scoring";
import type {
  AuditEvent,
  DocumentRow,
  ExtractedField,
  LandRecord,
  ParcelGeometryRow,
  PropertyHistoryRow,
  PropertyStructureRow,
  ReceiptRow,
  ReviewRow,
  TrustScoreExplanation,
  TrustScoreRow,
  ValidationIssue,
} from "./types";
import { evaluateValidation } from "./validation";

export function addAuditEvent(input: {
  userId: string | null;
  recordId: string | null;
  action: string;
  description: string;
  documentHash?: string | null;
}): void {
  getDb()
    .prepare(
      "INSERT INTO audit_events (id, user_id, land_record_id, action, description, document_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      `aud_${randomUUID()}`,
      input.userId,
      input.recordId,
      input.action,
      input.description,
      input.documentHash ?? null,
      new Date().toISOString()
    );
}

export function getRecord(recordId: string): LandRecord | null {
  return row<LandRecord>("SELECT * FROM land_records WHERE id = ?", recordId);
}

export function getDocuments(recordId: string): DocumentRow[] {
  return all<DocumentRow>(
    "SELECT * FROM documents WHERE land_record_id = ? ORDER BY uploaded_at DESC",
    recordId
  );
}

export function getFieldsForDocuments(documentIds: string[]): ExtractedField[] {
  if (!documentIds.length) return [];
  const placeholders = documentIds.map(() => "?").join(",");
  return all<ExtractedField>(
    `SELECT * FROM extracted_fields WHERE document_id IN (${placeholders}) ORDER BY rowid`,
    ...documentIds
  );
}

export function getFieldsForRecord(recordId: string): ExtractedField[] {
  return all<ExtractedField>(
    `SELECT f.* FROM extracted_fields f JOIN documents d ON d.id = f.document_id WHERE d.land_record_id = ? ORDER BY f.rowid`,
    recordId
  );
}

export function getGeometries(recordId: string): ParcelGeometryRow[] {
  return all<ParcelGeometryRow>(
    "SELECT * FROM parcel_geometries WHERE land_record_id = ? ORDER BY survey_epoch, created_at",
    recordId
  );
}

export function getAllCurrentGeometries(): ParcelGeometryRow[] {
  return all<ParcelGeometryRow>(
    "SELECT * FROM parcel_geometries WHERE survey_epoch = 'current' ORDER BY rowid"
  );
}

export function getValidation(recordId: string): ValidationIssue[] {
  return all<ValidationIssue>(
    "SELECT * FROM validation_results WHERE land_record_id = ? ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at",
    recordId
  );
}

export function getTrustScore(recordId: string): TrustScoreRow | null {
  return row<TrustScoreRow>(
    "SELECT * FROM trust_scores WHERE land_record_id = ? ORDER BY calculated_at DESC LIMIT 1",
    recordId
  );
}

export function getHistory(recordId: string): PropertyHistoryRow[] {
  return all<PropertyHistoryRow>(
    "SELECT * FROM property_history WHERE land_record_id = ? ORDER BY year",
    recordId
  );
}

export function getStructure(recordId: string): PropertyStructureRow[] {
  return all<PropertyStructureRow>(
    "SELECT * FROM property_structure WHERE land_record_id = ? ORDER BY rowid",
    recordId
  );
}

export function getAudit(recordId: string) {
  return all<AuditEvent & { user_name: string | null; user_role: string | null }>(
    `SELECT a.*, u.full_name AS user_name, u.role AS user_role
     FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.land_record_id = ? ORDER BY a.created_at DESC`,
    recordId
  );
}

export function getReviews(recordId: string) {
  return all<ReviewRow & { officer_name: string }>(
    `SELECT r.*, u.full_name AS officer_name FROM reviews r LEFT JOIN users u ON u.id = r.officer_id
     WHERE r.land_record_id = ? ORDER BY r.reviewed_at DESC`,
    recordId
  );
}

export function getReceipt(recordId: string): ReceiptRow | null {
  return row<ReceiptRow>(
    "SELECT * FROM receipts WHERE land_record_id = ? ORDER BY issued_at DESC LIMIT 1",
    recordId
  );
}

export function getRecordBundle(recordId: string) {
  const record = getRecord(recordId);
  if (!record) return null;
  const documents = getDocuments(recordId);
  const fields = getFieldsForRecord(recordId);
  const geometries = getGeometries(recordId);
  const issues = getValidation(recordId);
  const trust = getTrustScore(recordId);
  const history = getHistory(recordId);
  const structure = getStructure(recordId);
  const audit = getAudit(recordId);
  const reviews = getReviews(recordId);
  const receipt = getReceipt(recordId);
  const owners = jsonParse<{ name: string; share: number }[]>(record.owner_shares_json, []);
  return {
    record,
    owners,
    documents,
    fields,
    geometries,
    issues,
    trust,
    explanation: trust ? jsonParse<TrustScoreExplanation | null>(trust.explanation_json, null) : null,
    history,
    structure,
    audit,
    reviews,
    receipt,
  };
}

export function runValidation(recordId: string, userId: string | null) {
  const record = getRecord(recordId);
  if (!record) return null;
  const settings = getSettings();
  const documents = getDocuments(recordId);
  const fields = getFieldsForRecord(recordId);
  const recordGeometries = getGeometries(recordId);
  const allRecords = all<LandRecord>("SELECT * FROM land_records");
  const allGeometries = getAllCurrentGeometries();
  const history = getHistory(recordId);

  const issues = evaluateValidation({
    record,
    allRecords,
    geometries: allGeometries,
    recordGeometries,
    documents,
    fields,
    history,
    settings,
  });

  const db = getDb();
  db.prepare("DELETE FROM validation_results WHERE land_record_id = ?").run(recordId);
  const stamp = new Date().toISOString();
  for (const issue of issues) {
    db.prepare(
      `INSERT INTO validation_results (id, land_record_id, rule_code, severity, title, description, evidence, affected_field, recommended_action, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      `val_${randomUUID()}`,
      recordId,
      issue.rule_code,
      issue.severity,
      issue.title,
      issue.description,
      issue.evidence,
      issue.affected_field,
      issue.recommended_action,
      stamp
    );
  }

  addAuditEvent({
    userId,
    recordId,
    action: "validation_run",
    description: `Three-way validation executed for ${record.survey_number}/${record.subdivision_number} · ${issues.length} issue(s) found.`,
  });

  const explanation = computeTrustScore({
    record,
    issues,
    documents,
    fields,
    history,
    audit: getAudit(recordId),
    settings,
    calculatedAt: stamp,
  });

  db.prepare("DELETE FROM trust_scores WHERE land_record_id = ?").run(recordId);
  db.prepare(
    `INSERT INTO trust_scores (id, land_record_id, text_integrity, text_map_consistency, ground_truth_match, change_audit_history, final_score, routing_status, explanation_json, calculated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `score_${randomUUID()}`,
    recordId,
    explanation.componentScores.text_integrity,
    explanation.componentScores.text_map_consistency,
    explanation.componentScores.ground_truth_match,
    explanation.componentScores.change_audit_history,
    explanation.final_score,
    explanation.routing_status,
    JSON.stringify(explanation),
    stamp
  );

  const preserve = record.status === "verified" || record.status === "rejected";
  const status = preserve ? record.status : explanation.routing_status;
  db.prepare("UPDATE land_records SET trust_score = ?, status = ?, updated_at = ? WHERE id = ?").run(
    explanation.final_score,
    status,
    stamp,
    recordId
  );
  db.prepare("UPDATE parcel_geometries SET trust_score = ?, status = ? WHERE land_record_id = ?").run(
    explanation.final_score,
    status,
    recordId
  );

  addAuditEvent({
    userId,
    recordId,
    action: "trust_score_calculated",
    description: `Parcel Trust Score recalculated: ${explanation.final_score}/100 (${explanation.routing_status.replaceAll("_", " ")}).`,
  });

  return {
    record: getRecord(recordId),
    issues,
    trust: getTrustScore(recordId),
    explanation,
  };
}

export function snapshotForRecord(recordId: string): { json: string; hash: string } {
  const bundle = getRecordBundle(recordId);
  if (!bundle) throw new Error("Record not found");
  const snapshot = {
    ulpin: bundle.record.ulpin,
    survey_number: `${bundle.record.survey_number}/${bundle.record.subdivision_number}`,
    owner: bundle.record.owner_name,
    owners: bundle.owners,
    village: bundle.record.village,
    district: bundle.record.district,
    area: bundle.record.recorded_area,
    mapped_area: bundle.record.mapped_area,
    land_use: bundle.record.land_use,
    trust_score: bundle.record.trust_score,
    status: bundle.record.status,
    validation_issues: bundle.issues.map((i) => i.rule_code),
    documents: bundle.documents.map((d) => ({ name: d.file_name, hash: d.sha256_hash })),
    snapshot_at: new Date().toISOString(),
    disclaimer:
      "Prototype verification receipt generated from illustrative demo data. Not a government-issued legal certificate.",
  };
  const json = JSON.stringify(snapshot);
  return { json, hash: createHash("sha256").update(json).digest("hex") };
}
