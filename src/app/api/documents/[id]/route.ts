import { NextResponse } from "next/server";
import { jsonError, requireApiUser } from "@/lib/http";
import { getFieldsForDocuments } from "@/lib/service";
import { row } from "@/lib/db";
import type { DocumentRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const document = row<DocumentRow>("SELECT * FROM documents WHERE id = ?", id);
  if (!document) return jsonError("Document not found.", 404);
  return NextResponse.json({ document, fields: getFieldsForDocuments([id]) });
}
