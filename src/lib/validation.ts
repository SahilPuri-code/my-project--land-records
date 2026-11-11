import type {
  DocumentRow,
  ExtractedField,
  LandRecord,
  ParcelGeometryRow,
  PropertyHistoryRow,
  Settings,
  ValidationIssue,
} from "./types";
import { centroidDistanceM, overlapRatio, parsePolygon, toRing } from "./geo";

function add(
  issues: ValidationIssue[],
  issue: Omit<ValidationIssue, "status">
): void {
  issues.push({ ...issue, status: "open" });
}

export const CHECK_CATALOG: {
  code: string;
  title: string;
  fields: string;
  evidence: string;
}[] = [
  { code: "AREA_MISMATCH", title: "Area reconciliation", fields: "Recorded area vs mapped area", evidence: "RoR text + cadastral geometry" },
  { code: "OWNER_SHARE_MISMATCH", title: "Owner-share reconciliation", fields: "Owner shares", evidence: "RoR ownership entries" },
  { code: "SUBDIVISION_AREA_MISMATCH", title: "Subdivision reconciliation", fields: "Subdivision areas", evidence: "RoR subdivisions + parent area" },
  { code: "DUPLICATE_SURVEY_NUMBER", title: "Survey identifier uniqueness", fields: "Survey / subdivision number", evidence: "Record register" },
  { code: "PARCEL_OVERLAP", title: "Parcel overlap", fields: "Parcel geometry", evidence: "Cadastral polygons" },
  { code: "LAND_USE_MISMATCH", title: "Land-use consistency", fields: "Land use", evidence: "Recorded use + ground evidence" },
  { code: "BOUNDARY_SHIFT", title: "Boundary stability", fields: "Parcel boundary", evidence: "Historical survey epochs" },
  { code: "MISSING_EVIDENCE", title: "Evidence completeness", fields: "Supporting documents", evidence: "Document register" },
  { code: "LOW_OCR_CONFIDENCE", title: "OCR field confidence", fields: "Extracted fields", evidence: "OCR confidence values" },
];

export function evaluateValidation(input: {
  record: LandRecord;
  allRecords: LandRecord[];
  geometries: ParcelGeometryRow[];
  recordGeometries: ParcelGeometryRow[];
  documents: DocumentRow[];
  fields: ExtractedField[];
  history: PropertyHistoryRow[];
  settings: Settings;
}): ValidationIssue[] {
  const { record, allRecords, geometries, recordGeometries, documents, fields, history, settings } =
    input;
  const issues: ValidationIssue[] = [];

  const currentGeometry =
    recordGeometries.find((g) => g.survey_epoch === "current") ??
    recordGeometries[recordGeometries.length - 1];
  const currentRing = currentGeometry ? toRing(currentGeometry.geometry_geojson) : null;

  const areaDiffPct =
    record.recorded_area > 0 && record.mapped_area > 0
      ? (Math.abs(record.mapped_area - record.recorded_area) / record.recorded_area) * 100
      : 0;

  if (
    record.recorded_area > 0 &&
    record.mapped_area > 0 &&
    areaDiffPct > settings.thresholds.area_mismatch_pct
  ) {
    const direction = record.mapped_area > record.recorded_area ? "larger" : "smaller";
    add(issues, {
      rule_code: "AREA_MISMATCH",
      severity: areaDiffPct > 10 ? "high" : "medium",
      title: "Recorded area does not match mapped area",
      description: `The recorded area is ${record.recorded_area.toLocaleString("en-IN")} m² while the cadastral polygon measures ${record.mapped_area.toLocaleString("en-IN")} m² — a ${areaDiffPct.toFixed(1)}% difference. The mapped parcel is ${direction} than the record.`,
      evidence: `Recorded area: ${record.recorded_area} m² · Mapped area: ${record.mapped_area} m² · Tolerance: ${settings.thresholds.area_mismatch_pct}%`,
      affected_field: "recorded_area",
      recommended_action:
        "Re-measure the parcel from the latest survey, reconcile the RoR area, and record an officer-approved correction if the map is conclusive.",
    });
  }

  let shares: { name: string; share: number }[] = [];
  try {
    shares = record.owner_shares_json ? JSON.parse(record.owner_shares_json) : [];
  } catch {
    shares = [];
  }
  if (shares.length === 0) {
    shares = [{ name: record.owner_name, share: record.owner_share }];
  }
  const shareTotal = shares.reduce((sum, s) => sum + Number(s.share || 0), 0);
  if (shares.length && Math.abs(shareTotal - 1) > 0.005) {
    add(issues, {
      rule_code: "OWNER_SHARE_MISMATCH",
      severity: "high",
      title: "Owner shares do not reconcile to the recorded total",
      description: `Declared owner shares total ${(shareTotal * 100).toFixed(0)}% instead of 100%. The ownership entry is internally inconsistent and cannot support a verified title without human review.`,
      evidence: shares.map((s) => `${s.name}: ${(s.share * 100).toFixed(0)}%`).join(" · "),
      affected_field: "owner_share",
      recommended_action:
        "Compare against the registered sale deed and 7/12 ownership column, then request a corrected RoR entry from the authorized revenue officer.",
    });
  }

  let subdivisions: { name: string; area: number }[] = [];
  try {
    subdivisions = record.subdivisions_json ? JSON.parse(record.subdivisions_json) : [];
  } catch {
    subdivisions = [];
  }
  if (subdivisions.length) {
    const subdivisionTotal = subdivisions.reduce((sum, s) => sum + Number(s.area || 0), 0);
    const deviation = record.recorded_area > 0
      ? (Math.abs(subdivisionTotal - record.recorded_area) / record.recorded_area) * 100
      : 0;
    if (deviation > 2) {
      add(issues, {
        rule_code: "SUBDIVISION_AREA_MISMATCH",
        severity: "medium",
        title: "Subdivision areas do not reconcile with the parent parcel",
        description: `The ${subdivisions.length} recorded subdivisions total ${subdivisionTotal.toLocaleString("en-IN")} m² against a parent parcel of ${record.recorded_area.toLocaleString("en-IN")} m² (${deviation.toFixed(1)}% deviation).`,
        evidence: `${subdivisions.map((s) => `${s.name}: ${s.area} m²`).join(" · ")} · Parent: ${record.recorded_area} m²`,
        affected_field: "subdivision_number",
        recommended_action: "Verify each subdivision against the survey sketch and update the parent/subdivision area schedule.",
      });
    }
  }

  const duplicates = allRecords.filter(
    (other) =>
      other.id !== record.id &&
      other.survey_number.trim().toLowerCase() === record.survey_number.trim().toLowerCase() &&
      (other.subdivision_number || "") === (record.subdivision_number || "") &&
      other.village.trim().toLowerCase() === record.village.trim().toLowerCase()
  );
  if (duplicates.length) {
    add(issues, {
      rule_code: "DUPLICATE_SURVEY_NUMBER",
      severity: "high",
      title: "Duplicate survey identifier detected",
      description: `Survey number ${record.survey_number}/${record.subdivision_number} in ${record.village} is also assigned to ${duplicates.length} other record(s). Identifiers must uniquely identify a parcel.`,
      evidence: duplicates.map((d) => `${d.ulpin} (${d.owner_name})`).join(" · "),
      affected_field: "survey_number",
      recommended_action: "Resolve the identifier conflict with the land-record administrator before any verification.",
    });
  }

  if (currentRing) {
    for (const otherGeom of geometries) {
      if (otherGeom.survey_epoch !== "current") continue;
      if (otherGeom.land_record_id === record.id) continue;
      const otherRing = toRing(otherGeom.geometry_geojson);
      if (!otherRing) continue;
      const ratio = overlapRatio(currentRing, otherRing);
      if (ratio > 0.02) {
        const label = otherGeom.survey_number || otherGeom.label || "another parcel";
        add(issues, {
          rule_code: "PARCEL_OVERLAP",
          severity: ratio > 0.15 ? "critical" : "high",
          title: `Parcel overlaps ${label}`,
          description: `The current geometry overlaps ${label} by approximately ${(ratio * 100).toFixed(1)}% of the smaller parcel. Overlapping legal parcels indicate a boundary or subdivision conflict.`,
          evidence: `Geometry intersection against ${otherGeom.label || otherGeom.survey_number || otherGeom.id} · overlap ${(ratio * 100).toFixed(1)}%`,
          affected_field: "parcel_geometry",
          recommended_action: "Escalate to a survey team for ground measurement and resolve the overlap before certification.",
        });
        break;
      }
    }
  }

  let ground: { built_up_fraction?: number; notes?: string; source?: string; captured?: string; epochs?: string[] } | null = null;
  try {
    ground = record.ground_evidence_json ? JSON.parse(record.ground_evidence_json) : null;
  } catch {
    ground = null;
  }
  const isAgricultural = /agri|crop|farm|शेत/i.test(record.land_use);
  if (ground && typeof ground.built_up_fraction === "number" && ground.built_up_fraction >= 0.25 && isAgricultural) {
    add(issues, {
      rule_code: "LAND_USE_MISMATCH",
      severity: "high",
      title: "Recorded agricultural use conflicts with ground evidence",
      description: `Sample ground evidence indicates approximately ${(ground.built_up_fraction * 100).toFixed(0)}% built-up development, while the record lists "${record.land_use}". The recorded land use may be outdated or incorrect.`,
      evidence: `${ground.source || "Ground evidence"} captured ${ground.captured || "—"} · built-up fraction ${(ground.built_up_fraction * 100).toFixed(0)}%`,
      affected_field: "land_use",
      recommended_action: "Inspect the site and, if development is confirmed, process a land-use correction with supporting approvals.",
    });
  }

  if (history.length > 1) {
    const ordered = [...history].sort((a, b) => a.year - b.year);
    let shift: { from: number; to: number; distance: number } | null = null;
    for (let i = 1; i < ordered.length; i++) {
      const before = toRing(ordered[i - 1].geometry_geojson);
      const after = toRing(ordered[i].geometry_geojson);
      if (!before || !after) continue;
      const distance = centroidDistanceM(before, after);
      if (distance > 6 && (!shift || distance > shift.distance)) {
        shift = { from: ordered[i - 1].year, to: ordered[i].year, distance };
      }
    }
    if (shift) {
      add(issues, {
        rule_code: "BOUNDARY_SHIFT",
        severity: "high",
        title: "Boundary shift detected between survey epochs",
        description: `The parcel centroid moved approximately ${shift.distance.toFixed(0)} m between the ${shift.from} and ${shift.to} survey epochs. The boundary may have changed without a matching record update.`,
        evidence: `Epoch ${shift.from} → ${shift.to} · centroid displacement ${shift.distance.toFixed(0)} m · threshold 6 m`,
        affected_field: "parcel_geometry",
        recommended_action: "Compare the survey sketches, confirm whether the shift is a legitimate subdivision/extension, and require surveyor sign-off.",
      });
    }
  }

  const required: { category: string; label: string }[] = [
    { category: "ror", label: "record of rights (7/12, 8A or Khasra)" },
    { category: "cadastral", label: "cadastral map" },
    { category: "survey_report", label: "survey report" },
  ];
  for (const req of required) {
    const found = documents.some(
      (d) => d.document_category === req.category || (req.category === "ror" && d.document_category === "7_12")
    );
    if (!found) {
      add(issues, {
        rule_code: "MISSING_EVIDENCE",
        severity: "medium",
        title: `Missing ${req.label}`,
        description: `No ${req.label} is linked to this parcel. Absence of this evidence prevents a complete three-way validation and keeps the Trust Score provisional.`,
        evidence: `Required category: ${req.category} · linked documents: ${documents.length}`,
        affected_field: "documents",
        recommended_action: `Upload the ${req.label} or record a documented reason why it is unavailable.`,
      });
    }
  }

  const confidences = fields.map((f) => (f.confidence > 1 ? f.confidence : f.confidence * 100));
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const lowFields = fields.filter(
    (f) => f.requires_review === 1 || (f.confidence > 1 ? f.confidence : f.confidence * 100) < settings.thresholds.ocr_confidence
  );
  if (lowFields.length) {
    add(issues, {
      rule_code: "LOW_OCR_CONFIDENCE",
      severity: lowFields.length > 2 ? "high" : "medium",
      title: "Low-confidence extracted fields need manual verification",
      description: `${lowFields.length} field(s) are below the ${settings.thresholds.ocr_confidence}% confidence threshold (average ${avgConfidence.toFixed(0)}%). These values must not be silently accepted.`,
      evidence: lowFields
        .map((f) => `${f.field_name}: ${((f.confidence > 1 ? f.confidence : f.confidence * 100)).toFixed(0)}%`)
        .join(" · "),
      affected_field: lowFields.map((f) => f.field_name).join(", "),
      recommended_action: "Compare the document image with each field, enter corrections manually, and mark the extraction as verified.",
    });
  }

  return issues;
}
