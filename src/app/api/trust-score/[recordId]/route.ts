import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getRecord, getTrustScore } from "@/lib/service";

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
  const trust = getTrustScore(recordId);
  return NextResponse.json({
    record,
    trust,
    explanation: trust ? JSON.parse(trust.explanation_json) : null,
  });
}
