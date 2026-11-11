import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getRecordBundle } from "@/lib/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { recordId } = await params;
  const bundle = getRecordBundle(recordId);
  if (!bundle) return jsonError("Property passport not found.", 404);
  const identity = JSON.stringify({
    ulpin: bundle.record.ulpin,
    survey: `${bundle.record.survey_number}/${bundle.record.subdivision_number}`,
    owner: bundle.record.owner_name,
    trust: bundle.record.trust_score,
    status: bundle.record.status,
  });
  const integrity = createHash("sha256").update(identity).digest("hex");
  return NextResponse.json({
    ...bundle,
    integrity_hash: integrity,
    demo_notice:
      "Digital Property Passport generated from illustrative hackathon data. It is not an official land record or legal title certificate.",
  });
}
