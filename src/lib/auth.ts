import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, row } from "./db";
import type { Role, User } from "./types";

export const SESSION_COOKIE = "bhumi_session";
export const SESSION_DAYS = 7;

export function createSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).run(token, userId, now.toISOString(), expires.toISOString());
  return token;
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const session = row<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token = ?",
    token
  );
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  const user = row<User>(
    "SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = ?",
    session.user_id
  );
  if (!user || !user.is_active) return null;
  return { ...user };
}

export function canReview(role: Role | undefined): boolean {
  return role === "officer" || role === "admin";
}

export function canUpload(role: Role | undefined): boolean {
  return role === "surveyor" || role === "officer" || role === "admin" || role === "citizen";
}

export function canAdmin(role: Role | undefined): boolean {
  return role === "admin";
}
