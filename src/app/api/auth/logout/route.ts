import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { addAuditEvent } from "@/lib/service";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser();
  if (user) {
    addAuditEvent({
      userId: user.id,
      recordId: null,
      action: "user_logout",
      description: `${user.full_name} signed out.`,
    });
  }
  destroySession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
