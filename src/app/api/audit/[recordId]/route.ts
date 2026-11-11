import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getAudit, getRecord } from "@/lib/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { recordId } = await params;
  if (!getRecord(recordId)) return jsonError("Record not found.", 404);
  return NextResponse.json({ events: getAudit(recordId) });
}
