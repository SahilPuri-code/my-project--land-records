import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireApiUser } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const records = all<{ trust_score: number; status: string; village: string; land_use: string }>(
    "SELECT trust_score, status, village, land_use FROM land_records"
  );
  const buckets = [
    { range: "0–59", min: 0, max: 59 },
    { range: "60–69", min: 60, max: 69 },
    { range: "70–79", min: 70, max: 79 },
    { range: "80–89", min: 80, max: 89 },
    { range: "90–100", min: 90, max: 100 },
  ];
  const trust_distribution = buckets.map((b) => ({
    range: b.range,
    count: records.filter((r) => r.trust_score >= b.min && r.trust_score <= b.max).length,
  }));

  const statusGroups = [
    { key: "verified", label: "Verified" },
    { key: "eligible_auto_verification", label: "Auto-eligible" },
    { key: "needs_officer_review", label: "Officer review" },
    { key: "escalate_resurvey", label: "Escalate" },
    { key: "correction_requested", label: "Correction" },
    { key: "rejected", label: "Rejected" },
  ];
  const status_distribution = statusGroups.map((s) => ({
    status: s.label,
    count: records.filter((r) => r.status === s.key).length,
  }));

  const issueRows = all<{ rule_code: string; severity: string; count: number }>(
    "SELECT rule_code, severity, COUNT(*) AS count FROM validation_results GROUP BY rule_code, severity"
  );
  const labels: Record<string, string> = {
    AREA_MISMATCH: "Area mismatch",
    OWNER_SHARE_MISMATCH: "Owner share",
    SUBDIVISION_AREA_MISMATCH: "Subdivision area",
    DUPLICATE_SURVEY_NUMBER: "Duplicate survey",
    PARCEL_OVERLAP: "Parcel overlap",
    LAND_USE_MISMATCH: "Land use",
    BOUNDARY_SHIFT: "Boundary shift",
    MISSING_EVIDENCE: "Missing evidence",
    LOW_OCR_CONFIDENCE: "Low OCR confidence",
  };
  const issueMap: Record<string, { code: string; label: string; count: number; critical: number }> = {};
  for (const issue of issueRows) {
    const entry = (issueMap[issue.rule_code] ??= {
      code: issue.rule_code,
      label: labels[issue.rule_code] ?? issue.rule_code,
      count: 0,
      critical: 0,
    });
    entry.count += Number(issue.count);
    if (issue.severity === "critical" || issue.severity === "high") entry.critical += Number(issue.count);
  }
  const issue_breakdown = Object.values(issueMap).sort((a, b) => b.count - a.count);

  const uploads = all<{ month: string; count: number }>(
    "SELECT substr(uploaded_at, 1, 7) AS month, COUNT(*) AS count FROM documents GROUP BY month ORDER BY month"
  );
  const months: { month: string; label: string; uploads: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      month: key,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      uploads: uploads.find((u) => u.month === key)?.count ?? 0,
    });
  }

  const landUse = all<{ land_use: string; count: number }>(
    "SELECT land_use, COUNT(*) AS count FROM land_records GROUP BY land_use"
  );

  return NextResponse.json({
    trust_distribution,
    status_distribution,
    issue_breakdown,
    upload_activity: months,
    land_use: landUse,
    total_issues: issueRows.reduce((s, r) => s + Number(r.count), 0),
  });
}
