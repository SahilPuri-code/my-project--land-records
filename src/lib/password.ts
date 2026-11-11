import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, expected] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !expected) return false;
    const derived = scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expected, "hex");
    return derived.length === expectedBuf.length && timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}
