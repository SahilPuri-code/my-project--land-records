import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent } from "@/lib/service";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ settings: getSettings() });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  let body: Settings;
  try {
    body = await readJson<Settings>(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  const weights = body.weights;
  if (!weights) return jsonError("Trust Score weights are required.");
  const weightValues = Object.values(weights).map(Number);
  if (weightValues.some((w) => !Number.isFinite(w) || w < 0 || w > 100)) {
    return jsonError("Each weight must be a number between 0 and 100.");
  }
  const total = weightValues.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 0.01) {
    return jsonError(`Trust Score weights must total exactly 100%. Current total: ${total}%.`);
  }
  const thresholds = body.thresholds;
  if (!thresholds) return jsonError("Thresholds are required.");
  if (
    !Number.isFinite(thresholds.auto_verify) ||
    !Number.isFinite(thresholds.officer_review) ||
    thresholds.auto_verify <= thresholds.officer_review
  ) {
    return jsonError("Auto-verification threshold must be greater than the officer-review threshold.");
  }
  const next: Settings = {
    weights: {
      text_integrity: Number(weights.text_integrity),
      text_map_consistency: Number(weights.text_map_consistency),
      ground_truth_match: Number(weights.ground_truth_match),
      change_audit_history: Number(weights.change_audit_history),
    },
    thresholds: {
      area_mismatch_pct: Number(thresholds.area_mismatch_pct),
      ocr_confidence: Number(thresholds.ocr_confidence),
      auto_verify: Number(thresholds.auto_verify),
      officer_review: Number(thresholds.officer_review),
    },
    demo_mode: Boolean(body.demo_mode ?? true),
  };
  saveSettings(next);
  addAuditEvent({
    userId: auth.user.id,
    recordId: null,
    action: "settings_updated",
    description: `Trust Score weights changed to ${next.weights.text_integrity}/${next.weights.text_map_consistency}/${next.weights.ground_truth_match}/${next.weights.change_audit_history} and thresholds updated.`,
  });
  return NextResponse.json({ settings: next });
}
