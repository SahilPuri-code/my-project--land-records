import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import { addAuditEvent } from "@/lib/service";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  resetDemoData();
  addAuditEvent({
    userId: auth.user.id,
    recordId: null,
    action: "demo_reset",
    description: "Demonstration dataset reset to its original illustrative state.",
  });
  return NextResponse.json({ ok: true, message: "Demo dataset restored. All sample records, scores and histories were reset." });
}
