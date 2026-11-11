import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { requireApiUser } from "@/lib/http";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser(["admin"]);
  if ("error" in auth) return auth.error;
  return NextResponse.json({
    users: all<User>(
      "SELECT id, full_name, email, role, is_active, created_at FROM users ORDER BY created_at"
    ),
  });
}
