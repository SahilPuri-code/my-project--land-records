import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import type { LandRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser(["officer", "admin"]);
  if ("error" in auth) return auth.error;
  const records = all<LandRecord & { flag_count: number; critical_count: number; document_count: number }>(
    `SELECT lr.*,
       (SELECT COUNT(*) FROM validation_results v WHERE v.land_record_id = lr.id) AS flag_count,
       (SELECT COUNT(*) FROM validation_results v WHERE v.land_record_id = lr.id AND v.severity IN ('high','critical')) AS critical_count,
       (SELECT COUNT(*) FROM documents d WHERE d.land_record_id = lr.id) AS document_count
     FROM land_records lr
     WHERE lr.status IN ('needs_officer_review','escalate_resurvey','correction_requested')
     ORDER BY lr.trust_score ASC, lr.updated_at ASC`
  );
  return NextResponse.json({ records });
}
