import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./password";
import { computeTrustScore } from "./scoring";
import { evaluateValidation } from "./validation";
import type {
  AuditEvent,
  DocumentRow,
  ExtractedField,
  LandRecord,
  ParcelGeometryRow,
  PropertyHistoryRow,
  Settings,
  ValidationIssue,
} from "./types";

const now = () => new Date();
const daysAgo = (days: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

const settings: Settings = {
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

const users = [
  { id: "usr_citizen", full_name: "Demo Citizen", email: "citizen@bhumidemo.in", role: "citizen" },
  { id: "usr_surveyor", full_name: "Demo Surveyor", email: "surveyor@bhumidemo.in", role: "surveyor" },
  { id: "usr_officer", full_name: "Demo Revenue Officer", email: "officer@bhumidemo.in", role: "officer" },
  { id: "usr_admin", full_name: "Demo Administrator", email: "admin@bhumidemo.in", role: "admin" },
];

const polygons = {
  "118/2": [
    [76.7738, 19.2642],
    [76.77414, 19.26422],
    [76.77415, 19.2645],
    [76.77407, 19.26454],
    [76.7738, 19.26452],
    [76.77377, 19.26428],
  ],
  "118/2_2024": [
    [76.77376, 19.26424],
    [76.774, 19.26426],
    [76.77401, 19.26445],
    [76.77394, 19.26448],
    [76.77377, 19.26446],
    [76.77374, 19.26432],
  ],
  "118/2_2025": [
    [76.77378, 19.26423],
    [76.77405, 19.26425],
    [76.77406, 19.26447],
    [76.77398, 19.2645],
    [76.7738, 19.26448],
    [76.77377, 19.26432],
  ],
  "119/1": [
    [76.7761, 19.2641],
    [76.7766, 19.26412],
    [76.77662, 19.26457],
    [76.77618, 19.2646],
    [76.77608, 19.2644],
  ],
  "120/3": [
    [76.7695, 19.2606],
    [76.77, 19.26062],
    [76.77002, 19.26102],
    [76.7696, 19.26105],
    [76.76948, 19.26085],
  ],
  "121/2": [
    [76.7712, 19.262],
    [76.7716, 19.26202],
    [76.77162, 19.26235],
    [76.77135, 19.26238],
    [76.77118, 19.26222],
  ],
  "122/1": [
    [76.778, 19.2632],
    [76.77858, 19.26322],
    [76.7786, 19.26368],
    [76.7782, 19.26371],
    [76.77798, 19.2635],
  ],
  "123/4": [
    [76.7801, 19.2614],
    [76.78038, 19.26142],
    [76.78039, 19.26169],
    [76.78016, 19.26171],
    [76.78008, 19.26156],
  ],
  "124/2": [
    [76.781, 19.2625],
    [76.78133, 19.26252],
    [76.78134, 19.26282],
    [76.7811, 19.26284],
    [76.78098, 19.26268],
  ],
  "REF-01": [
    [76.7699, 19.26058],
    [76.7702, 19.2606],
    [76.77022, 19.2609],
    [76.76992, 19.26092],
  ],
} as const;

const polygon = (key: keyof typeof polygons) => ({
  type: "Polygon",
  coordinates: [polygons[key].map(([x, y]) => [x, y])],
});

interface SeedRecord {
  id: string;
  ulpin: string;
  survey: string;
  subdivision: string;
  owner: string;
  owners: { name: string; share: number }[];
  village: string;
  recorded: number;
  mapped: number;
  landUse: string;
  year: number;
  createdBy: string;
  geometryKey: keyof typeof polygons;
  ground: Record<string, unknown> | null;
  subdivisions?: { name: string; area: number }[];
  notes: string;
  verified?: boolean;
}

const records: SeedRecord[] = [
  {
    id: "rec_118_2",
    ulpin: "MH-PBN-2026-0118-0002-0001",
    survey: "118",
    subdivision: "2",
    owner: "Demo Owner A",
    owners: [
      { name: "Demo Owner A", share: 0.6 },
      { name: "Demo Owner B", share: 0.4 },
    ],
    village: "Parbhani",
    recorded: 1000,
    mapped: 1060,
    landUse: "Agricultural",
    year: 2025,
    createdBy: "usr_citizen",
    geometryKey: "118/2",
    ground: {
      source: "Illustrative drone survey mosaic (sample)",
      captured: "2026-02-14",
      built_up_fraction: 0.34,
      epochs: ["2024", "2025", "2026"],
      notes: "Sample evidence shows a G+2 structure and a new eastern extension on land recorded as agricultural.",
    },
    notes:
      "Primary demonstration parcel. Includes an illustrative boundary change and built-up ground evidence.",
  },
  {
    id: "rec_119_1",
    ulpin: "MH-PBN-2026-0119-0001-0001",
    survey: "119",
    subdivision: "1",
    owner: "Demo Owner C",
    owners: [{ name: "Demo Owner C", share: 1 }],
    village: "Parbhani",
    recorded: 2400,
    mapped: 2418,
    landUse: "Agricultural",
    year: 2025,
    createdBy: "usr_surveyor",
    geometryKey: "119/1",
    ground: {
      source: "Illustrative Sentinel-2 mosaic (sample)",
      captured: "2026-01-22",
      built_up_fraction: 0.02,
      epochs: ["2025", "2026"],
      notes: "Sample evidence is consistent with cultivated land.",
    },
    notes: "Sample record with complete evidence and no material inconsistency in supplied demo data.",
  },
  {
    id: "rec_120_3",
    ulpin: "MH-PBN-2026-0120-0003-0001",
    survey: "120",
    subdivision: "3",
    owner: "Demo Owner D",
    owners: [{ name: "Demo Owner D", share: 1 }],
    village: "Parbhani",
    recorded: 1800,
    mapped: 2100,
    landUse: "Agricultural",
    year: 2024,
    createdBy: "usr_surveyor",
    geometryKey: "120/3",
    ground: null,
    notes: "Escalation example: area conflict, geometry overlap and incomplete evidence.",
  },
  {
    id: "rec_121_2",
    ulpin: "MH-PBN-2026-0121-0002-0001",
    survey: "121",
    subdivision: "2",
    owner: "Demo Owner E",
    owners: [
      { name: "Demo Owner E", share: 0.55 },
      { name: "Demo Owner F", share: 0.3 },
    ],
    village: "Parbhani",
    recorded: 1500,
    mapped: 1492,
    landUse: "Agricultural",
    year: 2025,
    createdBy: "usr_officer",
    geometryKey: "121/2",
    ground: {
      source: "Illustrative drone survey mosaic (sample)",
      captured: "2026-02-02",
      built_up_fraction: 0.08,
      epochs: ["2024", "2025", "2026"],
      notes: "Sample evidence shows a small farm shed; no material built-up conflict.",
    },
    subdivisions: [
      { name: "121/2/A", area: 800 },
      { name: "121/2/B", area: 700 },
    ],
    notes: "Ownership share entry deliberately does not reconcile to the recorded total.",
  },
  {
    id: "rec_122_1",
    ulpin: "MH-PBN-2026-0122-0001-0001",
    survey: "122",
    subdivision: "1",
    owner: "Demo Owner G",
    owners: [{ name: "Demo Owner G", share: 1 }],
    village: "Parbhani",
    recorded: 3200,
    mapped: 3190,
    landUse: "Residential (Abadi)",
    year: 2025,
    createdBy: "usr_surveyor",
    geometryKey: "122/1",
    ground: {
      source: "Illustrative drone survey mosaic (sample)",
      captured: "2026-02-10",
      built_up_fraction: 0.52,
      epochs: ["2024", "2025", "2026"],
      notes: "Sample evidence is consistent with the recorded residential use.",
    },
    notes: "Urban / abadi sample property with G+2 building, floors and units.",
  },
  {
    id: "rec_123_4",
    ulpin: "MH-PBN-2026-0123-0004-0001",
    survey: "123",
    subdivision: "4",
    owner: "Demo Owner H",
    owners: [
      { name: "Demo Owner H", share: 0.5 },
      { name: "Demo Owner I", share: 0.5 },
    ],
    village: "Parbhani",
    recorded: 950,
    mapped: 958,
    landUse: "Agricultural",
    year: 2026,
    createdBy: "usr_citizen",
    geometryKey: "123/4",
    ground: {
      source: "Illustrative satellite tile (sample)",
      captured: "2026-02-18",
      built_up_fraction: 0.04,
      epochs: ["2026"],
      notes: "Sample evidence is consistent with agricultural use. OCR quality is the open issue.",
    },
    notes: "Low-quality scan example: OCR fields must be verified manually before the record can be trusted.",
  },
  {
    id: "rec_124_2",
    ulpin: "MH-PBN-2026-0124-0002-0001",
    survey: "124",
    subdivision: "2",
    owner: "Demo Owner J",
    owners: [{ name: "Demo Owner J", share: 1 }],
    village: "Parbhani",
    recorded: 1250,
    mapped: 1248,
    landUse: "Residential (Abadi)",
    year: 2025,
    createdBy: "usr_surveyor",
    geometryKey: "124/2",
    ground: {
      source: "Illustrative drone survey mosaic (sample)",
      captured: "2026-01-30",
      built_up_fraction: 0.61,
      epochs: ["2025", "2026"],
      notes: "Sample evidence confirms built-up residential use.",
    },
    notes: "Sample record previously approved by the demonstration revenue officer.",
    verified: true,
  },
];

function fieldRows(documentId: string, values: [string, string, number, number?][]): Omit<ExtractedField, "id">[] {
  return values.map(([name, value, confidence, requiresReview]) => ({
    document_id: documentId,
    field_name: name,
    extracted_value: value,
    corrected_value: null,
    confidence,
    requires_review: requiresReview ?? 0,
  }));
}

const standardFields = (docId: string, rec: SeedRecord, confidence = 0.95): Omit<ExtractedField, "id">[] =>
  fieldRows(docId, [
    ["owner_name", rec.owner, confidence - 0.01],
    ["survey_number", `${rec.survey}/${rec.subdivision}`, confidence],
    ["subdivision_number", rec.subdivision, confidence - 0.03],
    ["village", rec.village, confidence],
    ["taluka", "Parbhani", confidence - 0.02],
    ["district", "Parbhani", confidence - 0.01],
    ["recorded_area", String(rec.recorded), confidence - 0.05],
    ["land_use", rec.landUse, confidence - 0.02],
    ["owner_share", "1.00", confidence - 0.06],
    ["record_year", String(rec.year), confidence - 0.03],
    ["ulpin", rec.ulpin, confidence - 0.04],
  ]);

const lowQualityFields = (docId: string, rec: SeedRecord): Omit<ExtractedField, "id">[] =>
  fieldRows(docId, [
    ["owner_name", rec.owner, 0.48, 1],
    ["survey_number", `${rec.survey}/${rec.subdivision}`, 0.56, 1],
    ["subdivision_number", rec.subdivision, 0.51, 1],
    ["village", rec.village, 0.62, 1],
    ["taluka", "Parbhani", 0.44, 1],
    ["district", "Parbhani", 0.58, 1],
    ["recorded_area", String(rec.recorded), 0.49, 1],
    ["land_use", rec.landUse, 0.53, 1],
    ["owner_share", "1.00", 0.46, 1],
    ["record_year", String(rec.year), 0.6, 1],
  ]);

export function seedDatabase(db: DatabaseSync): void {
  db.prepare("INSERT INTO settings (key, value) VALUES ('config', ?)").run(JSON.stringify(settings));

  for (const user of users) {
    db.prepare(
      "INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)"
    ).run(user.id, user.full_name, user.email, hashPassword("demo123"), user.role, daysAgo(90, 9));
  }

  for (const rec of records) {
    db.prepare(
      `INSERT INTO land_records
        (id, ulpin, survey_number, subdivision_number, owner_name, village, taluka, district, state,
         recorded_area, mapped_area, area_unit, land_use, owner_share, owner_shares_json, record_year,
         status, trust_score, created_by, created_at, updated_at, ground_evidence_json, subdivisions_json, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'Parbhani', 'Parbhani', 'Maharashtra', ?, ?, 'm2', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    ).run(
      rec.id,
      rec.ulpin,
      rec.survey,
      rec.subdivision,
      rec.owner,
      rec.village,
      rec.recorded,
      rec.mapped,
      rec.landUse,
      rec.owners[0].share,
      JSON.stringify(rec.owners),
      rec.year,
      "digitized",
      rec.createdBy,
      daysAgo(20, 11),
      daysAgo(2, 16),
      rec.ground ? JSON.stringify(rec.ground) : null,
      rec.subdivisions ? JSON.stringify(rec.subdivisions) : null,
      rec.notes
    );

    const geomId = `geom_${rec.id}`;
    db.prepare(
      `INSERT INTO parcel_geometries
        (id, land_record_id, geometry_geojson, calculated_area, geometry_source, survey_epoch, created_at,
         label, survey_number, ulpin, land_use, trust_score, status)
       VALUES (?, ?, ?, ?, 'Illustrative demo cadastral geometry', 'current', ?, ?, ?, ?, ?, 0, 'sample')`
    ).run(
      geomId,
      rec.id,
      JSON.stringify(polygon(rec.geometryKey)),
      rec.mapped,
      daysAgo(20, 11),
      `Parcel ${rec.survey}/${rec.subdivision}`,
      `${rec.survey}/${rec.subdivision}`,
      rec.ulpin,
      rec.landUse
    );
  }

  db.prepare(
    `INSERT INTO parcel_geometries
      (id, land_record_id, geometry_geojson, calculated_area, geometry_source, survey_epoch, created_at,
       label, survey_number, ulpin, land_use, trust_score, status)
     VALUES ('geom_ref_1', NULL, ?, 780, 'Demo reference parcel', 'current', ?, 'Reference parcel (demo)', 'REF-01', NULL, 'Agricultural', NULL, 'reference')`
  ).run(JSON.stringify(polygon("REF-01")), daysAgo(30, 9));

  const docs: Omit<DocumentRow, "sha256_hash">[] = [];
  const docFields: Omit<ExtractedField, "id">[] = [];

  const addDoc = (
    rec: SeedRecord,
    suffix: string,
    category: string,
    fileName: string,
    filePath: string,
    type: string,
    ocrStatus: DocumentRow["ocr_status"]
  ) => {
    const id = `doc_${rec.id}_${suffix}`;
    docs.push({
      id,
      land_record_id: rec.id,
      file_name: fileName,
      file_type: type,
      document_category: category,
      file_path: filePath,
      uploaded_by: rec.createdBy,
      uploaded_at: daysAgo(19, 12),
      ocr_status: ocrStatus,
      size_bytes: 184320,
    });
    return id;
  };

  for (const rec of records) {
    const ror = addDoc(
      rec,
      "ror",
      "ror",
      rec.survey === "120" || rec.survey === "123"
        ? `khasra-${rec.survey}-${rec.subdivision}.svg`
        : `seven-twelve-${rec.survey}-${rec.subdivision}.svg`,
      rec.survey === "121" || rec.survey === "124"
        ? "/samples/eight-a.svg"
        : rec.survey === "120" || rec.survey === "123"
          ? "/samples/khasra.svg"
          : "/samples/seven-twelve.svg",
      "image/svg+xml",
      "complete"
    );
    if (rec.id === "rec_123_4") {
      docFields.push(...lowQualityFields(ror, rec));
    } else {
      docFields.push(...standardFields(ror, rec, rec.id === "rec_118_2" ? 0.96 : 0.96));
    }

    if (rec.id !== "rec_120_3") {
      addDoc(rec, "cadastral", "cadastral", `cadastral-${rec.survey}.svg`, "/samples/cadastral-map.svg", "image/svg+xml", "complete");
    }
    if (rec.id !== "rec_118_2") {
      addDoc(rec, "survey", "survey_report", `survey-report-${rec.survey}.svg`, "/samples/survey-report.svg", "image/svg+xml", "complete");
    }
    if (rec.ground) {
      addDoc(rec, "ground", "ground_evidence", `ground-evidence-${rec.survey}.svg`, "/samples/ground-evidence.svg", "image/svg+xml", "complete");
    }
  }

  for (const doc of docs) {
    const hash = createHash("sha256").update(`${doc.id}:${doc.file_path}`).digest("hex");
    db.prepare(
      `INSERT INTO documents (id, land_record_id, file_name, file_type, document_category, file_path, sha256_hash, uploaded_by, uploaded_at, ocr_status, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      doc.id,
      doc.land_record_id,
      doc.file_name,
      doc.file_type,
      doc.document_category,
      doc.file_path,
      hash,
      doc.uploaded_by,
      doc.uploaded_at,
      doc.ocr_status,
      doc.size_bytes
    );
  }

  for (const field of docFields) {
    db.prepare(
      "INSERT INTO extracted_fields (id, document_id, field_name, extracted_value, corrected_value, confidence, requires_review) VALUES (?, ?, ?, ?, NULL, ?, ?)"
    ).run(`fld_${randomUUID()}`, field.document_id, field.field_name, field.extracted_value, field.confidence, field.requires_review);
  }

  const structure = (recId: string, rows: (string | number | null)[][]) => {
    for (const r of rows) {
      db.prepare(
        `INSERT INTO property_structure (id, land_record_id, parent_id, structure_type, name, floor_number, unit_number, height, area, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(...r);
    }
  };

  structure("rec_118_2", [
    ["ps_118_parcel", "rec_118_2", null, "parcel", "Parcel 118/2", null, null, null, 1000, JSON.stringify({ survey: "118/2", area: 1000 })],
    ["ps_118_building", "rec_118_2", "ps_118_parcel", "building", "Building A", null, null, 9.6, 250, JSON.stringify({ floors: 3, units: 6, use: "Residential structure on agricultural parcel (disputed)", footprint: 250 })],
    ["ps_118_f1", "rec_118_2", "ps_118_building", "floor", "Ground floor", 1, null, 3.2, 250, JSON.stringify({ units: 2 })],
    ["ps_118_f2", "rec_118_2", "ps_118_building", "floor", "First floor", 2, null, 3.2, 250, JSON.stringify({ units: 2 })],
    ["ps_118_f3", "rec_118_2", "ps_118_building", "floor", "Second floor", 3, null, 3.2, 250, JSON.stringify({ units: 2 })],
    ["ps_118_u101", "rec_118_2", "ps_118_f1", "unit", "Unit A-101", null, "A-101", null, 120, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_u102", "rec_118_2", "ps_118_f1", "unit", "Unit A-102", null, "A-102", null, 130, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_u201", "rec_118_2", "ps_118_f2", "unit", "Unit A-201", null, "A-201", null, 120, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_u202", "rec_118_2", "ps_118_f2", "unit", "Unit A-202", null, "A-202", null, 130, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_u301", "rec_118_2", "ps_118_f3", "unit", "Unit A-301", null, "A-301", null, 120, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_u302", "rec_118_2", "ps_118_f3", "unit", "Unit A-302", null, "A-302", null, 130, JSON.stringify({ use: "Residential", status: "sample" })],
    ["ps_118_util", "rec_118_2", "ps_118_building", "utility", "Rooftop water tank", null, null, 1.4, 2.2, JSON.stringify({ utility_type: "water_tank" })],
  ]);

  structure("rec_122_1", [
    ["ps_122_parcel", "rec_122_1", null, "parcel", "Parcel 122/1", null, null, null, 3200, JSON.stringify({ survey: "122/1", area: 3200 })],
    ["ps_122_building", "rec_122_1", "ps_122_parcel", "building", "Building B", null, null, 9.5, 420, JSON.stringify({ floors: 3, units: 6, use: "Residential (Abadi)", footprint: 420 })],
    ["ps_122_f1", "rec_122_1", "ps_122_building", "floor", "Ground floor", 1, null, 3.1, 420, JSON.stringify({ units: 2 })],
    ["ps_122_f2", "rec_122_1", "ps_122_building", "floor", "First floor", 2, null, 3.1, 420, JSON.stringify({ units: 2 })],
    ["ps_122_f3", "rec_122_1", "ps_122_building", "floor", "Second floor", 3, null, 3.1, 420, JSON.stringify({ units: 2 })],
    ["ps_122_u1", "rec_122_1", "ps_122_f1", "unit", "Unit B-01", null, "B-01", null, 140, JSON.stringify({ use: "Residential" })],
    ["ps_122_u2", "rec_122_1", "ps_122_f1", "unit", "Unit B-02", null, "B-02", null, 140, JSON.stringify({ use: "Residential" })],
    ["ps_122_u3", "rec_122_1", "ps_122_f2", "unit", "Unit B-11", null, "B-11", null, 140, JSON.stringify({ use: "Residential" })],
    ["ps_122_u4", "rec_122_1", "ps_122_f2", "unit", "Unit B-12", null, "B-12", null, 140, JSON.stringify({ use: "Residential" })],
    ["ps_122_u5", "rec_122_1", "ps_122_f3", "unit", "Unit B-21", null, "B-21", null, 140, JSON.stringify({ use: "Residential" })],
    ["ps_122_u6", "rec_122_1", "ps_122_f3", "unit", "Unit B-22", null, "B-22", null, 140, JSON.stringify({ use: "Residential" })],
  ]);

  const histories: Omit<PropertyHistoryRow, "id">[] = [
    {
      land_record_id: "rec_118_2",
      year: 2024,
      description: "G+1 residential structure on a 250 m² footprint within the recorded agricultural parcel.",
      geometry_geojson: JSON.stringify(polygon("118/2_2024")),
      building_metadata_json: JSON.stringify({ floors: 2, units: 4, height: 6.4, footprint: 250, extension: false }),
      evidence_description: "Illustrative 2024 drone mosaic and survey sketch (sample evidence).",
      review_status: "confirmed",
    },
    {
      land_record_id: "rec_118_2",
      year: 2025,
      description: "An additional floor was added, increasing the structure from G+1 to G+2 and the unit count from 4 to 6.",
      geometry_geojson: JSON.stringify(polygon("118/2_2025")),
      building_metadata_json: JSON.stringify({ floors: 3, units: 6, height: 9.6, footprint: 250, extension: false }),
      evidence_description: "Illustrative 2025 drone mosaic; detected vertical extension (sample evidence).",
      review_status: "pending_review",
    },
    {
      land_record_id: "rec_118_2",
      year: 2026,
      description: "Boundary shift and a new eastern extension detected. The parcel footprint moved east/south relative to the 2024 survey epoch.",
      geometry_geojson: JSON.stringify(polygon("118/2")),
      building_metadata_json: JSON.stringify({ floors: 3, units: 6, height: 9.6, footprint: 250, extension: true }),
      evidence_description: "Illustrative 2026 drone mosaic compared with the 2024 survey sketch (sample evidence).",
      review_status: "pending_review",
    },
    {
      land_record_id: "rec_124_2",
      year: 2025,
      description: "Existing G+1 Residential structure confirmed by survey; no boundary change detected.",
      geometry_geojson: JSON.stringify(polygon("124/2")),
      building_metadata_json: JSON.stringify({ floors: 2, units: 2, height: 6.2, footprint: 300, extension: false }),
      evidence_description: "Illustrative 2025 drone mosaic (sample evidence).",
      review_status: "confirmed",
    },
  ];

  for (const h of histories) {
    db.prepare(
      `INSERT INTO property_history (id, land_record_id, year, description, geometry_geojson, building_metadata_json, evidence_description, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(`hist_${randomUUID()}`, h.land_record_id, h.year, h.description, h.geometry_geojson, h.building_metadata_json, h.evidence_description, h.review_status);
  }

  db.prepare(
    `INSERT INTO reviews (id, land_record_id, officer_id, decision, comments, reviewed_at)
     VALUES ('rev_seed_124', 'rec_124_2', 'usr_officer', 'approved', 'Sample record reviewed against supplied cadastral and ground evidence. Approval recorded for demonstration purposes only.', ?)`
  ).run(daysAgo(5, 14));

  const rec124 = records.find((r) => r.id === "rec_124_2")!;
  const receiptSnapshot = JSON.stringify({
    ulpin: rec124.ulpin,
    survey_number: `${rec124.survey}/${rec124.subdivision}`,
    owner: rec124.owner,
    area: rec124.recorded,
  });
  db.prepare(
    `INSERT INTO receipts (id, land_record_id, receipt_no, snapshot_hash, snapshot_json, issued_by, issued_at)
     VALUES ('rcpt_seed_124', 'rec_124_2', 'BHUMI-PROTO-2026-000124', ?, ?, 'usr_officer', ?)`
  ).run(createHash("sha256").update(receiptSnapshot).digest("hex"), receiptSnapshot, daysAgo(5, 14));

  const audit: Omit<AuditEvent, "id">[] = [];
  for (const rec of records) {
    audit.push({
      user_id: rec.createdBy,
      land_record_id: rec.id,
      action: "record_created",
      description: `Sample land record ${rec.survey}/${rec.subdivision} created from illustrative ${rec.village} data.`,
      document_hash: null,
      created_at: daysAgo(20, 11),
    });
    audit.push({
      user_id: rec.createdBy,
      land_record_id: rec.id,
      action: "document_uploaded",
      description: `RoR document uploaded for ${rec.survey}/${rec.subdivision}.`,
      document_hash: createHash("sha256").update(`doc_${rec.id}_ror:/samples/seven-twelve.svg`).digest("hex"),
      created_at: daysAgo(19, 12),
    });
    audit.push({
      user_id: rec.createdBy,
      land_record_id: rec.id,
      action: "ocr_completed",
      description: `OCR extraction completed for ${rec.survey}/${rec.subdivision}. Manual verification rules applied.`,
      document_hash: null,
      created_at: daysAgo(19, 12),
    });
    audit.push({
      user_id: "usr_surveyor",
      land_record_id: rec.id,
      action: "validation_run",
      description: `Three-way validation executed for ${rec.survey}/${rec.subdivision}.`,
      document_hash: null,
      created_at: daysAgo(15, 15),
    });
  }
  audit.push({
    user_id: "usr_officer",
    land_record_id: "rec_124_2",
    action: "record_approved",
    description: "Prototype verification approved after officer review. Receipt BHUMI-PROTO-2026-000124 issued.",
    document_hash: createHash("sha256").update(receiptSnapshot).digest("hex"),
    created_at: daysAgo(5, 14),
  });
  audit.push({
    user_id: "usr_admin",
    land_record_id: null,
    action: "system_seeded",
    description: "Demonstration dataset loaded. All names, identifiers, scores and geometries are illustrative.",
    document_hash: null,
    created_at: daysAgo(30, 9),
  });
  for (const event of audit) {
    db.prepare(
      "INSERT INTO audit_events (id, user_id, land_record_id, action, description, document_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(`aud_${randomUUID()}`, event.user_id, event.land_record_id, event.action, event.description, event.document_hash, event.created_at);
  }

  const allRecords = db.prepare("SELECT * FROM land_records").all() as LandRecord[];
  const allGeometries = db.prepare("SELECT * FROM parcel_geometries").all() as ParcelGeometryRow[];

  for (const rec of allRecords) {
    const recDocs = db.prepare("SELECT * FROM documents WHERE land_record_id = ?").all(rec.id) as DocumentRow[];
    const recFields = recDocs.length
      ? (db
          .prepare(
            `SELECT f.* FROM extracted_fields f JOIN documents d ON d.id = f.document_id WHERE d.land_record_id = ?`
          )
          .all(rec.id) as ExtractedField[])
      : [];
    const recGeoms = allGeometries.filter((g) => g.land_record_id === rec.id);
    const recHistory = db
      .prepare("SELECT * FROM property_history WHERE land_record_id = ? ORDER BY year")
      .all(rec.id) as PropertyHistoryRow[];

    const issues = evaluateValidation({
      record: rec,
      allRecords,
      geometries: allGeometries,
      recordGeometries: recGeoms,
      documents: recDocs,
      fields: recFields,
      history: recHistory,
      settings,
    });

    for (const issue of issues) {
      db.prepare(
        `INSERT INTO validation_results (id, land_record_id, rule_code, severity, title, description, evidence, affected_field, recommended_action, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
      ).run(
        `val_${randomUUID()}`,
        rec.id,
        issue.rule_code,
        issue.severity,
        issue.title,
        issue.description,
        issue.evidence,
        issue.affected_field,
        issue.recommended_action,
        daysAgo(2, 16)
      );
    }

    const auditEvents = db
      .prepare("SELECT * FROM audit_events WHERE land_record_id = ?")
      .all(rec.id) as AuditEvent[];

    const explanation = computeTrustScore({
      record: rec,
      issues,
      documents: recDocs,
      fields: recFields,
      history: recHistory,
      audit: auditEvents,
      settings,
      calculatedAt: daysAgo(2, 16),
    });

    db.prepare(
      `INSERT INTO trust_scores (id, land_record_id, text_integrity, text_map_consistency, ground_truth_match, change_audit_history, final_score, routing_status, explanation_json, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `score_${rec.id}`,
      rec.id,
      explanation.componentScores.text_integrity,
      explanation.componentScores.text_map_consistency,
      explanation.componentScores.ground_truth_match,
      explanation.componentScores.change_audit_history,
      explanation.final_score,
      explanation.routing_status,
      JSON.stringify(explanation),
      daysAgo(2, 16)
    );

    const finalStatus = rec.id === "rec_124_2" ? "verified" : explanation.routing_status;
    db.prepare("UPDATE land_records SET trust_score = ?, status = ?, updated_at = ? WHERE id = ?").run(
      explanation.final_score,
      finalStatus,
      daysAgo(2, 16),
      rec.id
    );

    db.prepare(
      "INSERT INTO audit_events (id, user_id, land_record_id, action, description, document_hash, created_at) VALUES (?, 'usr_surveyor', ?, 'trust_score_calculated', ?, NULL, ?)"
    ).run(
      `aud_${randomUUID()}`,
      rec.id,
      `Parcel Trust Score calculated: ${explanation.final_score}/100 (${explanation.routing_status.replaceAll("_", " ")}).`,
      daysAgo(2, 16)
    );
  }

  for (const rec of records) {
    const final = db.prepare("SELECT trust_score, status FROM land_records WHERE id = ?").get(rec.id) as
      | { trust_score: number; status: string }
      | undefined;
    if (final) {
      db.prepare("UPDATE parcel_geometries SET trust_score = ?, status = ? WHERE land_record_id = ?").run(
        final.trust_score,
        final.status,
        rec.id
      );
    }
  }
}
