import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import type { Role, User } from "./types";

export type ApiAuth = { user: User } | { error: NextResponse };

export async function requireApiUser(roles?: Role[]): Promise<ApiAuth> {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (roles && !roles.includes(user.role)) {
    return {
      error: NextResponse.json(
        { error: "Your role does not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}
