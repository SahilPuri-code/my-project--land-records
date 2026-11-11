import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getHistory, getRecord, getStructure } from "@/lib/service";

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
  return NextResponse.json({
    record,
    history: getHistory(recordId),
    structure: getStructure(recordId),
    demo_notice: "All historical epochs and detected changes are illustrative demo data.",
  });
}
