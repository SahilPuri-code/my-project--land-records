export type Role = "citizen" | "surveyor" | "officer" | "admin";

export type RecordStatus =
  | "digitized"
  | "needs_officer_review"
  | "eligible_auto_verification"
  | "escalate_resurvey"
  | "verified"
  | "rejected"
  | "correction_requested";

export type Severity = "low" | "medium" | "high" | "critical";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: number;
  created_at: string;
}

export interface OwnerShare {
  name: string;
  share: number;
}

export interface GroundEvidence {
  source: string;
  captured: string;
  built_up_fraction: number;
  epochs: string[];
  notes: string;
}

export interface LandRecord {
  id: string;
  ulpin: string;
  survey_number: string;
  subdivision_number: string;
  owner_name: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  recorded_area: number;
  mapped_area: number;
  area_unit: string;
  land_use: string;
  owner_share: number;
  owner_shares_json: string;
  record_year: number;
  status: RecordStatus;
  trust_score: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ground_evidence_json: string | null;
  subdivisions_json: string | null;
  notes: string | null;
}

export interface DocumentRow {
  id: string;
  land_record_id: string;
  file_name: string;
  file_type: string;
  document_category: string;
  file_path: string;
  sha256_hash: string;
  uploaded_by: string | null;
  uploaded_at: string;
  ocr_status: "pending" | "processing" | "complete" | "failed" | "manual";
  size_bytes: number;
}

export interface ExtractedField {
  id: string;
  document_id: string;
  field_name: string;
  extracted_value: string;
  corrected_value: string | null;
  confidence: number;
  requires_review: number;
}

export interface ParcelGeometryRow {
  id: string;
  land_record_id: string | null;
  geometry_geojson: string;
  calculated_area: number;
  geometry_source: string;
  survey_epoch: string;
  created_at: string;
  label: string | null;
  survey_number: string | null;
  ulpin: string | null;
  land_use: string | null;
  trust_score: number | null;
  status: string | null;
}

export interface ValidationIssue {
  id?: string;
  land_record_id?: string;
  rule_code: string;
  severity: Severity;
  title: string;
  description: string;
  evidence: string;
  affected_field: string;
  recommended_action: string;
  status?: string;
  created_at?: string;
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  score: number;
  weighted: number;
  deductions: { reason: string; points: number; detail: string }[];
}

export interface TrustScoreExplanation {
  components: ScoreComponent[];
  final_score: number;
  routing_status: RecordStatus;
  provisional: boolean;
  summary: string;
  missing_evidence: string[];
  calculated_at: string;
}

export interface TrustScoreRow {
  id: string;
  land_record_id: string;
  text_integrity: number;
  text_map_consistency: number;
  ground_truth_match: number;
  change_audit_history: number;
  final_score: number;
  routing_status: RecordStatus;
  explanation_json: string;
  calculated_at: string;
}

export interface ReviewRow {
  id: string;
  land_record_id: string;
  officer_id: string;
  decision: string;
  comments: string;
  reviewed_at: string;
}

export interface ReceiptRow {
  id: string;
  land_record_id: string;
  receipt_no: string;
  snapshot_hash: string;
  snapshot_json: string;
  issued_by: string;
  issued_at: string;
}

export interface AuditEvent {
  id: string;
  user_id: string | null;
  land_record_id: string | null;
  action: string;
  description: string;
  document_hash: string | null;
  created_at: string;
}

export interface PropertyStructureRow {
  id: string;
  land_record_id: string;
  parent_id: string | null;
  structure_type: "parcel" | "building" | "floor" | "unit" | "utility";
  name: string;
  floor_number: number | null;
  unit_number: string | null;
  height: number | null;
  area: number | null;
  metadata_json: string | null;
}

export interface PropertyHistoryRow {
  id: string;
  land_record_id: string;
  year: number;
  description: string;
  geometry_geojson: string;
  building_metadata_json: string;
  evidence_description: string;
  review_status: string;
}

export interface Settings {
  weights: {
    text_integrity: number;
    text_map_consistency: number;
    ground_truth_match: number;
    change_audit_history: number;
  };
  thresholds: {
    area_mismatch_pct: number;
    ocr_confidence: number;
    auto_verify: number;
    officer_review: number;
  };
  demo_mode: boolean;
}

export interface SessionUser extends User {}
