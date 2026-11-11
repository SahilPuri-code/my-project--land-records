import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { row } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { addAuditEvent } from "@/lib/service";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const user = row<User & { password_hash: string }>("SELECT * FROM users WHERE lower(email) = ?", email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password. Try a demo account below." }, { status: 401 });
  }
  if (!user.is_active) {
    return NextResponse.json({ error: "This account is disabled. Contact the administrator." }, { status: 403 });
  }
  const token = createSession(user.id);
  addAuditEvent({
    userId: user.id,
    recordId: null,
    action: "user_login",
    description: `${user.full_name} signed in as ${user.role}.`,
  });
  const secure = new URL(request.url).protocol === "https:";
  const response = NextResponse.json({
    user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}
