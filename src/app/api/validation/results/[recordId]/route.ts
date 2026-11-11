import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getRecord, getRecordBundle } from "@/lib/service";
import { CHECK_CATALOG } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { recordId } = await params;
  const record = getRecord(recordId);
  if (!record) return jsonError("Record not found.", 404);
  const bundle = getRecordBundle(recordId)!;
  const failing = new Set(bundle.issues.map((i) => i.rule_code));
  const checks = CHECK_CATALOG.map((check) => ({
    ...check,
    status: failing.has(check.code) ? "flagged" : "passed",
    issues: bundle.issues.filter((i) => i.rule_code === check.code),
  }));
  return NextResponse.json({
    record: bundle.record,
    issues: bundle.issues,
    checks,
    trust: bundle.trust,
    explanation: bundle.explanation,
    documents: bundle.documents,
    fields: bundle.fields,
    geometries: bundle.geometries,
    owners: bundle.owners,
  });
}
