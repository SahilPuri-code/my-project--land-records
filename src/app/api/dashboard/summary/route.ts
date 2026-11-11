import { NextResponse } from "next/server";
import { all, row } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import type { LandRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const records = all<LandRecord>("SELECT * FROM land_records");
  const total = records.length;
  const verified = records.filter((r) => r.status === "verified").length;
  const review = records.filter((r) => r.status === "needs_officer_review").length;
  const escalated = records.filter((r) => r.status === "escalate_resurvey").length;
  const correction = records.filter((r) => r.status === "correction_requested").length;
  const digitizedRow = row<{ count: number }>(
    "SELECT COUNT(DISTINCT land_record_id) AS count FROM documents"
  );
  const docRow = row<{ count: number; ocr_done: number }>(
    "SELECT COUNT(*) AS count, SUM(CASE WHEN ocr_status = 'complete' THEN 1 ELSE 0 END) AS ocr_done FROM documents"
  );
  const avg = row<{ avg: number | null; area: number | null }>(
    "SELECT AVG(trust_score) AS avg, SUM(recorded_area) AS area FROM land_records"
  );
  const recent = all<{
    id: string;
    action: string;
    description: string;
    created_at: string;
    user_name: string | null;
    survey_number: string | null;
    subdivision_number: string | null;
    land_record_id: string | null;
  }>(
    `SELECT a.id, a.action, a.description, a.created_at, u.full_name AS user_name,
            lr.survey_number, lr.subdivision_number, a.land_record_id
     FROM audit_events a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN land_records lr ON lr.id = a.land_record_id
     ORDER BY a.created_at DESC LIMIT 10`
  );
  const recentRecords = all<LandRecord & { flag_count: number }>(
    `SELECT lr.*, (SELECT COUNT(*) FROM validation_results v WHERE v.land_record_id = lr.id) AS flag_count
     FROM land_records lr ORDER BY lr.updated_at DESC LIMIT 5`
  );
  const villages = [...new Set(records.map((r) => r.village))].sort();
  const districts = [...new Set(records.map((r) => r.district))].sort();
  return NextResponse.json({
    counts: {
      total,
      digitized: digitizedRow?.count ?? 0,
      verified,
      review,
      escalated,
      pending_reviews: review + escalated + correction,
      correction,
      documents: docRow?.count ?? 0,
      ocr_complete: docRow?.ocr_done ?? 0,
    },
    average_trust_score: Math.round(avg?.avg ?? 0),
    total_area: avg?.area ?? 0,
    recent_activity: recent,
    recent_records: recentRecords,
    villages,
    districts,
    demo: true,
  });
}
