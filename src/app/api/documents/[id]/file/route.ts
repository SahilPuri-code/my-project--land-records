import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/http";
import { row } from "@/lib/db";
import type { DocumentRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const document = row<DocumentRow>("SELECT * FROM documents WHERE id = ?", id);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (document.file_path.startsWith("/samples/")) {
    return NextResponse.redirect(new URL(document.file_path, request.url));
  }
  const fileName = path.basename(document.file_path);
  const fullPath = path.join(process.cwd(), "uploads", fileName);
  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: "Stored file is missing from the upload directory." }, { status: 404 });
  }
  const bytes = readFileSync(fullPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.file_type,
      "Content-Disposition": `inline; filename="${document.file_name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
