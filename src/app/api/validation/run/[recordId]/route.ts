import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { runValidation } from "@/lib/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const auth = await requireApiUser(["surveyor", "officer", "admin", "citizen"]);
  if ("error" in auth) return auth.error;
  const { recordId } = await params;
  const result = runValidation(recordId, auth.user.id);
  if (!result) return jsonError("Record not found.", 404);
  return NextResponse.json(result);
}
