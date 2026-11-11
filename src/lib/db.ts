import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedDatabase } from "./seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS land_records (
  id TEXT PRIMARY KEY,
  ulpin TEXT NOT NULL,
  survey_number TEXT NOT NULL,
  subdivision_number TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  village TEXT NOT NULL,
  taluka TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  recorded_area REAL NOT NULL,
  mapped_area REAL NOT NULL,
  area_unit TEXT NOT NULL DEFAULT 'm2',
  land_use TEXT NOT NULL,
  owner_share REAL NOT NULL DEFAULT 1,
  owner_shares_json TEXT NOT NULL DEFAULT '[]',
  record_year INTEGER NOT NULL,
  status TEXT NOT NULL,
  trust_score REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ground_evidence_json TEXT,
  subdivisions_json TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_records_survey ON land_records(survey_number);
CREATE INDEX IF NOT EXISTS idx_records_status ON land_records(status);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  document_category TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL,
  ocr_status TEXT NOT NULL DEFAULT 'pending',
  size_bytes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_documents_record ON documents(land_record_id);

CREATE TABLE IF NOT EXISTS extracted_fields (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  extracted_value TEXT NOT NULL,
  corrected_value TEXT,
  confidence REAL NOT NULL,
  requires_review INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_fields_document ON extracted_fields(document_id);

CREATE TABLE IF NOT EXISTS parcel_geometries (
  id TEXT PRIMARY KEY,
  land_record_id TEXT,
  geometry_geojson TEXT NOT NULL,
  calculated_area REAL NOT NULL,
  geometry_source TEXT NOT NULL,
  survey_epoch TEXT NOT NULL,
  created_at TEXT NOT NULL,
  label TEXT,
  survey_number TEXT,
  ulpin TEXT,
  land_use TEXT,
  trust_score REAL,
  status TEXT
);
CREATE INDEX IF NOT EXISTS idx_geometry_record ON parcel_geometries(land_record_id);

CREATE TABLE IF NOT EXISTS validation_results (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT NOT NULL,
  affected_field TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_validation_record ON validation_results(land_record_id);

CREATE TABLE IF NOT EXISTS trust_scores (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  text_integrity REAL NOT NULL,
  text_map_consistency REAL NOT NULL,
  ground_truth_match REAL NOT NULL,
  change_audit_history REAL NOT NULL,
  final_score REAL NOT NULL,
  routing_status TEXT NOT NULL,
  explanation_json TEXT NOT NULL,
  calculated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_record ON trust_scores(land_record_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  comments TEXT NOT NULL,
  reviewed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  receipt_no TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  land_record_id TEXT,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  document_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_events(land_record_id);

CREATE TABLE IF NOT EXISTS property_structure (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  parent_id TEXT,
  structure_type TEXT NOT NULL,
  name TEXT NOT NULL,
  floor_number INTEGER,
  unit_number TEXT,
  height REAL,
  area REAL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_structure_record ON property_structure(land_record_id);

CREATE TABLE IF NOT EXISTS property_history (
  id TEXT PRIMARY KEY,
  land_record_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  description TEXT NOT NULL,
  geometry_geojson TEXT NOT NULL,
  building_metadata_json TEXT NOT NULL,
  evidence_description TEXT NOT NULL,
  review_status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_record ON property_history(land_record_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

type GlobalWithDb = typeof globalThis & {
  __bhumiDb?: DatabaseSync;
};

export function getDb(): DatabaseSync {
  const g = globalThis as GlobalWithDb;
  if (g.__bhumiDb) return g.__bhumiDb;
  const dir = path.join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "bhumi.sqlite"));
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (!count || count.count === 0) {
    seedDatabase(db);
  }
  g.__bhumiDb = db;
  return db;
}

export function all<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

export function row<T>(sql: string, ...params: unknown[]): T | null {
  const result = getDb().prepare(sql).get(...params) as T | undefined;
  return result ?? null;
}

export function run(sql: string, ...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
  return getDb().prepare(sql).run(...params) as { changes: number | bigint; lastInsertRowid: number | bigint };
}

export function jsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function resetDemoData(): void {
  const db = getDb();
  const tables = [
    "sessions",
    "extracted_fields",
    "documents",
    "validation_results",
    "trust_scores",
    "reviews",
    "receipts",
    "audit_events",
    "property_structure",
    "property_history",
    "parcel_geometries",
    "land_records",
    "users",
    "settings",
  ];
  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`);
  }
  seedDatabase(db);
}

export function getSettings() {
  const settingsRow = row<{ value: string }>("SELECT value FROM settings WHERE key = 'config'");
  const fallback = {
    weights: {
      text_integrity: 30,
      text_map_consistency: 30,
      ground_truth_match: 25,
      change_audit_history: 15,
    },
    thresholds: {
      area_mismatch_pct: 3,
      ocr_confidence: 75,
      auto_verify: 90,
      officer_review: 60,
    },
    demo_mode: true,
  };
  return settingsRow ? { ...fallback, ...jsonParse(settingsRow.value, fallback) } : fallback;
}

export function saveSettings(settings: unknown): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(JSON.stringify(settings));
}
