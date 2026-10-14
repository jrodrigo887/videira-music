import { createHash, timingSafeEqual } from "node:crypto";

function digestSecret(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function secretsMatch(submitted: string, configured: string): boolean {
  const submittedDigest = digestSecret(submitted);
  const configuredDigest = digestSecret(configured);
  if (submittedDigest.length !== configuredDigest.length) {
    return false;
  }
  return timingSafeEqual(submittedDigest, configuredDigest);
}
