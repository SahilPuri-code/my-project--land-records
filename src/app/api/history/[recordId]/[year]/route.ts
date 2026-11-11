import { NextResponse } from "next/server";
import { row } from "@/lib/db";
import { jsonError, requireApiUser } from "@/lib/http";
import { getRecord } from "@/lib/service";
import type { PropertyHistoryRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string; year: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { recordId, year } = await params;
  const record = getRecord(recordId);
  if (!record) return jsonError("Record not found.", 404);
  const entry = row<PropertyHistoryRow>(
    "SELECT * FROM property_history WHERE land_record_id = ? AND year = ?",
    recordId,
    Number(year)
  );
  if (!entry) return jsonError(`No illustrative history is available for ${year}.`, 404);
  return NextResponse.json({ record, entry });
}
