import type {
  AuditEvent,
  DocumentRow,
  ExtractedField,
  LandRecord,
  PropertyHistoryRow,
  RecordStatus,
  ScoreComponent,
  Settings,
  TrustScoreExplanation,
  ValidationIssue,
} from "./types";

export type RoutingStatus = "eligible_auto_verification" | "needs_officer_review" | "escalate_resurvey";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function routingForScore(score: number, thresholds: Settings["thresholds"]): RecordStatus {
  if (score >= thresholds.auto_verify) return "eligible_auto_verification";
  if (score >= thresholds.officer_review) return "needs_officer_review";
  return "escalate_resurvey";
}

function hasIssue(issues: ValidationIssue[], code: string) {
  return issues.some((issue) => issue.rule_code === code);
}

export function computeTrustScore(input: {
  record: LandRecord;
  issues: ValidationIssue[];
  documents: DocumentRow[];
  fields: ExtractedField[];
  history: PropertyHistoryRow[];
  audit: AuditEvent[];
  settings: Settings;
  calculatedAt?: string;
}): TrustScoreExplanation & { componentScores: Record<string, number> } {
  const { record, issues, documents, fields, history, settings } = input;
  const weights = settings.weights;
  const at = input.calculatedAt ?? new Date().toISOString();

  const allFields = fields;
  const confidences = allFields.map((f) => (f.confidence > 1 ? f.confidence : f.confidence * 100));
  const avgConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const flaggedFields = allFields.filter((f) => f.requires_review === 1).length;
  const rorDocs = documents.filter((d) => d.document_category === "ror" || d.document_category === "7_12");
  const groundDocs = documents.filter((d) => d.document_category === "ground_evidence");
  const mappedGeom = Boolean(record.mapped_area);

  const textDeductions: ScoreComponent["deductions"] = [];
  let text = 100;
  if (!rorDocs.length) {
    text -= 40;
    textDeductions.push({ reason: "No record-of-rights document", points: 40, detail: "No 7/12, 8A or Khasra document is linked to this record." });
  }
  if (allFields.length === 0) {
    text -= 12;
    textDeductions.push({ reason: "No structured extraction", points: 12, detail: "No OCR-extracted or manually entered fields were found." });
  } else if (avgConfidence < 95) {
    const points = round1((95 - avgConfidence) * 1.5);
    text -= points;
    textDeductions.push({
      reason: "OCR confidence below target",
      points,
      detail: `Average field confidence is ${avgConfidence.toFixed(1)}% against a 95% target.`,
    });
  }
  if (flaggedFields > 0) {
    const points = Math.min(30, flaggedFields * 8);
    text -= points;
    textDeductions.push({
      reason: "Fields require manual verification",
      points,
      detail: `${flaggedFields} extracted field${flaggedFields === 1 ? "" : "s"} fall below the configured OCR threshold.`,
    });
  }
  if (hasIssue(issues, "OWNER_SHARE_MISMATCH")) {
    text -= 58;
    textDeductions.push({
      reason: "Owner-share integrity conflict",
      points: 58,
      detail: "Declared owner shares do not reconcile to the recorded total. Ownership data cannot be treated as trustworthy.",
    });
  }
  const criticalFields: [string, unknown][] = [
    ["owner name", record.owner_name],
    ["survey number", record.survey_number],
    ["village", record.village],
    ["recorded area", record.recorded_area],
  ];
  const missingFields = criticalFields.filter(([, v]) => !v).length;
  if (missingFields) {
    const points = missingFields * 5;
    text -= points;
    textDeductions.push({ reason: "Missing core record fields", points, detail: `${missingFields} core field(s) are empty.` });
  }
  text = clamp(round1(text));

  const textMapDeductions: ScoreComponent["deductions"] = [];
  let textMap = 100;
  if (!mappedGeom) {
    textMap -= 35;
    textMapDeductions.push({ reason: "No cadastral geometry", points: 35, detail: "No mapped parcel geometry or mapped area is available." });
  }
  const areaDiffPct =
    record.recorded_area > 0 && record.mapped_area > 0
      ? (Math.abs(record.mapped_area - record.recorded_area) / record.recorded_area) * 100
      : 0;
  if (hasIssue(issues, "AREA_MISMATCH")) {
    const points = round1(Math.min(35, areaDiffPct * 3));
    textMap -= points;
    textMapDeductions.push({
      reason: "Recorded vs mapped area mismatch",
      points,
      detail: `${areaDiffPct.toFixed(1)}% difference exceeds the ${settings.thresholds.area_mismatch_pct}% tolerance.`,
    });
  }
  if (hasIssue(issues, "PARCEL_OVERLAP")) {
    textMap -= 55;
    textMapDeductions.push({ reason: "Parcel geometry overlap", points: 55, detail: "The polygon intersects another parcel's geometry beyond tolerance." });
  }
  if (hasIssue(issues, "SUBDIVISION_AREA_MISMATCH")) {
    textMap -= 12;
    textMapDeductions.push({ reason: "Subdivision areas do not reconcile", points: 12, detail: "Subdivision areas exceed or under-reconcile with the parent parcel." });
  }
  if (hasIssue(issues, "DUPLICATE_SURVEY_NUMBER")) {
    textMap -= 16;
    textMapDeductions.push({ reason: "Duplicate survey identifier", points: 16, detail: "Another record shares this survey/subdivision combination." });
  }
  if (hasIssue(issues, "LOW_OCR_CONFIDENCE")) {
    textMap -= 25;
    textMapDeductions.push({ reason: "Low-confidence text pairing", points: 25, detail: "Map matching relies on text fields that could not be read confidently." });
  }
  textMap = clamp(round1(textMap));

  const groundDeductions: ScoreComponent["deductions"] = [];
  let ground = 100;
  if (!groundDocs.length && !record.ground_evidence_json) {
    ground -= 50;
    groundDeductions.push({ reason: "No ground-truth evidence", points: 50, detail: "No drone, satellite or survey evidence is attached." });
  }
  if (hasIssue(issues, "LAND_USE_MISMATCH")) {
    ground -= 22;
    groundDeductions.push({
      reason: "Ground evidence conflicts with land use",
      points: 22,
      detail: "Sample ground evidence indicates built-up development while the record lists agricultural use.",
    });
  }
  if (hasIssue(issues, "BOUNDARY_SHIFT")) {
    ground -= 14;
    groundDeductions.push({ reason: "Boundary change detected", points: 14, detail: "Current geometry differs from the previous surveyed epoch beyond tolerance." });
  }
  ground = clamp(round1(ground));

  const changeDeductions: ScoreComponent["deductions"] = [];
  let change = 100;
  const missingIssues = issues.filter((i) => i.rule_code === "MISSING_EVIDENCE");
  if (missingIssues.length) {
    const points = Math.min(20, missingIssues.length * 10);
    change -= points;
    changeDeductions.push({
      reason: "Evidence gaps",
      points,
      detail: missingIssues.map((i) => i.title).join("; "),
    });
  }
  if (hasIssue(issues, "BOUNDARY_SHIFT")) {
    change -= 6;
    changeDeductions.push({ reason: "Unreviewed boundary change", points: 6, detail: "A detected change has not completed officer review." });
  }
  if (history.length === 0) {
    change -= 12;
    changeDeductions.push({ reason: "No historical epochs", points: 12, detail: "No 4D history is available to establish change continuity." });
  } else if (history.some((h) => h.review_status === "pending_review")) {
    change -= 4;
    changeDeductions.push({ reason: "Historical change pending review", points: 4, detail: "At least one historical change is waiting for human confirmation." });
  }
  if (hasIssue(issues, "OWNER_SHARE_MISMATCH")) {
    change -= 20;
    changeDeductions.push({ reason: "Ownership continuity concern", points: 20, detail: "Conflicting owner shares weaken the auditable chain of title." });
  }
  change = clamp(round1(change));

  const components: ScoreComponent[] = [
    {
      key: "text_integrity",
      label: "Text integrity",
      weight: weights.text_integrity,
      score: text,
      weighted: round1((text * weights.text_integrity) / 100),
      deductions: textDeductions,
    },
    {
      key: "text_map_consistency",
      label: "Text-to-map consistency",
      weight: weights.text_map_consistency,
      score: textMap,
      weighted: round1((textMap * weights.text_map_consistency) / 100),
      deductions: textMapDeductions,
    },
    {
      key: "ground_truth_match",
      label: "Ground-truth match",
      weight: weights.ground_truth_match,
      score: ground,
      weighted: round1((ground * weights.ground_truth_match) / 100),
      deductions: groundDeductions,
    },
    {
      key: "change_audit_history",
      label: "Change and audit history",
      weight: weights.change_audit_history,
      score: change,
      weighted: round1((change * weights.change_audit_history) / 100),
      deductions: changeDeductions,
    },
  ];

  const finalScore = Math.round(
    components.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
  );
  const routing = routingForScore(finalScore, settings.thresholds);
  const missingEvidence = issues.filter((i) => i.rule_code === "MISSING_EVIDENCE").map((i) => i.title);
  const provisional = missingEvidence.length > 0 || history.length === 0;

  const summary = [
    `Text integrity ${text}/100.`,
    `Text-to-map consistency ${textMap}/100.`,
    `Ground-truth match ${ground}/100.`,
    `Change and audit history ${change}/100.`,
    `Weighted result = ${components.map((c) => `${c.weight}% × ${c.score}`).join(" + ")} = ${finalScore}/100.`,
    routing === "eligible_auto_verification"
      ? "Under the configured demo controls this parcel is eligible for auto-verification. A human officer remains the legal decision-maker."
      : routing === "needs_officer_review"
        ? "This parcel requires officer review before any correction or verification is recorded."
        : "This parcel is below the review threshold and should be escalated for re-survey.",
  ].join(" ");

  return {
    components,
    final_score: finalScore,
    routing_status: routing,
    provisional,
    summary,
    missing_evidence: missingEvidence,
    calculated_at: at,
    componentScores: {
      text_integrity: text,
      text_map_consistency: textMap,
      ground_truth_match: ground,
      change_audit_history: change,
    },
  };
}
