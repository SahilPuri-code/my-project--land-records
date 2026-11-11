import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/http";
import { getDocuments, getRecord } from "@/lib/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!getRecord(id)) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  return NextResponse.json({ documents: getDocuments(id) });
}
