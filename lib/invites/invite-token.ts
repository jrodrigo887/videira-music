import { createHash, randomBytes } from "node:crypto";

export function generateInviteCode(): { code: string; hash: string } {
  const code = randomBytes(32).toString("base64url");
  return { code, hash: hashInviteCode(code) };
}

export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
