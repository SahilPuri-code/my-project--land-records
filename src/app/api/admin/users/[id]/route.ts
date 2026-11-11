import { NextResponse } from "next/server";
import { getDb, row } from "@/lib/db";
import { jsonError, readJson, requireApiUser } from "@/lib/http";
import { addAuditEvent } from "@/lib/service";
import type { Role, User } from "@/lib/types";

export const runtime = "nodejs";

const ROLES: Role[] = ["citizen", "surveyor", "officer", "admin"];

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = row<User>("SELECT * FROM users WHERE id = ?", id);
  if (!existing) return jsonError("User not found.", 404);
  let body: { full_name?: string; role?: Role; is_active?: boolean | number };
  try {
    body = await readJson(request);
  } catch (error) {
    return jsonError((error as Error).message);
  }
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.full_name) {
    updates.push("full_name = ?");
    values.push(String(body.full_name).slice(0, 120));
  }
  if (body.role) {
    if (!ROLES.includes(body.role)) return jsonError("Invalid role.");
    updates.push("role = ?");
    values.push(body.role);
  }
  if (body.is_active !== undefined) {
    const active = body.is_active === true || body.is_active === 1;
    if (id === auth.user.id && !active) return jsonError("You cannot deactivate your own administrator account.");
    updates.push("is_active = ?");
    values.push(active ? 1 : 0);
  }
  if (!updates.length) return jsonError("No changes supplied.");
  values.push(id);
  getDb().prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  addAuditEvent({
    userId: auth.user.id,
    recordId: null,
    action: "user_updated",
    description: `Administrator updated user ${existing.email}: ${Object.keys(body).join(", ")}.`,
  });
  return NextResponse.json({ user: row<User>("SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = ?", id) });
}
